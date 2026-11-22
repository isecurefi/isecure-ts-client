import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WSChannel } from "./isecure.class.js";
import { FakeTransport } from "./transport.js";
const publicKey = readFileSync(new URL("../../examples/gpg-encryption-test/test.pem", import.meta.url), "utf8");
describe("policy-aware account administration", () => {
  it("sends reviewed revisions and fresh factors without replay or secret logging", async () => {
    const transport = new FakeTransport();
    const logs: unknown[] = [];
    transport.respond(() => ({ status: 200, statusText: "OK", data: { ResponseCode: "00" } }));
    const client = new WSChannel(
      {
        Email: "synthetic@example.invalid",
        Mode: "admin",
        Bank: "simulator",
        ApiKey: "tenant",
        Company: "Synthetic",
        Name: "Synthetic",
        Password: "unused",
        Phone: "+12025550100",
        PublicKey: publicKey,
        EncryptionProfile: "legacy",
        BaseUrl: "https://example.invalid/gpgtest-rust",
      },
      { transport, logger: { debug: (...args) => logs.push(args), info() {}, warn() {}, error() {} } },
    );
    client.tokens = { idToken: "synthetic-id", apiKey: "tenant" };
    const factor = { AccessToken: "synthetic-action-secret", MfaType: "SOFTWARE_TOKEN_MFA" as const, Code: "123456" };
    await client.configureBankPgpPolicy("simulator", { RequiredSignatureCount: 2, ExpectedRevision: 0 });
    await client.lockPgpPolicy({ ExpectedRevision: 1, ...factor });
    await client.deletePgpKey({ Fingerprint: "a".repeat(40), ExpectedRevision: 1 });
    await client.requestActionMfa("synthetic-action-secret");
    await client.uploadPgpKey("synthetic-armor", "authorize", 3);
    await client.retireCert({ Account: "customer@example.invalid" }, factor);
    await client.deleteAccount("customer@example.invalid", "customer@example.invalid", factor);
    expect(transport.requests.map((r) => [r.method, new URL(r.url).pathname])).toEqual([
      ["PUT", "/gpgtest-rust/pgp/policy/banks/simulator"],
      ["POST", "/gpgtest-rust/pgp/policy/lock"],
      ["DELETE", "/gpgtest-rust/pgp/keys"],
      ["POST", "/gpgtest-rust/session/action-mfa"],
      ["PUT", "/gpgtest-rust/pgp"],
      ["DELETE", "/gpgtest-rust/certs/simulator"],
      ["DELETE", "/gpgtest-rust/account/customer%40example.invalid"],
    ]);
    expect(transport.requests[0]?.body).toEqual({ RequiredSignatureCount: 2, ExpectedRevision: 0 });
    expect(transport.requests[1]?.body).toEqual({ ExpectedRevision: 1, ...factor });
    expect(transport.requests[3]?.body).toEqual({ AccessToken: factor.AccessToken, MfaType: "SMS_MFA" });
    expect(transport.requests[4]?.body).toEqual({
      PgpKey: "synthetic-armor",
      PgpKeyPurpose: "authorize",
      ExpectedRevision: 3,
    });
    expect(transport.requests[5]?.query).toEqual({ Account: "customer@example.invalid" });
    expect(transport.requests[5]?.body).toEqual(factor);
    expect(transport.requests[6]?.body).toEqual({ ConfirmSoftDelete: "customer@example.invalid", ...factor });
    expect(transport.requests.every((r) => r.retry === false)).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(factor.AccessToken);
    expect(JSON.stringify(logs)).not.toContain(factor.Code);
  });
});

it("updates only the explicit bank without reading or replacing the whole policy", async () => {
  const transport = new FakeTransport();
  transport.respond(() => ({ status: 200, statusText: "OK", data: { ResponseCode: "00" } }));
  const client = bankPolicyClient(transport);
  client.tokens = { idToken: "synthetic-id", apiKey: "tenant" };
  await client.configureBankPgpPolicy("osuuspankki", { RequiredSignatureCount: 2, ExpectedRevision: 3 });
  expect(transport.requests).toHaveLength(1);
  expect(transport.requests[0]).toMatchObject({
    method: "PUT",
    url: "https://example.invalid/v2/pgp/policy/banks/osuuspankki",
    body: { RequiredSignatureCount: 2, ExpectedRevision: 3 },
    retry: false,
  });
});

function bankPolicyClient(transport: FakeTransport): WSChannel {
  return new WSChannel(
    {
      Email: "synthetic@example.invalid",
      Mode: "admin",
      Bank: "nordea",
      ApiKey: "tenant",
      Company: "Synthetic",
      Name: "Synthetic",
      Password: "unused",
      Phone: "+12025550100",
      PublicKey: publicKey,
      EncryptionProfile: "legacy",
      BaseUrl: "https://example.invalid/v2",
    },
    { transport },
  );
}

it("rejects missing or malformed bank selectors before any request", async () => {
  const transport = new FakeTransport();
  const client = bankPolicyClient(transport);
  for (const bank of ["", " op", "op/../nordea", "op%2Fnordea", "x".repeat(65)]) {
    await expect(
      client.configureBankPgpPolicy(bank, { RequiredSignatureCount: 1, ExpectedRevision: 0 }),
    ).rejects.toThrow("bank route");
  }
  expect(transport.requests).toHaveLength(0);
});
it("never falls back to whole-policy replacement or retries an uncertain bank update", async () => {
  const transport = new FakeTransport();
  transport.respond(() => {
    throw new Error("connection lost after write");
  });
  const client = bankPolicyClient(transport);
  client.tokens = { idToken: "synthetic-id", apiKey: "tenant" };
  await expect(client.configureBankPgpPolicy("op", { RequiredSignatureCount: 1, ExpectedRevision: 3 })).rejects.toThrow(
    "connection lost",
  );
  expect(transport.requests).toHaveLength(1);
  expect(transport.requests[0]?.retry).toBe(false);
  expect(new URL(transport.requests[0]?.url ?? "").pathname).toBe("/v2/pgp/policy/banks/op");
});

it("blocks one bank with an explicit DELETE, never a zero count or whole-map replacement", async () => {
  const transport = new FakeTransport();
  transport.respond(() => ({ status: 200, statusText: "OK", data: { ResponseCode: "00" } }));
  const client = bankPolicyClient(transport);
  client.tokens = { idToken: "synthetic-id", apiKey: "tenant" };
  expect("configurePgpPolicy" in client).toBe(false);
  await client.blockBankPgpPolicy("op", { ExpectedRevision: 4 });
  expect(transport.requests).toHaveLength(1);
  expect(transport.requests[0]).toMatchObject({
    method: "DELETE",
    url: "https://example.invalid/v2/pgp/policy/banks/op",
    body: { ExpectedRevision: 4 },
    retry: false,
  });
  await expect(client.blockBankPgpPolicy("", { ExpectedRevision: 4 })).rejects.toThrow("bank route");
  expect(transport.requests).toHaveLength(1);
});

it("passes explicit first-policy confirmation without inferring it from a login or missing revision", async () => {
  const transport = new FakeTransport();
  transport.respond(() => ({ status: 200, statusText: "OK", data: { ResponseCode: "00" } }));
  const client = bankPolicyClient(transport);
  client.tokens = { idToken: "synthetic-id", apiKey: "tenant" };
  await client.configureBankPgpPolicy("op", {
    RequiredSignatureCount: 1,
    ExpectedRevision: 0,
    ConfirmPolicyInitialization: true,
  });
  expect(transport.requests[0]?.body).toEqual({
    RequiredSignatureCount: 1,
    ExpectedRevision: 0,
    ConfirmPolicyInitialization: true,
  });
});

it("preserves omission versus explicit clearing and sends required signers without retry", async () => {
  const transport = new FakeTransport();
  transport.respond(() => ({ status: 200, statusText: "OK", data: { ResponseCode: "00" } }));
  const client = bankPolicyClient(transport);
  client.tokens = { idToken: "synthetic-id", apiKey: "tenant" };
  for (const signers of [undefined, [], ["a".repeat(40)]]) {
    const request = {
      RequiredSignatureCount: 2,
      ExpectedRevision: 3,
      ...(signers === undefined ? {} : { RequiredSignerFingerprints: signers }),
    };
    await client.configureBankPgpPolicy("op", request);
    expect(transport.requests.at(-1)).toMatchObject({ method: "PUT", body: request, retry: false });
    expect(Object.hasOwn(transport.requests.at(-1)?.body ?? {}, "RequiredSignerFingerprints")).toBe(
      signers !== undefined,
    );
  }
});
