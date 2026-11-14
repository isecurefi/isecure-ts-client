import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnalyticsReader, signS3Get, type AnalyticsFile } from "./analytics.js";
import { ISecureAbortError, ISecureNetworkError } from "./errors.js";
import { WSChannel } from "./isecure.class.js";
import { redactValue, REDACTED } from "./redact.js";
import { FakeTransport } from "./transport.js";

const NOW = Date.parse("2026-11-14T10:00:00Z");
const SCOPE = "schema_version=1/environment=test/service=bank-index/";
const TENANT = "ta1.test1.synthetic";
const DETAIL = `compacted/detail/${SCOPE}tenant=${TENANT}/`;
const LONG = `compacted/long-term/${SCOPE}tenant=${TENANT}/`;
const HOST = "isecure-analytics-gpgtest-000000000000.s3.eu-west-1.amazonaws.com";

function wire(overrides: Record<string, unknown> = {}) {
  return {
    ResponseCode: "00",
    AnalyticsAccess: {
      Bucket: "isecure-analytics-gpgtest-000000000000",
      Region: "eu-west-1",
      Prefixes: [DETAIL, LONG],
      AccessKeyId: "ASIASYNTHETICEXAMPLE",
      SecretAccessKey: "synthetic/secret+key",
      SessionToken: "synthetic-session-token",
      Expiration: "2026-11-14T10:15:00Z",
      ...overrides,
    },
  };
}

function listing(entries: [string, number][], next?: string): string {
  return (
    `<?xml version="1.0"?><ListBucketResult><IsTruncated>${String(next !== undefined)}</IsTruncated>` +
    entries.map(([key, size]) => `<Contents><Key>${key}</Key><Size>${String(size)}</Size></Contents>`).join("") +
    (next === undefined ? "" : `<NextContinuationToken>${next}</NextContinuationToken>`) +
    "</ListBucketResult>"
  );
}

/** Records every storage request and answers from a queue. */
function storage(answers: (Response | Error)[]) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const send = ((url: string, init?: RequestInit) => {
    calls.push({ url: new URL(url), headers: init?.headers as Record<string, string> });
    const answer = answers.shift();
    return answer instanceof Response ? Promise.resolve(answer) : Promise.reject(answer ?? new Error("unexpected"));
  }) as typeof fetch;
  return { calls, send };
}

describe("signS3Get", () => {
  // Published examples: Amazon S3 API reference, "Signature Calculations for the Authorization Header".
  const example = {
    host: "examplebucket.s3.amazonaws.com",
    key: "",
    region: "us-east-1",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    now: Date.parse("2013-05-24T00:00:00Z"),
  };
  it.each([
    [{ "max-keys": "2", prefix: "J" }, "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7"],
    [{ lifecycle: "" }, "fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543"],
  ])("matches the published signature for %o", async (query, signature) => {
    const signed = await signS3Get({ ...example, query });
    expect(signed.headers.Authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
        `SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
    );
    expect(signed.headers).not.toHaveProperty("host");
  });
  it("encodes key segments and signs the session token", async () => {
    const signed = await signS3Get({ ...example, key: "a=b/c d.parquet", query: {}, sessionToken: "token" });
    expect(signed.url).toBe("https://examplebucket.s3.amazonaws.com/a%3Db/c%20d.parquet");
    expect(signed.headers["x-amz-security-token"]).toBe("token");
    expect(signed.headers.Authorization).toContain("x-amz-date;x-amz-security-token,");
  });
});

describe("AnalyticsReader", () => {
  it.each([
    ["no descriptor", { ResponseCode: "00" }],
    ["another bucket", wire({ Bucket: "attacker-bucket" })],
    ["a bucket with a host suffix", wire({ Bucket: "isecure-analytics-x.evil.example" })],
    ["another region", wire({ Region: "us-east-1" })],
    ["no prefixes", wire({ Prefixes: [] })],
    ["a prefix outside the tenant tiers", wire({ Prefixes: [`compacted/detail/${SCOPE}internal/`] })],
    ["the raw landing prefix", wire({ Prefixes: ["landing/"] })],
    ["an expired session", wire({ Expiration: "2026-11-14T09:59:59Z" })],
    ["an over-long session", wire({ Expiration: "2026-11-14T12:00:00Z" })],
    ["an unparsable expiry", wire({ Expiration: "soon" })],
    ["a header-breaking token", wire({ SessionToken: "a\r\nx-injected: 1" })],
    ["a missing secret", wire({ SecretAccessKey: undefined })],
  ])("refuses %s", (_name, response) => {
    expect(() => new AnalyticsReader(response, { now: () => NOW })).toThrow("Invalid analytics access response");
  });

  it("exposes prefixes and expiry but never the credentials", () => {
    const reader = new AnalyticsReader(wire(), { now: () => NOW });
    expect(reader.prefixes).toEqual([DETAIL, LONG]);
    expect(reader.expiresAt).toBe(Date.parse("2026-11-14T10:15:00Z"));
    const visible = JSON.stringify({ reader, keys: Object.keys(reader), entries: Object.entries(reader) });
    expect(visible).not.toMatch(/secret|session-token|ASIA/);
    expect(JSON.stringify(reader)).toBe('"<redacted analytics access>"');
    expect(redactValue(wire())).toMatchObject({ AnalyticsAccess: REDACTED });
  });

  it("lists every page of each prefix and keeps only well-formed tenant files", async () => {
    const day = `${DETAIL}batch_date=2026-11-13/data.parquet`;
    const month = `${LONG}month=2026-10/data.parquet`;
    const { calls, send } = storage([
      new Response(listing([[`${DETAIL}batch_date=2026-11-12/data.parquet`, 10]], "next+token/==")),
      new Response(
        listing([
          [day, 20],
          [`${DETAIL}month=2026-10/data.parquet`, 5], // a month under the detail tier
          [`${DETAIL}batch_date=2026-11-13/other.parquet`, 5],
          [`compacted/detail/${SCOPE}internal/batch_date=2026-11-13/data.parquet`, 5],
        ]),
      ),
      new Response(listing([[month, 30]])),
    ]);
    const reader = new AnalyticsReader(wire(), { fetch: send, now: () => NOW });
    const files = await reader.list();
    expect(files).toEqual([
      {
        key: `${DETAIL}batch_date=2026-11-12/data.parquet`,
        bytes: 10,
        tier: "detail",
        tenant: TENANT,
        period: "2026-11-12",
      },
      { key: day, bytes: 20, tier: "detail", tenant: TENANT, period: "2026-11-13" },
      { key: month, bytes: 30, tier: "long-term", tenant: TENANT, period: "2026-10" },
    ]);
    expect(calls.map((call) => [call.url.host, call.url.pathname, call.url.searchParams.get("prefix")])).toEqual([
      [HOST, "/", DETAIL],
      [HOST, "/", DETAIL],
      [HOST, "/", LONG],
    ]);
    expect(calls[1]?.url.searchParams.get("continuation-token")).toBe("next+token/==");
    expect(calls[0]?.headers["x-amz-security-token"]).toBe("synthetic-session-token");
    expect(calls[0]?.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=ASIASYNTHETICEXAMPLE\/20261114\//);
  });

  it("lists files outside the tenant partitions only under a prefix that covers them", async () => {
    const all = `compacted/detail/${SCOPE}`;
    const shared = `${all}internal/batch_date=2026-11-13/data.parquet`;
    const { send } = storage([
      new Response(
        listing([
          [shared, 40],
          [`${all}tenant=${TENANT}/batch_date=2026-11-13/data.parquet`, 20],
          [`compacted/long-term/${SCOPE}internal/month=2026-10/data.parquet`, 5],
        ]),
      ),
      new Response(new Uint8Array(40)),
    ]);
    const reader = new AnalyticsReader(wire({ Prefixes: [all] }), { fetch: send, now: () => NOW });
    const [first, second] = await reader.list();
    expect([first, second].map((file) => [file?.tenant, file?.period, file?.bytes])).toEqual([
      [undefined, "2026-11-13", 40],
      [TENANT, "2026-11-13", 20],
    ]);
    if (first === undefined) throw new Error("expected a listed file");
    expect(await reader.read(first)).toHaveLength(40);
  });

  it("lists one tier only when asked, and refuses endless or broken listings", async () => {
    const one = storage([new Response(listing([]))]);
    const reader = new AnalyticsReader(wire(), { fetch: one.send, now: () => NOW });
    expect(await reader.list({ tier: "long-term" })).toEqual([]);
    expect(one.calls.map((call) => call.url.searchParams.get("prefix"))).toEqual([LONG]);

    const broken = storage([new Response("<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>")]);
    await expect(
      new AnalyticsReader(wire(), { fetch: broken.send, now: () => NOW }).list({ tier: "detail" }),
    ).rejects.toThrow("invalid listing");

    const endless = storage(Array.from({ length: 30 }, () => new Response(listing([], "again"))));
    await expect(
      new AnalyticsReader(wire(), { fetch: endless.send, now: () => NOW }).list({ tier: "detail" }),
    ).rejects.toThrow("too large");
    expect(endless.calls).toHaveLength(25);
  });

  const file: AnalyticsFile = {
    key: `${DETAIL}batch_date=2026-11-13/data.parquet`,
    bytes: 4,
    tier: "detail",
    tenant: TENANT,
    period: "2026-11-13",
  };

  it("reads the exact bytes of a listed file", async () => {
    const { calls, send } = storage([new Response(new Uint8Array([80, 65, 82, 49]))]);
    const reader = new AnalyticsReader(wire(), { fetch: send, now: () => NOW });
    expect([...(await reader.read(file))]).toEqual([80, 65, 82, 49]);
    expect(calls[0]?.url.href).toBe(
      `https://${HOST}/compacted/detail/schema_version%3D1/environment%3Dtest/service%3Dbank-index/` +
        "tenant%3Dta1.test1.synthetic/batch_date%3D2026-11-13/data.parquet",
    );
  });

  it.each([
    ["another tenant", { key: file.key.replace(TENANT, "ta1.test1.other") }],
    ["the internal tier", { key: `compacted/detail/${SCOPE}internal/batch_date=2026-11-13/data.parquet` }],
    ["a traversal", { key: `${DETAIL}batch_date=2026-11-13/../data.parquet` }],
    ["an oversized file", { bytes: 65 * 1024 * 1024 }],
    ["an empty file", { bytes: 0 }],
  ])("refuses to read %s without a request", async (_name, change) => {
    const { calls, send } = storage([]);
    const reader = new AnalyticsReader(wire(), { fetch: send, now: () => NOW });
    await expect(reader.read({ ...file, ...change })).rejects.toThrow("outside this access");
    expect(calls).toHaveLength(0);
  });

  it("reports changed, oversized, refused, failed, aborted and expired requests without detail", async () => {
    const reader = (answers: (Response | Error)[], now = NOW) =>
      new AnalyticsReader(wire(), { fetch: storage(answers).send, now: () => now });
    await expect(reader([new Response(new Uint8Array(3))]).read(file)).rejects.toThrow("changed since");
    await expect(reader([new Response(new Uint8Array(9))]).read(file)).rejects.toThrow("too large");
    await expect(
      reader([new Response(new Uint8Array(4), { headers: { "content-length": "999" } })]).read(file),
    ).rejects.toThrow("too large");
    const refused = reader([new Response("<Error><Code>AccessDenied</Code>secret detail</Error>", { status: 403 })]);
    await expect(refused.read(file)).rejects.toThrow(/^Analytics storage refused the request \(status 403\)$/);
    const failed = await reader([new Error(`connect failed for ${file.key}`)])
      .read(file)
      .catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(ISecureNetworkError);
    expect(JSON.stringify([failed, (failed as Error).message, (failed as Error).cause])).not.toContain("compacted");
    const controller = new AbortController();
    controller.abort();
    await expect(reader([new Error("aborted")]).read(file, { signal: controller.signal })).rejects.toBeInstanceOf(
      ISecureAbortError,
    );
    const body = new Response(null);
    Object.defineProperty(body, "arrayBuffer", { value: () => Promise.reject(new Error("reset")) });
    await expect(reader([body]).read(file)).rejects.toBeInstanceOf(ISecureNetworkError);

    let now = NOW;
    const { calls, send } = storage([]);
    const expiring = new AnalyticsReader(wire(), { fetch: send, now: () => now });
    now = expiring.expiresAt;
    await expect(expiring.list()).rejects.toThrow("expired");
    expect(calls).toHaveLength(0);
  });
});

describe("WSChannel.readAnalyticsAccess", () => {
  const publicKey = readFileSync(new URL("../../examples/gpg-encryption-test/test.pem", import.meta.url), "utf8");
  const challenge = "challenge-bytes|1475429754114|4017bda8-0a15-4154-a8b7-88069b05cb4e";
  const ok = <T>(data: T) => ({ status: 200, statusText: "OK", data });

  async function client() {
    const transport = new FakeTransport();
    transport.respond((request) => {
      if (request.method === "GET" && request.url.includes("/session/"))
        return ok({ Challenge: challenge, ResponseCode: "00", ResponseText: "OK" });
      if (request.method === "POST" && request.url.includes("/session/"))
        return ok({ IdToken: "id-token", ApiKey: "tenant-api-key", ResponseCode: "00", ResponseText: "OK" });
      if (request.url.endsWith("/analytics/access"))
        return ok(wire({ Expiration: new Date(Date.now() + 600_000).toISOString() }));
      return undefined;
    });
    const channel = new WSChannel(
      {
        ApiKey: "0",
        Company: "Example Company",
        Name: "Example User",
        Password: "Example-password-123!",
        Phone: "+358401234567",
        PublicKey: publicKey,
        EncryptionProfile: "legacy",
        BaseUrl: "https://ws-api.test.isecure.fi/v2",
        Email: "user@example.test",
        Mode: "admin",
        Bank: "nordea",
      },
      { transport },
    );
    return { channel, transport };
  }

  it("requires a session, sends one unretried authenticated request and returns a reader", async () => {
    const { channel, transport } = await client();
    await expect(channel.readAnalyticsAccess()).rejects.toThrow(/Cannot call authenticated/);
    await channel.login();
    const { send, calls } = storage([new Response(listing([]))]);
    const reader = await channel.readAnalyticsAccess({ Tenant: "tenantapikey1" }, { fetch: send });
    expect(transport.requests.at(-1)).toMatchObject({
      method: "GET",
      url: "https://ws-api.test.isecure.fi/v2/analytics/access",
      headers: { Authorization: "id-token", "x-api-key": "tenant-api-key" },
      query: { Tenant: "tenantapikey1" },
      retry: false,
    });
    expect(await reader.list({ tier: "detail" })).toEqual([]);
    expect(calls).toHaveLength(1);
    await channel.readAnalyticsAccess();
    expect(transport.requests.at(-1)?.query).toBeUndefined();
  });

  it("refuses a malformed tenant before any request", async () => {
    const { channel, transport } = await client();
    await channel.login();
    const sent = transport.requests.length;
    await expect(channel.readAnalyticsAccess({ Tenant: "a b" })).rejects.toThrow("Invalid analytics tenant");
    await expect(channel.readAnalyticsAccess({ Tenant: "a".repeat(129) })).rejects.toThrow("Invalid analytics tenant");
    await expect(channel.readAnalyticsAccess({ Tenant: "" })).rejects.toThrow("Invalid analytics tenant");
    expect(transport.requests).toHaveLength(sent);
  });
});
