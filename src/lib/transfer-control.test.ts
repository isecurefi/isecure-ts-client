import { describe, expect, it } from "vitest";
import { readTransferIntent, readTransferReference, readTransferStatus } from "./transfer-control.js";

const download = {
  Operation: "download",
  Bank: "simulator",
  FileType: "pain.002",
  FileReference: "synthetic",
  AcceptGzip: false,
};
const upload = {
  Operation: "upload",
  Bank: "simulator",
  FileType: "pain.001",
  Storage: "s3",
  Integrity: { RawBytes: 1, Sha256: "a".repeat(64) },
  AcceptGzip: true,
};
const reference = {
  version: 1,
  environment: "test",
  baseUrl: "https://synthetic.example/v2",
  bank: "simulator",
  accountScope: "a".repeat(64),
  clientRequestId: "b".repeat(64),
  intent: download,
};
const status = {
  ResponseCode: "00",
  ResponseText: "Synthetic",
  TransferId: "c".repeat(64),
  State: "prepared",
  ExecuteUntil: 4600,
  RetentionUntil: 605800,
};

describe("closed immutable transfer inputs", () => {
  it("accepts exact original text and both intent variants at the byte boundary", () => {
    const first = readTransferIntent({ ...download, FileType: "ä".repeat(128), TargetId: "original/e\u0301" });
    expect(first.FileType).toHaveLength(128);
    expect(first.TargetId).toBe("original/e\u0301");
    const input = { ...upload, FileName: "synthetic.xml", Integrity: { ...upload.Integrity, RawBytes: 33554432 } };
    const frozen = readTransferIntent(input);
    input.Integrity.RawBytes = 0;
    expect(frozen.Integrity?.RawBytes).toBe(33554432);
    expect(Object.isFrozen(frozen.Integrity)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
  });
  it.each([
    null,
    [],
    {},
    { ...download, Operation: "execute" },
    { ...download, Bank: "simulator\n" },
    { ...download, FileType: "ä".repeat(129) },
    { ...download, FileType: "x".repeat(257) },
    { ...download, FileReference: "" },
    { ...download, FileReference: "x\u0085" },
    { ...download, FileReference: "\ud800" },
    { ...download, TargetId: null },
    { ...download, AcceptGzip: 1 },
    { ...download, Storage: "s3" },
    { ...download, FileName: "x" },
    { ...upload, FileReference: "x" },
    { ...upload, Storage: "url" },
    { ...upload, FileName: "\0" },
    ...[
      null,
      {},
      { RawBytes: 0, Sha256: "a".repeat(64) },
      { RawBytes: 33554433, Sha256: "a".repeat(64) },
      { RawBytes: 1.5, Sha256: "a".repeat(64) },
      { RawBytes: 1, Sha256: "A".repeat(64) },
      { RawBytes: 1, Sha256: "a".repeat(63) + "\n" },
      { ...upload.Integrity, Key: "secret" },
    ].map((Integrity) => ({ ...upload, Integrity })),
  ])("refuses malformed or mixed intent %#", (value) => {
    expect(() => readTransferIntent(value)).toThrow("Invalid file transfer input");
  });
  it("copies closed references and optional canonical transfer IDs", () => {
    const input = { ...reference, intent: { ...download }, transferId: "c".repeat(64) };
    const result = readTransferReference(input);
    input.intent.FileReference = "changed";
    expect(result.intent.FileReference).toBe("synthetic");
    expect(result.transferId).toBe("c".repeat(64));
    expect(Object.isFrozen(result)).toBe(true);
  });
  it.each([
    null,
    {},
    { ...reference, version: 2 },
    { ...reference, environment: "dev" },
    { ...reference, bank: "other" },
    { ...reference, accountScope: "a" },
    { ...reference, transferId: null },
    { ...reference, clientRequestId: "B".repeat(64) },
    { ...reference, Key: "secret" },
    ...[
      "invalid",
      "http://example.test",
      "https://u:p@example.test",
      "https://example.test?q=1",
      "https://example.test#x",
      "https://ex\nample.test",
      "x".repeat(2049),
    ].map((baseUrl) => ({ ...reference, baseUrl })),
  ])("refuses malformed or secret-bearing references %#", (value) => {
    expect(() => readTransferReference(value)).toThrow("Invalid file transfer input");
  });
});

describe("metadata-only control responses", () => {
  it.each(["prepared", "executing", "completed", "failed", "uncertain", "cancelled"])(
    "preserves state %s without implying bank success",
    (State) => {
      const input = {
        ...status,
        State,
        ...(State === "completed" ? { ResponseCode: "01", DeliveryUntil: 87400, DeliveryRevokedAt: 90000 } : {}),
        RequestId: "synthetic",
      };
      const result = readTransferStatus(input, status.TransferId);
      expect(result).toEqual(input);
      expect(Object.isFrozen(result)).toBe(true);
    },
  );
  it("distinguishes explicit refusal without reflecting response text in the error", () => {
    expect(() => readTransferStatus({ ResponseCode: "01", ResponseText: "private detail" })).toThrow(
      "File transfer request was refused",
    );
  });
  it.each([
    null,
    {},
    { ...status, ResponseCode: "" },
    { ...status, ResponseText: "x".repeat(65537) },
    { ...status, RequestId: null },
    { ...status, State: "future" },
    { ...status, TransferId: "a" },
    { ...status, ExecuteUntil: -1 },
    { ...status, ExecuteUntil: 0.5 },
    { ...status, RetentionUntil: 4600 },
    { ...status, RetentionUntil: Number.MAX_SAFE_INTEGER + 1 },
    { ...status, State: "completed" },
    { ...status, DeliveryUntil: 8000 },
    { ...status, State: "completed", DeliveryUntil: 605801 },
    { ...status, State: "completed", DeliveryUntil: null },
    { ...status, DeliveryRevokedAt: 1000 },
    { ...status, State: "completed", DeliveryUntil: 8000, DeliveryRevokedAt: 605800 },
    { ...status, State: "completed", DeliveryUntil: 8000, DeliveryRevokedAt: null },
    ...["Artifact", "Upload", "FilePayload", "Content", "Key"].map((field) => ({ ...status, [field]: "private" })),
  ])("refuses malformed or unexpectedly sensitive response %#", (value) => {
    expect(() => readTransferStatus(value)).toThrow("Invalid file transfer metadata or response");
  });
  it("rejects a response for another transfer", () => {
    expect(() => readTransferStatus(status, "d".repeat(64))).toThrow("Invalid file transfer metadata or response");
  });
});

it("exhaustively rejects control characters and malformed UTF-16 without normalization", () => {
  for (const code of [
    ...Array.from({ length: 32 }, (_, i) => i),
    ...Array.from({ length: 33 }, (_, i) => i + 127),
    0xd800,
    0xdbff,
    0xdc00,
    0xdfff,
  ]) {
    expect(() =>
      readTransferIntent({ ...download, FileReference: `prefix${String.fromCharCode(code)}suffix` }),
    ).toThrow();
  }
  for (const [character, width] of [
    ["a", 1],
    ["ä", 2],
    ["€", 3],
    ["𐀀", 4],
  ] as const) {
    const count = Math.floor(256 / width);
    const FileReference = character.repeat(count);
    expect(readTransferIntent({ ...download, FileReference }).FileReference).toBe(FileReference);
    expect(() => readTransferIntent({ ...download, FileReference: character.repeat(count + 1) })).toThrow();
  }
});

it("preserves a leading Unicode BOM as data, matching Rust string validation", () => {
  const FileReference = "\ufeffsynthetic";
  expect(readTransferIntent({ ...download, FileReference }).FileReference).toBe(FileReference);
});
