import { expect, it, vi } from "vitest";
import { readUploadControlResult, readUploadGrant, uploadCiphertext } from "./transfer-s3.js";
import { sha256TransferBytes } from "./transfer-representation.js";

const origin = "https://synthetic.s3.eu-west-1.amazonaws.com";
const id = "c".repeat(64);
const ciphertext = new Uint8Array(40).fill(7);
const hash = await sha256TransferBytes(ciphertext);
const checksum = btoa(String.fromCharCode(...Uint8Array.from(hash.match(/../gu) ?? [], (part) => parseInt(part, 16))));
const summary = {
  Encoding: "identity" as const,
  EncodedBytes: 4,
  EncodedSha256: "a".repeat(64),
  CiphertextSha256: hash,
  ObjectBytes: 40,
};
function fixture() {
  return {
    Url: `${origin}/`,
    ExpiresAt: 1300,
    Fields: {
      key: `transfers/${id}/${"d".repeat(64)}/upload`,
      "Content-Type": "application/octet-stream",
      success_action_status: "201",
      "x-amz-server-side-encryption": "AES256",
      "x-amz-checksum-algorithm": "SHA256",
      "x-amz-checksum-sha256": checksum,
      "x-amz-algorithm": "AWS4-HMAC-SHA256",
      "x-amz-credential": "ASIASYNTHETIC12345678/20261030/eu-west-1/s3/aws4_request",
      "x-amz-date": "20261030T000000Z",
      "x-amz-security-token": "synthetic-token",
      policy: btoa('{"synthetic":true}'),
      "x-amz-signature": "e".repeat(64),
    },
  };
}
function read(value: unknown = fixture()) {
  return readUploadGrant(value, {
    origin,
    transferId: id,
    summary,
    now: 1000,
    executeUntil: 4600,
    grantMaxSeconds: 300,
  });
}
it("snapshots a closed grant bound to authenticated origin, transfer and ciphertext checksum", () => {
  const value = fixture();
  const grant = read(value);
  value.Url = "https://elsewhere.invalid/";
  value.Fields.key = "changed";
  expect(grant.Url).toBe(`${origin}/`);
  expect(grant.Fields.key).toContain(id);
  expect(Object.isFrozen(grant.Fields)).toBe(true);
  expect(JSON.stringify(grant)).not.toContain("synthetic-token");
});
it("refuses malformed grants without normalizing URLs, fields or checksums", () => {
  for (const change of [
    { Url: `${origin}:443/` },
    { Url: `${origin}/?x=1` },
    { Url: `${origin}/path` },
    { Url: ` ${origin}/` },
    { Url: `${origin}/#x` },
    { Url: "http://localhost/" },
    { Url: "https://elsewhere.invalid/" },
    { ExpiresAt: 1000 },
    { ExpiresAt: 1301 },
    { ExpiresAt: 1100.1 },
    { ExpiresAt: null },
    { Artifact: {} },
    { Fields: [] },
  ])
    expect(() => read({ ...fixture(), ...change })).toThrow();
  for (const change of [
    { key: `transfers/${"e".repeat(64)}/${"d".repeat(64)}/upload` },
    { key: `transfers/${id}/${"d".repeat(64)}/download` },
    { "Content-Type": "text/plain" },
    { "x-amz-checksum-sha256": btoa("x".repeat(32)) },
    { "x-amz-checksum-sha256": undefined },
    { "x-amz-signature": "E".repeat(64) },
    { "x-amz-server-side-encryption": "none" },
    { success_action_status: "204" },
    { success_action_redirect: "https://elsewhere.invalid/" },
    { file: "injected" },
    { "x-amz-security-token": "x\r\ninjected" },
    { "x-amz-security-token": "x".repeat(20481) },
    { policy: "not base64" },
    { policy: "" },
    { "x-amz-date": "invalid" },
  ])
    expect(() => read({ ...fixture(), Fields: { ...fixture().Fields, ...change } })).toThrow();
});
it("posts ciphertext last without API credentials, redirects, cookies, referrer or retries", async () => {
  const send = vi.fn<typeof fetch>(async (_input, options) => {
    expect(options).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    expect(options?.headers).toBeUndefined();
    const body = options?.body;
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) throw new Error("missing multipart");
    const names: string[] = [];
    body.forEach((_value, name) => {
      names.push(name);
    });
    expect(names.at(-1)).toBe("file");
    const file = body.get("file");
    if (!(file instanceof Blob)) throw new Error("missing ciphertext");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(ciphertext);
    return new Response("do not parse server XML", {
      status: 201,
      headers: { "x-amz-version-id": "opaque/+version", "x-amz-checksum-sha256": checksum },
    });
  });
  const result = await uploadCiphertext(read(), ciphertext, summary, { now: () => 1000, send });
  expect(result).toEqual({ VersionId: "opaque/+version", CiphertextSha256: hash, ObjectBytes: 40 });
  expect(send).toHaveBeenCalledTimes(1);
});
it("refuses changed ciphertext and expired grants before sending", async () => {
  const send = vi.fn<typeof fetch>();
  await expect(uploadCiphertext(read(), new Uint8Array(40), summary, { now: () => 1000, send })).rejects.toThrow();
  await expect(uploadCiphertext(read(), ciphertext, summary, { now: () => 1300, send })).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});
it("treats lost or malformed upload acknowledgements as uncertain and never retries", async () => {
  for (const headers of [
    {},
    { "x-amz-version-id": "null" },
    { "x-amz-version-id": "bad version" },
    { "x-amz-version-id": "ok", "x-amz-checksum-sha256": "wrong" },
  ]) {
    const send = vi.fn<typeof fetch>(async () => new Response("secret upstream body", { status: 201, headers }));
    await expect(uploadCiphertext(read(), ciphertext, summary, { now: () => 1000, send })).rejects.toMatchObject({
      reason: "storage-uncertain",
    });
    expect(send).toHaveBeenCalledTimes(1);
  }
  const send = vi.fn<typeof fetch>(async () => {
    throw new Error("secret signed URL");
  });
  await expect(uploadCiphertext(read(), ciphertext, summary, { now: () => 1000, send })).rejects.toMatchObject({
    reason: "storage-uncertain",
  });
  expect(send).toHaveBeenCalledTimes(1);
});
it("captures cancellation and owns a snapshot across hashing and upload awaits", async () => {
  const controller = new AbortController();
  const send = vi.fn<typeof fetch>();
  const options = { now: () => 1000, send, signal: controller.signal };
  const upload = uploadCiphertext(read(), ciphertext, summary, options);
  options.signal = new AbortController().signal;
  controller.abort();
  await expect(upload).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});
it("refuses a discovery origin with trailing whitespace instead of URL-normalizing it", () => {
  expect(() =>
    readUploadGrant(
      { ...fixture(), Url: `${origin}\n/` },
      {
        origin: `${origin}\n`,
        transferId: id,
        summary,
        now: 1000,
        executeUntil: 4600,
        grantMaxSeconds: 300,
      },
    ),
  ).toThrow();
});
it("cancels in-flight storage I/O, releases listeners and discards response bodies without reading", async () => {
  const controller = new AbortController();
  const added = vi.spyOn(controller.signal, "addEventListener");
  const removed = vi.spyOn(controller.signal, "removeEventListener");
  let reads = 0;
  let cancelled = 0;
  const send = vi.fn<typeof fetch>(async (_url, options) => {
    controller.abort();
    expect(options?.signal?.aborted).toBe(true);
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          reads++;
        },
        cancel() {
          cancelled++;
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(body, {
      status: 201,
      headers: { "x-amz-version-id": "opaque", "x-amz-checksum-sha256": checksum },
    });
  });
  await expect(
    uploadCiphertext(read(), ciphertext, summary, { signal: controller.signal, now: () => 1000, send }),
  ).rejects.toMatchObject({ reason: "storage-uncertain" });
  expect(reads).toBe(0);
  expect(cancelled).toBe(1);
  expect(added).toHaveBeenCalledTimes(1);
  expect(removed).toHaveBeenCalledWith("abort", added.mock.calls[0]?.[1]);
});
it("snapshots caller bytes and checksum before asynchronous work", async () => {
  const bytes = ciphertext.slice();
  const mutableSummary = { ...summary };
  const send = vi.fn<typeof fetch>(async (_url, options) => {
    const body = options?.body;
    if (!(body instanceof FormData)) throw new Error("expected form");
    const file = body.get("file");
    if (!(file instanceof Blob)) throw new Error("expected blob");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(ciphertext);
    return new Response(null, {
      status: 201,
      headers: { "x-amz-version-id": "snapshot", "x-amz-checksum-sha256": checksum },
    });
  });
  const upload = uploadCiphertext(read(), bytes, mutableSummary, { now: () => 1000, send });
  bytes.fill(0);
  mutableSummary.CiphertextSha256 = "0".repeat(64);
  mutableSummary.ObjectBytes = 1;
  await expect(upload).resolves.toMatchObject({ VersionId: "snapshot", CiphertextSha256: hash, ObjectBytes: 40 });
});
it("rechecks the API session immediately before storage dispatch after hashing", async () => {
  const send = vi.fn<typeof fetch>();
  await expect(
    uploadCiphertext(read(), ciphertext, summary, {
      now: () => 1000,
      send,
      beforeSend: () => {
        throw new Error("synthetic session changed");
      },
    }),
  ).rejects.toThrow("synthetic session changed");
  expect(send).not.toHaveBeenCalled();
});
it("does not let response-body cleanup withhold an already verified upload receipt", async () => {
  let cancelled = false;
  const send = vi.fn<typeof fetch>(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>(
          {
            cancel() {
              cancelled = true;
              return new Promise<void>(() => undefined);
            },
          },
          { highWaterMark: 0 },
        ),
        { status: 201, headers: { "x-amz-version-id": "known-version", "x-amz-checksum-sha256": checksum } },
      ),
  );
  const outcome = await Promise.race([
    uploadCiphertext(read(), ciphertext, summary, { now: () => 1000, send }),
    new Promise<string>((resolve) =>
      setTimeout(() => {
        resolve("cleanup stalled");
      }, 100),
    ),
  ]);
  expect(outcome).toMatchObject({ VersionId: "known-version" });
  expect(cancelled).toBe(true);
});
it("accepts only an unambiguous, matching version receipt or confirmed-absence grant", () => {
  const expected = { origin, transferId: id, summary, now: 1000, grantMaxSeconds: 300 };
  const status = {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    TransferId: id,
    State: "prepared",
    ExecuteUntil: 4600,
    RetentionUntil: 605800,
  };
  const Uploaded = { VersionId: "opaque/+version", CiphertextSha256: hash, ObjectBytes: summary.ObjectBytes };
  expect(readUploadControlResult({ ...status, Uploaded }, expected)).toEqual({ kind: "stored", receipt: Uploaded });
  expect(readUploadControlResult({ ...status, Upload: fixture() }, expected).kind).toBe("missing");
  for (const change of [
    { Uploaded: null },
    { Uploaded: { ...Uploaded, VersionId: "null" } },
    { Uploaded: { ...Uploaded, VersionId: "\ud800" } },
    { Uploaded: { ...Uploaded, CiphertextSha256: "0".repeat(64) } },
    { Uploaded: { ...Uploaded, ObjectBytes: summary.ObjectBytes + 1 } },
    { Uploaded: { ...Uploaded, ObjectBytes: Number.MAX_SAFE_INTEGER + 1 } },
    { Uploaded: { ...Uploaded, Key: "injected" } },
    { Upload: fixture() },
    { TransferId: "d".repeat(64) },
    { ExecuteUntil: 999 },
    { State: "executing" },
    { Artifact: {} },
  ])
    expect(() => readUploadControlResult({ ...status, Uploaded, ...change }, expected)).toThrow();
  expect(() => readUploadControlResult(status, expected)).toThrow();
  expect(() => readUploadControlResult({ ResponseCode: "01", ResponseText: "Refused" }, expected)).toThrow("refused");
});
