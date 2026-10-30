import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { PendingDelivery } from "./transfer-delivery.js";
import { sha256TransferBytes } from "./transfer-representation.js";
import type { TransferReference } from "./transfer-control.js";
import type { EncryptedTransferCapability } from "./encrypted-transfers.js";
const vectors = JSON.parse(
  readFileSync(new URL("../../test-vectors/s3-aead-v1/vectors.json", import.meta.url), "utf8"),
) as {
  artifactVectors: {
    id: string;
    context: Record<string, unknown>;
    key: string;
    nonce: string;
    encoded: string;
    object: string;
    original: string;
  }[];
};
const raw = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));
const base64 = (hex: string) => Buffer.from(hex, "hex").toString("base64");
async function fixture(name = "gzip") {
  const vector = vectors.artifactVectors.find((v) => v.id === name);
  if (!vector) throw new Error("Missing synthetic vector");
  const context = vector.context;
  const reference: TransferReference = {
    version: 1,
    environment: context.Environment as "test",
    accountScope: context.AccountScope as string,
    transferId: context.TransferId as string,
    bank: "simulator",
    baseUrl: "https://synthetic.test/v2",
    clientRequestId: "b".repeat(64),
    intent: {
      Operation: "download",
      Bank: "simulator",
      FileType: "synthetic",
      FileReference: "synthetic-file",
      AcceptGzip: true,
    },
  };
  const capability = {
    S3Origin: "https://synthetic.s3.eu-west-1.amazonaws.com",
    MaxRawDownloadBytes: 32 * 1024 * 1024,
    GrantMaxSeconds: 300,
    Encodings: ["identity", "gzip"],
    Delivery: ["inline", "s3"],
  } as EncryptedTransferCapability;
  const status = {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    TransferId: reference.transferId,
    State: "completed",
    ExecuteUntil: 4600,
    RetentionUntil: 605800,
    DeliveryUntil: 87400,
  };
  const url = new URL(
    `${capability.S3Origin}/transfers/${reference.transferId}/${String(context.ArtifactId)}/download`,
  );
  for (const [k, v] of Object.entries({
    versionId: "synthetic-version",
    "response-content-type": "application/octet-stream",
    "response-cache-control": "no-store",
    "response-content-disposition": 'attachment; filename="download.bin"',
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "SYNTHETIC/20261030/eu-west-1/s3/aws4_request",
    "X-Amz-Date": "20261030T000000Z",
    "X-Amz-Expires": "300",
    "X-Amz-SignedHeaders": "host",
    "X-Amz-Signature": "e".repeat(64),
  }))
    url.searchParams.set(k, v);
  const reply = {
    ...status,
    FilePayload: {
      Kind: "s3",
      Encoding: context.Encoding,
      RawBytes: context.OriginalBytes,
      Sha256: context.OriginalSha256,
      TransferId: reference.transferId,
      Url: url.href,
      ExpiresAt: 1300,
    },
    Artifact: {
      Format: "s3-aead-v1",
      Context: context,
      Key: base64(vector.key),
      Nonce: base64(vector.nonce),
      EncodedSha256: await sha256TransferBytes(raw(vector.encoded)),
      CiphertextSha256: await sha256TransferBytes(raw(vector.object)),
    },
  };
  const inline = {
    ...status,
    FilePayload: {
      Kind: "inline",
      Encoding: context.Encoding,
      RawBytes: context.OriginalBytes,
      Sha256: context.OriginalSha256,
      Data: base64(vector.encoded),
    },
  };
  const send = vi.fn<typeof fetch>(
    async () => new Response(raw(vector.object), { headers: { "x-amz-version-id": "synthetic-version" } }),
  );
  return { reference, capability, reply, inline, send, vector, status };
}
it("delivers independently verified Rust-compatible encrypted vectors and inline files with the same integrity rules", async () => {
  for (const name of ["block-minus-one", "block", "gzip"]) {
    const f = await fixture(name);
    for (const reply of [f.reply, f.inline]) {
      const pending = PendingDelivery.parse(reply, f.reference, f.capability, 1000);
      expect(JSON.stringify(pending)).not.toContain(f.reply.Artifact.Key);
      expect(await pending.receive({ send: f.send, now: () => 1000 })).toEqual(raw(f.vector.original));
      await expect(pending.receive({ send: f.send, now: () => 1000 })).rejects.toThrow();
    }
    expect(f.send).toHaveBeenCalledTimes(1);
  }
});
it("preserves metadata-only and bank-error outcomes without creating another bank request", async () => {
  const f = await fixture();
  const pending = PendingDelivery.parse({ ...f.status, ResponseCode: "01" }, f.reference, f.capability, 1000);
  expect(pending.status.ResponseCode).toBe("01");
  expect(await pending.receive({ send: f.send, now: () => 1000 })).toBeUndefined();
  expect(f.send).not.toHaveBeenCalled();
});
it("withholds bytes from sinks on tampering, changed authority, failed decoding and cancellation", async () => {
  for (const change of [{ Key: base64("11".repeat(32)) }, { EncodedSha256: "e".repeat(64) }]) {
    const f = await fixture();
    const sink = vi.fn();
    const pending = PendingDelivery.parse(
      { ...f.reply, Artifact: { ...f.reply.Artifact, ...change } },
      f.reference,
      f.capability,
      1000,
    );
    await expect(pending.receiveTo(sink, { send: f.send, now: () => 1000 })).rejects.toThrow();
    expect(sink).not.toHaveBeenCalled();
  }
  const f = await fixture();
  const sink = vi.fn();
  const controller = new AbortController();
  const pending = PendingDelivery.parse(f.reply, f.reference, f.capability, 1000);
  const sending = pending.receiveTo(sink, {
    now: () => 1000,
    signal: controller.signal,
    send: async () => {
      controller.abort();
      return new Response(raw(f.vector.object));
    },
  });
  await expect(sending).rejects.toThrow();
  expect(sink).not.toHaveBeenCalled();
  const inline = PendingDelivery.parse(
    { ...f.inline, FilePayload: { ...f.inline.FilePayload, Data: base64("11".repeat(63)) } },
    f.reference,
    f.capability,
    1000,
  );
  await expect(inline.receiveTo(sink, { now: () => 1000 })).rejects.toThrow();
  expect(sink).not.toHaveBeenCalled();
  const changed = PendingDelivery.parse(f.inline, f.reference, f.capability, 1000);
  await expect(
    changed.receiveTo(sink, {
      now: () => 1000,
      beforeRelease: () => {
        throw new Error("session changed");
      },
    }),
  ).rejects.toThrow();
  expect(sink).not.toHaveBeenCalled();
});
it("rejects ambiguous, malformed, expired and cross-context delivery before storage effects", async () => {
  const f = await fixture();
  for (const reply of [
    { ...f.reply, Unknown: true },
    { ...f.reply, State: "executing" },
    { ...f.reply, DeliveryUntil: 1000 },
    { ...f.reply, DeliveryRevokedAt: 999 },
    { ...f.inline, Artifact: f.reply.Artifact },
    { ...f.reply, Artifact: undefined },
    { ...f.reply, FilePayload: undefined },
    { ...f.reply, Artifact: { ...f.reply.Artifact, CiphertextSha256: undefined } },
    { ...f.reply, Artifact: { ...f.reply.Artifact, Context: { ...f.reply.Artifact.Context, Purpose: "upload" } } },
    { ...f.reply, FilePayload: { ...f.reply.FilePayload, Data: "bad" } },
    { ...f.reply, FilePayload: { ...f.reply.FilePayload, RawBytes: 1 } },
    { ...f.reply, FilePayload: { ...f.reply.FilePayload, TransferId: "e".repeat(64) } },
    { ...f.inline, FilePayload: { ...f.inline.FilePayload, Data: `${f.inline.FilePayload.Data}\n` } },
    { ...f.inline, FilePayload: { ...f.inline.FilePayload, RawBytes: 32 * 1024 * 1024 + 1 } },
  ])
    expect(() => PendingDelivery.parse(reply, f.reference, f.capability, 1000)).toThrow();
});
it("withholds released or expired material across crypto waits and clears borrowed sink bytes", async () => {
  const f = await fixture();
  const released = PendingDelivery.parse(f.reply, f.reference, f.capability, 1000);
  await expect(
    released.receive({
      now: () => 1000,
      send: async () => {
        released.dispose();
        return new Response(raw(f.vector.object), { headers: { "x-amz-version-id": "synthetic-version" } });
      },
    }),
  ).rejects.toThrow();
  const invalidClock = PendingDelivery.parse(f.inline, f.reference, f.capability, 1000);
  let calls = 0;
  await expect(invalidClock.receive({ now: () => (++calls === 1 ? 1000 : Number.NaN) })).rejects.toThrow();
  const delivered = PendingDelivery.parse(f.inline, f.reference, f.capability, 1000);
  let borrowed: Uint8Array | undefined;
  await delivered.receiveTo(
    (bytes) => {
      expect(bytes).toEqual(raw(f.vector.original));
      borrowed = bytes;
    },
    { now: () => 1000 },
  );
  expect(borrowed?.every((b) => b === 0)).toBe(true);
});
it("distinguishes an empty receipt from absent content and preserves bank failure metadata", async () => {
  const f = await fixture();
  const reply = {
    ...f.status,
    ResponseCode: "01",
    FilePayload: {
      Kind: "inline",
      Encoding: "identity",
      RawBytes: 0,
      Sha256: await sha256TransferBytes(new Uint8Array()),
      Data: "",
    },
  };
  const pending = PendingDelivery.parse(reply, f.reference, f.capability, 1000);
  const sink = vi.fn();
  await pending.receiveTo(sink, { now: () => 1000 });
  expect(sink).toHaveBeenCalledTimes(1);
  expect(sink).toHaveBeenCalledWith(new Uint8Array());
  expect(pending.status.ResponseCode).toBe("01");
});
it("refuses unnegotiated compression and storage, malformed integrity and expired deferred reception", async () => {
  const f = await fixture();
  for (const capability of [
    { ...f.capability, Encodings: ["identity"] as const },
    { ...f.capability, Delivery: ["inline"] as const },
    { ...f.capability, MaxRawDownloadBytes: 1 },
  ]) {
    expect(() => PendingDelivery.parse(f.reply, f.reference, capability, 1000)).toThrow();
  }
  expect(() =>
    PendingDelivery.parse(
      f.reply,
      { ...f.reference, intent: { ...f.reference.intent, AcceptGzip: false } },
      f.capability,
      1000,
    ),
  ).toThrow();
  for (const patch of [{ Encoding: "other" }, { RawBytes: -1 }, { Sha256: "E".repeat(64) }, { Kind: "plain" }]) {
    expect(() =>
      PendingDelivery.parse(
        { ...f.reply, FilePayload: { ...f.reply.FilePayload, ...patch } },
        f.reference,
        f.capability,
        1000,
      ),
    ).toThrow();
  }
  const expired = PendingDelivery.parse(f.inline, f.reference, f.capability, 1000);
  await expect(expired.receive({ now: () => 87400 })).rejects.toThrow();
  const disposed = PendingDelivery.parse(f.inline, f.reference, f.capability, 1000);
  disposed.dispose();
  await expect(disposed.receive({ now: () => 1000 })).rejects.toThrow();
  expect(() =>
    PendingDelivery.parse({ ResponseCode: "01", ResponseText: "Denied" }, f.reference, f.capability, 1000),
  ).toThrow(expect.objectContaining({ reason: "refused" }));
});
it("captures cancellation before asynchronous work and never gives a cancelled sink bytes", async () => {
  const f = await fixture();
  const sink = vi.fn();
  const controller = new AbortController();
  const effects = { now: () => 1000, signal: controller.signal };
  const pending = PendingDelivery.parse(f.inline, f.reference, f.capability, 1000);
  const receiving = pending.receiveTo(sink, effects);
  effects.signal = new AbortController().signal;
  controller.abort();
  await expect(receiving).rejects.toThrow();
  expect(sink).not.toHaveBeenCalled();
  const next = PendingDelivery.parse(f.inline, f.reference, f.capability, 1000);
  const cancellation = new AbortController();
  let checks = 0;
  await expect(
    next.receiveTo(sink, {
      now: () => 1000,
      signal: cancellation.signal,
      beforeRelease: () => {
        if (++checks === 2) cancellation.abort();
      },
    }),
  ).rejects.toThrow();
  expect(sink).not.toHaveBeenCalled();
});
