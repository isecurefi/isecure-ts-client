import { expect, it } from "vitest";
import { PendingUpload } from "./transfer-upload.js";
import { encodeTransferRepresentation } from "./transfer-representation.js";
import { AeadContext, openEncoded } from "./transfer-aead.js";

it("binds the encoded fingerprint before sealing and retains exact ciphertext for retries", async () => {
  const raw = new Uint8Array(4096).fill(42);
  const original = (await encodeTransferRepresentation(raw, false)).integrity;
  const reference = {
    version: 1 as const,
    environment: "test" as const,
    baseUrl: "https://synthetic.test/v2",
    bank: "simulator",
    accountScope: "a".repeat(64),
    clientRequestId: "b".repeat(64),
    transferId: "c".repeat(64),
    intent: {
      Operation: "upload" as const,
      Bank: "simulator",
      FileType: "pain.001",
      Storage: "s3" as const,
      Integrity: original,
      AcceptGzip: true,
    },
  };
  const pending = await PendingUpload.create(reference, raw);
  const Context = {
    Environment: "test",
    AccountScope: reference.accountScope,
    TransferId: reference.transferId,
    ArtifactId: "d".repeat(64),
    Purpose: "upload",
    Encoding: pending.preparation.Encoding,
    OriginalBytes: raw.length,
    EncodedBytes: pending.preparation.EncodedBytes,
    OriginalSha256: original.Sha256,
  };
  const Artifact = {
    Format: "s3-aead-v1",
    Context,
    EncodedSha256: pending.preparation.EncodedSha256,
    Nonce: btoa("n".repeat(12)),
    Key: btoa("k".repeat(32)),
  };
  const reply = {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    TransferId: reference.transferId,
    State: "prepared",
    ExecuteUntil: 4600,
    RetentionUntil: 605800,
    Artifact,
  };
  const summary = await pending.seal(reply, 1000);
  expect(summary.ObjectBytes).toBe(pending.preparation.EncodedBytes + 36);
  const frozen = pending.copyCiphertext();
  expect(
    await openEncoded(AeadContext.parse(Context), new Uint8Array(12).fill(110), new Uint8Array(32).fill(107), frozen),
  ).toHaveLength(pending.preparation.EncodedBytes);
  expect(await pending.seal(reply, 1000)).toEqual(summary);
  expect(pending.copyCiphertext()).toEqual(frozen);
  frozen.fill(0);
  expect(pending.copyCiphertext()).not.toEqual(frozen);
  expect(JSON.stringify(pending)).not.toContain(Artifact.Key);
  pending.dispose();
  expect(() => pending.copyCiphertext()).toThrow();
});

async function fixture() {
  const raw = new Uint8Array(4096).fill(42);
  const original = (await encodeTransferRepresentation(raw, false)).integrity;
  const reference = {
    version: 1 as const,
    environment: "test" as const,
    baseUrl: "https://synthetic.test/v2",
    bank: "simulator",
    accountScope: "a".repeat(64),
    clientRequestId: "b".repeat(64),
    transferId: "c".repeat(64),
    intent: {
      Operation: "upload" as const,
      Bank: "simulator",
      FileType: "pain.001",
      Storage: "s3" as const,
      Integrity: original,
      AcceptGzip: true,
    },
  };
  const pending = await PendingUpload.create(reference, raw);
  const reply = {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    TransferId: reference.transferId,
    State: "prepared",
    ExecuteUntil: 4600,
    RetentionUntil: 605800,
    Artifact: {
      Format: "s3-aead-v1",
      Context: {
        Environment: "test",
        AccountScope: reference.accountScope,
        TransferId: reference.transferId,
        ArtifactId: "d".repeat(64),
        Purpose: "upload",
        Encoding: pending.preparation.Encoding,
        OriginalBytes: raw.length,
        EncodedBytes: pending.preparation.EncodedBytes,
        OriginalSha256: original.Sha256,
      },
      EncodedSha256: pending.preparation.EncodedSha256,
      Nonce: btoa("n".repeat(12)),
      Key: btoa("k".repeat(32)),
    },
  };
  return { pending, reply, raw, reference };
}
it("refuses context, representation, metadata and key substitution before providing ciphertext", async () => {
  for (const [field, value] of [
    ["Environment", "production"],
    ["Purpose", "download"],
    ["AccountScope", "e".repeat(64)],
    ["TransferId", "e".repeat(64)],
    ["ArtifactId", "E".repeat(64)],
    ["Encoding", "identity"],
    ["EncodedBytes", 1],
    ["OriginalBytes", 4097],
    ["OriginalSha256", "e".repeat(64)],
    ["unknown", 1],
  ] as const) {
    const { pending, reply } = await fixture();
    await expect(
      pending.seal(
        { ...reply, Artifact: { ...reply.Artifact, Context: { ...reply.Artifact.Context, [field]: value } } },
        1000,
      ),
    ).rejects.toThrow();
    expect(() => pending.copyCiphertext()).toThrow();
    pending.dispose();
  }
  for (const change of [
    { Format: "other" },
    { EncodedSha256: "e".repeat(64) },
    { EncodedSha256: undefined },
    { Key: "invalid" },
    { Nonce: "invalid" },
    { CiphertextSha256: null },
    { CiphertextSha256: "e".repeat(64) },
    { WrappedKey: "must-not-leak" },
  ]) {
    const { pending, reply } = await fixture();
    await expect(pending.seal({ ...reply, Artifact: { ...reply.Artifact, ...change } }, 1000)).rejects.toThrow();
    expect(() => pending.copyCiphertext()).toThrow();
    pending.dispose();
  }
  for (const change of [
    { Artifact: null },
    { FilePayload: {} },
    { State: "executing" },
    { ExecuteUntil: 999 },
    { TransferId: "e".repeat(64) },
    { ResponseCode: "01" },
  ]) {
    const { pending, reply } = await fixture();
    await expect(pending.seal({ ...reply, ...change }, 1000)).rejects.toThrow();
    pending.dispose();
  }
});
it("rejects changed original bytes without recompressing and snapshots a fresh upload", async () => {
  const { reference, raw, pending } = await fixture();
  await pending.requireOriginal(raw);
  const changed = raw.slice();
  changed[0] = 0;
  await expect(pending.requireOriginal(changed)).rejects.toMatchObject({ reason: "invalid-input" });
  await expect(PendingUpload.create(reference, changed)).rejects.toMatchObject({ reason: "invalid-input" });
  await expect(PendingUpload.create(reference, new Uint8Array(1))).rejects.toThrow();
  const created = PendingUpload.create(reference, raw);
  raw.fill(0);
  const snapshot = await created;
  expect(snapshot.preparation).toEqual(pending.preparation);
  expect(Object.isFrozen(snapshot.preparation)).toBe(true);
  snapshot.dispose();
  pending.dispose();
});
it("prevents overlapping encryption and withholds results after disposal or cancellation", async () => {
  const { pending, reply, raw } = await fixture();
  const first = pending.seal(reply, 1000);
  await expect(pending.seal(reply, 1000)).rejects.toMatchObject({ reason: "in-progress" });
  pending.dispose();
  await expect(first).rejects.toThrow();
  await expect(pending.seal(reply, 1000)).rejects.toThrow();
  await expect(pending.requireOriginal(raw)).rejects.toThrow();
  const next = await fixture();
  const controller = new AbortController();
  const aborted = next.pending.seal(next.reply, 1000, { signal: controller.signal });
  controller.abort();
  await expect(aborted).rejects.toThrow();
  expect(() => next.pending.copyCiphertext()).toThrow();
  await expect(next.pending.seal(next.reply, 1000)).resolves.toHaveProperty("CiphertextSha256");
  next.pending.dispose();
});

it("keeps the original cancellation signal across crypto awaits", async () => {
  const { pending, reply } = await fixture();
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const sealing = pending.seal(reply, 1000, options);
  options.signal = new AbortController().signal;
  controller.abort();
  await expect(sealing).rejects.toThrow();
  expect(() => pending.copyCiphertext()).toThrow();
  pending.dispose();
});
