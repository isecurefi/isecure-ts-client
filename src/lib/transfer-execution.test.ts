import { expect, it } from "vitest";
import { prepareExecution } from "./transfer-execution.js";
import { encodeTransferRepresentation } from "./transfer-representation.js";
import type { TransferReference } from "./transfer-control.js";
import type { EncryptedTransferCapability } from "./encrypted-transfers.js";
async function fixture() {
  const bytes = new Uint8Array(4096).fill(42);
  const { integrity } = await encodeTransferRepresentation(bytes, false);
  const reference: TransferReference = {
    version: 1,
    environment: "test",
    baseUrl: "https://synthetic.test/v2",
    bank: "simulator",
    accountScope: "a".repeat(64),
    clientRequestId: "b".repeat(64),
    transferId: "c".repeat(64),
    intent: {
      Operation: "upload",
      Bank: "simulator",
      FileType: "pain.001",
      Storage: "inline",
      Integrity: integrity,
      AcceptGzip: true,
    },
  };
  const capability = {
    MaxRawUploadBytes: 32 * 1024 * 1024,
    MaxInlineRequestBytes: 6225920,
    MaxControlBytes: 2097152,
    Encodings: ["identity", "gzip"],
    Delivery: ["inline", "s3"],
  } as EncryptedTransferCapability;
  return { bytes, reference, capability };
}
it("freezes original bytes, uses negotiated gzip and budgets actual escaped signature metadata", async () => {
  const f = await fixture();
  const pending = prepareExecution(f.reference, f.capability, { bytes: f.bytes, signature: 'synthetic\n"signature' });
  f.bytes.fill(0);
  const result = await pending;
  expect(result.Payload).toMatchObject({ Kind: "inline", Encoding: "gzip" });
  expect(result.Signature).toBe('synthetic\n"signature');
  const bytes = new Uint8Array(4096).fill(42);
  const exact = new TextEncoder().encode(JSON.stringify(result)).length;
  await expect(
    prepareExecution(
      f.reference,
      { ...f.capability, MaxInlineRequestBytes: exact },
      { bytes, signature: result.Signature },
    ),
  ).resolves.toEqual(result);
  await expect(
    prepareExecution(
      f.reference,
      { ...f.capability, MaxInlineRequestBytes: exact - 1 },
      { bytes, signature: result.Signature },
    ),
  ).rejects.toMatchObject({ reason: "size" });
});
it("rejects changed originals, mixed variants, malformed signatures and missing S3 receipts before execution", async () => {
  const f = await fixture();
  await expect(prepareExecution(f.reference, f.capability, { bytes: new Uint8Array(4096) })).rejects.toThrow();
  for (const signature of ["", "é", "a".repeat(1048577)])
    await expect(prepareExecution(f.reference, f.capability, { bytes: f.bytes, signature })).rejects.toThrow();
  const s3 = { ...f.reference, intent: { ...f.reference.intent, Storage: "s3" as const } } as TransferReference;
  await expect(prepareExecution(s3, f.capability, {})).rejects.toThrow();
  const receipt = { VersionId: "synthetic-version", CiphertextSha256: "d".repeat(64), ObjectBytes: 100 };
  await expect(prepareExecution(s3, f.capability, { signature: "synthetic" }, receipt)).resolves.toEqual({
    Signature: "synthetic",
    Payload: { Kind: "s3", Version: "synthetic-version" },
  });
  await expect(prepareExecution(s3, f.capability, { bytes: f.bytes }, receipt)).rejects.toThrow();
});
