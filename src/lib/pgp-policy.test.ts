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
    await client.configurePgpPolicy({ RequiredSignatures: { simulator: 2 }, ExpectedRevision: 0 });
    await client.lockPgpPolicy({ ExpectedRevision: 1, ...factor });
    await client.deletePgpKey({ Fingerprint: "a".repeat(40), ExpectedRevision: 1 });
    await client.requestActionMfa("synthetic-action-secret");
    await client.uploadPgpKey("synthetic-armor", "authorize", 3);
    await client.retireCert({ Account: "customer@example.invalid" }, factor);
    await client.deleteAccount("customer@example.invalid", "customer@example.invalid", factor);
    expect(transport.requests.map((r) => [r.method, new URL(r.url).pathname])).toEqual([
      ["PUT", "/gpgtest-rust/pgp/policy"],
      ["POST", "/gpgtest-rust/pgp/policy/lock"],
      ["DELETE", "/gpgtest-rust/pgp/keys"],
      ["POST", "/gpgtest-rust/session/action-mfa"],
      ["PUT", "/gpgtest-rust/pgp"],
      ["DELETE", "/gpgtest-rust/certs/simulator"],
      ["DELETE", "/gpgtest-rust/account/customer%40example.invalid"],
    ]);
    expect(transport.requests[0]?.body).toEqual({ RequiredSignatures: { simulator: 2 }, ExpectedRevision: 0 });
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
