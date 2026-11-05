import { describe, expect, it } from "vitest";
import { WSChannel } from "./isecure.class.js";
import { redactValue } from "./redact.js";

describe("credential providers", () => {
  it("exposes connection lifecycle methods alongside existing file methods", () => {
    for (const method of [
      "checkProviderConnection",
      "getProviderConnection",
      "updateProviderConnection",
      "disableProviderConnection",
    ]) {
      expect(Reflect.get(WSChannel.prototype, method)).toBeTypeOf("function");
    }
  });
  it("redacts short provider credentials independently of token heuristics", () => {
    const payload = {
      UserApiKey: "user-secret",
      VendorApiKey: "vendor-secret",
      ClientId: "client-id",
      ClientSecret: "client-secret",
      RecipientHandle: "api:123",
      LedgerId: "ledger",
    };
    const redacted = JSON.stringify(redactValue(payload));
    for (const secret of Object.values(payload)) expect(redacted).not.toContain(secret);
  });
});

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { FakeTransport, LoggingTransport, type Transport, type TransportResponse } from "./transport.js";
import { ISecureError, ISecureHttpError } from "./errors.js";
import {
  ABSENT_PROVIDER_VERSION,
  createProviderEnrollment,
  type CredentialProvider,
  type MaventaCredentials,
  type MobilePayCredentials,
} from "./providers.js";

const key = readFileSync(new URL("../../examples/gpg-encryption-test/test.pem", import.meta.url), "utf8");
const version = "00000000-0000-4000-8000-000000000001";
const change = { expectedVersion: ABSENT_PROVIDER_VERSION, idempotencyKey: version };
const maventa: MaventaCredentials = {
  Environment: "production",
  CompanyUuid: "00000000-0000-4000-8000-000000000002",
  UserApiKey: "short-user",
  VendorApiKey: "short-vendor",
};
const mobilepay: MobilePayCredentials = {
  Environment: "production",
  ClientId: "short-client",
  ClientSecret: "short-secret",
  LedgerScope: "AllAccessible",
  LedgerTimezone: "Europe/Helsinki",
  LedgerCutoff: "00:00",
};
function response<T>(data: T, status = 200): TransportResponse<T> {
  return { status, statusText: "OK", data };
}
async function client(provider: CredentialProvider, data: unknown = {}, base = "https://ws-api.test.isecure.fi/v2") {
  const transport = new FakeTransport();
  transport.respond((request) => {
    if (request.url.includes("/session/"))
      return response(
        request.method === "GET"
          ? { Challenge: "challenge|1475429754114|4017bda8-0a15-4154-a8b7-88069b05cb4e" }
          : { IdToken: "synthetic-token", ApiKey: "synthetic-tenant", ResponseCode: "00", ResponseText: "OK" },
      );
    if (data instanceof Error) throw data;
    return response(data);
  });
  const sdk = new WSChannel(
    {
      Bank: provider,
      BaseUrl: base,
      Email: "synthetic@example.invalid",
      Mode: "admin",
      Company: "Synthetic",
      Name: "Synthetic",
      Phone: "+358400000000",
      Password: "synthetic-password",
      PublicKey: key,
    },
    { transport },
  );
  await sdk.login();
  transport.requests.length = 0;
  return { sdk, transport };
}

describe.each(["maventa", "mobilepay"] as const)("%s SDK workflow", (provider) => {
  it("routes readiness/metadata explicitly without changing the file selection", async () => {
    const data = {
      Ready: true,
      Environment: "production",
      Version: version,
      Enrolled: true,
      ResponseCode: "00",
      ResponseText: "OK",
    };
    const { sdk, transport } = await client(
      provider,
      data,
      "https://gky0hkiw7k.execute-api.eu-west-1.amazonaws.com/rc",
    );
    sdk.updateProps({ Bank: "nordea" });
    expect(await sdk.checkProviderConnection(provider)).toEqual(data);
    expect(await sdk.getProviderConnection(provider)).toEqual(data);
    expect(transport.requests.map((request) => request.url)).toEqual([
      `https://gky0hkiw7k.execute-api.eu-west-1.amazonaws.com/rc/providers/${provider}/check`,
      `https://gky0hkiw7k.execute-api.eu-west-1.amazonaws.com/rc/providers/${provider}/connection`,
    ]);
    expect(sdk.props.Bank).toBe("nordea");
    for (const request of transport.requests)
      expect(request.headers).toMatchObject({ Authorization: "synthetic-token", "x-api-key": "synthetic-tenant" });
  });

  it("sends exact credential revisions and disables without a body or automatic replay", async () => {
    const metadata = {
      Enrolled: true,
      Environment: "production",
      Version: version,
      ResponseCode: "00",
      ResponseText: "OK",
    };
    const { sdk, transport } = await client(provider, metadata);
    const credentials = provider === "maventa" ? maventa : mobilepay;
    expect(await sdk.updateProviderConnection(provider, credentials, change)).toEqual(metadata);
    expect(transport.requests[0]).toMatchObject({
      method: "PUT",
      body: credentials,
      retry: false,
      headers: { "If-Match": `"${ABSENT_PROVIDER_VERSION}"`, "Idempotency-Key": version },
    });
    await sdk.disableProviderConnection(provider, {
      expectedVersion: version,
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
    });
    expect(transport.requests[1]).toMatchObject({
      method: "DELETE",
      retry: false,
      headers: { "If-Match": `"${version}"`, "Idempotency-Key": "00000000-0000-4000-8000-000000000003" },
    });
    expect(transport.requests[1]).not.toHaveProperty("body");
  });

  it("preserves certificate-free discovery and exact downloaded content through existing methods", async () => {
    const discovery = {
      Connections: [{ Bank: provider, Access: "direct", Certificates: [] }],
      ResponseCode: "00",
      ResponseText: "OK",
    };
    const first = await client(provider, discovery);
    expect(await first.sdk.listCerts()).toEqual(discovery);
    const fileType = provider === "maventa" ? "MAVENTA_INVOICE_JSON_V1" : "MOBILEPAY_FUNDS_JSON_V1";
    const files = {
      FileDescriptors: [
        {
          FileType: fileType,
          FileReference: "synthetic-reference",
          FileTimestamp: "2026-10-20T00:00:00Z",
          Status: "DLD",
        },
      ],
      ResponseCode: "00",
      ResponseText: "OK",
    };
    const second = await client(provider, files);
    expect(await second.sdk.listFiles({ Status: "ALL" })).toEqual(files);
    expect(second.transport.requests[0]?.query).toEqual({ Status: "ALL" });
    const third = await client(provider, {
      Content: "eyJzeW50aGV0aWMiOnRydWV9",
      ResponseCode: "00",
      ResponseText: "OK",
    });
    expect((await third.sdk.downloadFile(fileType, "synthetic-reference")).Content).toBe("eyJzeW50aGV0aWMiOnRydWV9");
    expect(third.transport.requests[0]?.url.endsWith(`/files/${provider}/${fileType}/synthetic-reference`)).toBe(true);
  });

  it("creates compatible typed enrollment with an unchanged retry bundle", async () => {
    const credentials = provider === "maventa" ? maventa : mobilepay;
    const body = createProviderEnrollment(provider, credentials, change, "Synthetic company");
    const bundle: unknown = JSON.parse(body.Code);
    expect(bundle).toMatchObject({
      SchemaVersion: 1,
      ExpectedVersion: ABSENT_PROVIDER_VERSION,
      ChangeId: version,
      Environment: "production",
    });
    expect(bundle).not.toHaveProperty(provider === "maventa" ? "CompanyUuid" : "ClientId");
    expect(body.WsUserId).toBe(provider === "maventa" ? maventa.CompanyUuid : mobilepay.ClientId);
    const { sdk, transport } = await client(provider, { ResponseCode: "00", ResponseText: "Connection enrolled" });
    await sdk.enrollCert(body);
    await sdk.enrollCert(body);
    expect(transport.requests.map((request) => request.body)).toEqual([body, body]);
    expect(transport.requests[0]?.url.endsWith(`/certs/${provider}`)).toBe(true);
  });
});

describe("provider guards and contract", () => {
  it.each(['"00000000-0000-4000-8000-000000000001"', "invalid", "00000000-0000-4000-8000-00000000000A"])(
    "rejects malformed revisions before transport: %s",
    async (invalid) => {
      const { sdk, transport } = await client("maventa");
      await expect(
        sdk.disableProviderConnection("maventa", { ...change, expectedVersion: invalid }),
      ).rejects.toBeInstanceOf(ISecureError);
      expect(transport.requests).toHaveLength(0);
    },
  );
  it("rejects missing change IDs, invalid providers and missing enrollment identities", async () => {
    const { sdk, transport } = await client("maventa");
    await expect(
      sdk.disableProviderConnection("maventa", { ...change, idempotencyKey: ABSENT_PROVIDER_VERSION }),
    ).rejects.toBeInstanceOf(ISecureError);
    await expect(sdk.getProviderConnection("../attacker" as CredentialProvider)).rejects.toBeInstanceOf(ISecureError);
    expect(() => createProviderEnrollment("maventa", { ...maventa, CompanyUuid: "" }, change, "Synthetic")).toThrow(
      ISecureError,
    );
    expect(transport.requests).toHaveLength(0);
  });
  it.each([401, 403, 404, 409, 413, 503])(
    "preserves HTTP %s without fallback or client-side authority",
    async (status) => {
      const failure = ISecureHttpError.fromResponse(status, "Denied", {
        ResponseCode: "01",
        ResponseText: "Provider operation refused",
      });
      const { sdk, transport } = await client("maventa", failure);
      await expect(sdk.updateProviderConnection("maventa", maventa, change)).rejects.toBe(failure);
      expect(transport.requests).toHaveLength(1);
      expect(transport.requests[0]?.retry).toBe(false);
    },
  );
  it("pins the generated provider contract to the backend digest and all thirteen methods", () => {
    const bytes = readFileSync(new URL("../../provider-api.json", import.meta.url));
    const lock = JSON.parse(readFileSync(new URL("../../provider-contract.lock.json", import.meta.url), "utf8")) as {
      sha256: string;
    };
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(lock.sha256);
    const spec = JSON.parse(bytes.toString()) as { paths: Record<string, Record<string, unknown>> };
    expect(Object.keys(spec.paths).sort()).toEqual([
      "/providers/holvi/check",
      "/providers/holvi/connection",
      // Holvi's browser redirect target; deliberately not an SDK method.
      "/providers/holvi/oauth/callback",
      "/providers/maventa/check",
      "/providers/maventa/connection",
      "/providers/mobilepay/check",
      "/providers/mobilepay/connection",
    ]);
    expect(Object.values(spec.paths).reduce((n, path) => n + Object.keys(path).length, 0)).toBe(13);
  });
  it("does not emit echoed secrets from transport error messages", async () => {
    const logs: unknown[] = [];
    const inner: Transport = { request: () => Promise.reject(new Error("echoed short-secret and customer report")) };
    const transport = new LoggingTransport(inner, {
      logger: { debug: (message, meta) => logs.push({ message, meta }) },
    });
    await expect(
      transport.request({
        method: "PUT",
        url: "https://api.example.invalid/providers/mobilepay/connection",
        body: mobilepay,
      }),
    ).rejects.toThrow("echoed");
    expect(JSON.stringify(logs)).not.toContain("short-secret");
    expect(JSON.stringify(logs)).not.toContain("customer report");
  });
});
