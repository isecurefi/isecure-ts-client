import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ABSENT_PROVIDER_VERSION,
  FakeTransport,
  ISecureHttpError,
  WSChannel,
  type CredentialProvider,
  type Mode,
  type TransportRequest,
} from "../../src/index.js";
import { expectDenied, FILE_TYPES, qualifyLifecycle, qualifyReads, verifyDownload } from "./journey.js";
const key = readFileSync(new URL("../gpg-encryption-test/test.pem", import.meta.url), "utf8");
const ok = { ResponseCode: "00", ResponseText: "OK" };
function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}
function report(topic = "funds") {
  return {
    schemaVersion: 1,
    ledgerId: "synthetic-ledger",
    ledgerDate: "2026-10-01",
    topic,
    pages: [{ items: [], hasMore: false, tryLater: false }],
  };
}
function forbidden(status = 403): never {
  throw ISecureHttpError.fromResponse(status, "Refused", { ResponseCode: "01", ResponseText: "Denied" });
}
async function fixture(provider: CredentialProvider, brokenDownload = false, concurrent = false) {
  let version: string = ABSENT_PROVIDER_VERSION;
  let enrolled = false;
  const mutations: TransportRequest[] = [];
  const foreignVersion = "00000000-0000-4000-8000-000000000099";
  async function client(identity: "owner" | "foreign" | "denied", mode: Mode): Promise<WSChannel> {
    const transport = new FakeTransport();
    transport.respond((request) => {
      let value: unknown;
      if (request.url.includes("/session/"))
        value =
          request.method === "GET"
            ? { Challenge: "challenge|1475429754114|4017bda8-0a15-4154-a8b7-88069b05cb4e" }
            : {
                ...ok,
                IdToken: "synthetic",
                ApiKey:
                  identity === "foreign" ? "other-tenant" : identity === "denied" ? "denied-tenant" : "own-tenant",
              };
      else if (request.url.endsWith("/connection")) {
        if (request.method !== "GET") {
          mutations.push(request);
          const next = request.headers?.["Idempotency-Key"];
          if (!next) throw new Error("Missing revision");
          if (next !== version && request.headers?.["If-Match"] !== `"${version}"`) forbidden(409);
          version = next;
          enrolled = request.method === "PUT";
        }
        value = { ...ok, Version: version, Enrolled: enrolled, Environment: "production" };
      } else if (request.method === "POST" && request.url.endsWith(`/certs/${provider}`)) {
        mutations.push(request);
        const body = request.body as { Code: string };
        const code = JSON.parse(body.Code) as { ChangeId: string };
        version = code.ChangeId;
        enrolled = true;
        value = ok;
      } else if (request.url.endsWith("/certs"))
        value = {
          ...ok,
          Connections: enrolled && identity === "owner" ? [{ Bank: provider, Access: "direct", Certificates: [] }] : [],
        };
      else {
        if (identity === "denied") forbidden();
        if (identity === "foreign" || !enrolled) forbidden(404);
        if (request.url.endsWith("/check")) value = { ...ok, Ready: true, Environment: "production" };
        else if (request.url.endsWith(`/files/${provider}`)) {
          const requested = request.query?.FileType;
          const fileType = requested?.replace(/_7D$/u, "") ?? FILE_TYPES[provider][0];
          value = {
            ...ok,
            FileDescriptors: [
              {
                FileType: fileType,
                FileReference: "synthetic-reference",
                FileTimestamp: "2026-10-01T00:00:00Z",
                Status: "DLD",
              },
            ],
          };
        } else {
          if (concurrent) version = foreignVersion;
          if (brokenDownload || concurrent) throw new Error("synthetic provider failure");
          value = {
            ...ok,
            Content: encoded(
              provider === "maventa" ? { synthetic: true } : report(request.url.includes("FEES") ? "fees" : "funds"),
            ),
          };
        }
      }
      return { status: 200, statusText: "OK", data: value };
    });
    const sdk = new WSChannel(
      {
        EncryptionProfile: "legacy",
        BaseUrl: "https://ws-api.test.isecure.fi/v2",
        Bank: provider,
        Mode: mode,
        Email: `${identity}@example.invalid`,
        Company: "Synthetic",
        Name: "Synthetic",
        Password: "synthetic-password",
        Phone: "+358400000000",
        PublicKey: key,
      },
      { transport },
    );
    await sdk.login();
    return sdk;
  }
  const admin = await client("owner", "admin"),
    data = await client("owner", "data"),
    foreign = await client("foreign", "data"),
    denied = await client("denied", "data");
  return { admin, data, foreign, denied, mutations, state: () => ({ version, enrolled }) };
}
const maventa = {
  Environment: "stage" as const,
  CompanyUuid: "00000000-0000-4000-8000-000000000001",
  UserApiKey: "synthetic-user",
  VendorApiKey: "synthetic-vendor",
};
const mobilepay = {
  Environment: "production" as const,
  ClientId: "synthetic-client",
  ClientSecret: "synthetic-secret",
  LedgerScope: "AllAccessible" as const,
  LedgerTimezone: "Europe/Helsinki",
  LedgerCutoff: "00:00",
};
describe("provider qualification through the SDK", () => {
  it.each(["maventa", "mobilepay"] as const)(
    "covers %s enrollment/discovery/download/rotation/denials/disable",
    async (provider) => {
      const f = await fixture(provider);
      const credentials = provider === "maventa" ? maventa : mobilepay;
      await qualifyLifecycle(f.admin, f.data, f.foreign, f.denied, provider, credentials, credentials);
      expect(f.state().enrolled).toBe(false);
      expect(f.mutations.map((r) => r.method)).toEqual(["POST", "PUT", "PUT", "PUT", "DELETE"]);
      expect(f.mutations.filter((r) => r.method !== "POST").every((r) => r.retry === false)).toBe(true);
    },
  );
  it("rejects a subscription-denial fixture in the subscribed tenant before mutation", async () => {
    const f = await fixture("maventa");
    const sameTenantDenied = f.denied;
    Object.defineProperty(sameTenantDenied.session, "apiKey", { value: f.data.session.apiKey });
    await expect(
      qualifyLifecycle(f.admin, f.data, f.foreign, sameTenantDenied, "maventa", maventa, maventa),
    ).rejects.toThrow("fixture account isolation");
    expect(f.mutations).toHaveLength(0);
  });
  it("cleans up only this invocation's connection after a download failure", async () => {
    const f = await fixture("maventa", true);
    await expect(qualifyLifecycle(f.admin, f.data, f.foreign, f.denied, "maventa", maventa, maventa)).rejects.toThrow(
      "synthetic provider failure",
    );
    expect(f.state().enrolled).toBe(false);
  });
  it("preserves a concurrent operator's changed connection", async () => {
    const f = await fixture("maventa", false, true);
    await expect(qualifyLifecycle(f.admin, f.data, f.foreign, f.denied, "maventa", maventa, maventa)).rejects.toThrow(
      "Concurrent provider change",
    );
    expect(f.state().enrolled).toBe(true);
    expect(f.mutations.some((r) => r.method === "DELETE")).toBe(false);
  });
  it("does not count an empty mailbox as successful qualification", async () => {
    const f = await fixture("maventa");
    await f.admin.updateProviderConnection("maventa", maventa, {
      expectedVersion: ABSENT_PROVIDER_VERSION,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });
    await expect(
      qualifyReads(
        {
          checkProviderConnection: f.data.checkProviderConnection.bind(f.data),
          listCerts: f.data.listCerts.bind(f.data),
          downloadFile: f.data.downloadFile.bind(f.data),
          listFiles: () => Promise.resolve({ ...ok, FileDescriptors: [] }),
        },
        "maventa",
      ),
    ).rejects.toThrow("qualification is incomplete");
  });
});
describe("download and denial evidence", () => {
  it("verifies all MobilePay pages terminate without pending work", () => {
    const full = {
      ...report(),
      pages: [
        { items: [], hasMore: true, tryLater: false, cursor: "synthetic" },
        { items: [], hasMore: false, tryLater: false },
      ],
    };
    expect(verifyDownload("mobilepay", FILE_TYPES.mobilepay[0], encoded(full)).pages).toBe(2);
    for (const pages of [
      [],
      [{ items: [], hasMore: true, tryLater: false, cursor: "pending" }],
      [{ items: [], hasMore: false, tryLater: true }],
      [{ items: [{ ledgerDate: "2026-09-01" }], hasMore: false, tryLater: false }],
    ])
      expect(() => verifyDownload("mobilepay", FILE_TYPES.mobilepay[0], encoded({ ...report(), pages }))).toThrow();
  });
  it("rejects malformed, empty, truncated and oversized data without echoing it", () => {
    for (const content of [
      "",
      "customer-secret",
      "e30=garbage",
      encoded([]),
      Buffer.from("secret-json-error").toString("base64"),
      "A".repeat(6 * 1024 * 1024),
    ])
      expect(() => verifyDownload("maventa", FILE_TYPES.maventa[0], content)).toThrow(/^Invalid provider/u);
  });
  it("requires authenticated denial, never network/401 failure or success", async () => {
    await expectDenied(() => Promise.reject(ISecureHttpError.fromResponse(403, "Forbidden", {})), [403]);
    for (const operation of [
      () => Promise.resolve({}),
      () => Promise.reject(new Error("network")),
      () => Promise.reject(ISecureHttpError.fromResponse(401, "Unauthorized", {})),
    ])
      await expect(expectDenied(operation, [403])).rejects.toThrow();
  });
});
