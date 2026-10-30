import { expect, it, vi } from "vitest";
import { PendingUpload } from "./transfer-upload.js";
import { encodeTransferRepresentation } from "./transfer-representation.js";
async function fixture() {
  const bytes = new Uint8Array(4096).fill(42);
  const { integrity } = await encodeTransferRepresentation(bytes, false);
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
      Integrity: integrity,
      AcceptGzip: true,
    },
  };
  const pending = await PendingUpload.create(reference, bytes);
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
        EncodedBytes: pending.preparation.EncodedBytes,
        OriginalBytes: bytes.length,
        OriginalSha256: integrity.Sha256,
      },
      EncodedSha256: pending.preparation.EncodedSha256,
      Key: btoa("k".repeat(32)),
      Nonce: btoa("n".repeat(12)),
    },
  };
  await pending.seal(reply, 1000);
  return { pending, reply, reference, bytes };
}
it("restores exact saved ciphertext after JSON roundtrip without recompressing or encrypting again", async () => {
  const f = await fixture();
  const saved = f.pending.save();
  const ciphertext = f.pending.copyCiphertext();
  const text = JSON.stringify(saved);
  expect(text).not.toContain(f.reply.Artifact.Key);
  expect(text).not.toContain("Nonce");
  const restored = await PendingUpload.fromSaved(f.reference, JSON.parse(text) as unknown, ciphertext);
  expect(restored.summary).toBeUndefined();
  expect(() => restored.copyCiphertext()).toThrow();
  const encrypt = vi.spyOn(crypto.subtle, "encrypt").mockRejectedValue(new Error("Restore must never encrypt"));
  let summary;
  try {
    summary = await restored.seal(f.reply, 1000);
  } finally {
    encrypt.mockRestore();
  }
  expect(summary).toEqual(f.pending.summary);
  expect(restored.copyCiphertext()).toEqual(ciphertext);
  ciphertext.fill(0);
  expect(restored.copyCiphertext()).not.toEqual(ciphertext);
  restored.dispose();
  f.pending.dispose();
});
it("rejects saved scopes, metadata and ciphertext tampering before providing a usable upload", async () => {
  const f = await fixture();
  const saved = f.pending.save();
  const ciphertext = f.pending.copyCiphertext();
  for (const value of [
    null,
    { ...saved, version: 2 },
    { ...saved, Key: "not allowed" },
    { ...saved, reference: { ...saved.reference, accountScope: "e".repeat(64) } },
    { ...saved, prepared: { ...saved.prepared, ObjectBytes: ciphertext.length + 1 } },
    { ...saved, prepared: { ...saved.prepared, Encoding: "other" } },
  ])
    await expect(PendingUpload.fromSaved(f.reference, value, ciphertext)).rejects.toThrow();
  const changed = ciphertext.slice();
  changed[changed.length - 1] = (changed[changed.length - 1] ?? 0) ^ 1;
  await expect(PendingUpload.fromSaved(f.reference, saved, changed)).rejects.toThrow();
  const restored = await PendingUpload.fromSaved(f.reference, saved, ciphertext);
  await expect(
    restored.seal({ ...f.reply, Artifact: { ...f.reply.Artifact, Key: btoa("x".repeat(32)) } }, 1000),
  ).rejects.toThrow();
  expect(restored.summary).toBeUndefined();
  expect(() => restored.copyCiphertext()).toThrow();
  restored.dispose();
  f.pending.dispose();
});
it("accepts reordered JSON keys but never silently changes context strings", async () => {
  const f = await fixture();
  const saved = f.pending.save();
  const reversed = {
    ...saved,
    reference: { ...saved.reference, intent: Object.fromEntries(Object.entries(saved.reference.intent).reverse()) },
  };
  const restored = await PendingUpload.fromSaved(f.reference, reversed, f.pending.copyCiphertext());
  await restored.seal(f.reply, 1000);
  expect(restored.save()).toEqual(saved);
  for (const value of [
    { ...saved, reference: { ...saved.reference, baseUrl: `${saved.reference.baseUrl}/` } },
    { ...saved, prepared: { ...saved.prepared, EncodedSha256: saved.prepared.EncodedSha256.toUpperCase() } },
  ])
    await expect(PendingUpload.fromSaved(f.reference, value, f.pending.copyCiphertext())).rejects.toThrow();
  restored.dispose();
  f.pending.dispose();
});
it("authenticates self-consistent saved-file tampering against the API key material", async () => {
  const { sha256TransferBytes } = await import("./transfer-representation.js");
  const f = await fixture();
  const saved = f.pending.save();
  const changed = f.pending.copyCiphertext();
  changed[changed.length - 1] = (changed[changed.length - 1] ?? 0) ^ 1;
  const forged = { ...saved, prepared: { ...saved.prepared, CiphertextSha256: await sha256TransferBytes(changed) } };
  const restored = await PendingUpload.fromSaved(f.reference, forged, changed);
  await expect(restored.seal(f.reply, 1000)).rejects.toThrow();
  expect(() => restored.save()).toThrow();
  expect(() => restored.copyCiphertext()).toThrow();
  restored.dispose();
  f.pending.dispose();
});
it("keeps cancellation captured and rejects interrupted or disposed restoration", async () => {
  const f = await fixture();
  const saved = f.pending.save();
  const ciphertext = f.pending.copyCiphertext();
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const importing = PendingUpload.fromSaved(f.reference, saved, ciphertext, options);
  options.signal = new AbortController().signal;
  controller.abort();
  await expect(importing).rejects.toThrow();
  const restored = await PendingUpload.fromSaved(f.reference, saved, ciphertext);
  const confirming = restored.seal(f.reply, 1000);
  restored.dispose();
  await expect(confirming).rejects.toThrow();
  expect(() => restored.copyCiphertext()).toThrow();
  f.pending.dispose();
});
it("rejects authenticated but corrupt compressed data before confirming restored upload", async () => {
  const { AeadContext, sealEncoded } = await import("./transfer-aead.js");
  const { sha256TransferBytes } = await import("./transfer-representation.js");
  const f = await fixture();
  const saved = f.pending.save();
  const corrupt = new Uint8Array(saved.prepared.EncodedBytes);
  const key = new Uint8Array(32).fill(113);
  const nonce = new Uint8Array(12).fill(115);
  const context = AeadContext.parse(f.reply.Artifact.Context);
  const ciphertext = await sealEncoded(context, nonce, key, corrupt);
  const EncodedSha256 = await sha256TransferBytes(corrupt);
  const CiphertextSha256 = await sha256TransferBytes(ciphertext);
  const stored = { ...saved, prepared: { ...saved.prepared, EncodedSha256, CiphertextSha256 } };
  const reply = {
    ...f.reply,
    Artifact: {
      ...f.reply.Artifact,
      EncodedSha256,
      CiphertextSha256,
      Key: btoa("q".repeat(32)),
      Nonce: btoa("s".repeat(12)),
    },
  };
  const restored = await PendingUpload.fromSaved(f.reference, stored, ciphertext);
  await expect(restored.seal(reply, 1000)).rejects.toThrow();
  expect(restored.summary).toBeUndefined();
  expect(() => restored.save()).toThrow();
  restored.dispose();
  f.pending.dispose();
  key.fill(0);
  nonce.fill(0);
});
