import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readEncryptedCapability } from "./encrypted-transfers.js";
import { ISecureTransferError } from "./file-transfers.js";

export const encryptedCapability = {
  ResponseCode: "00",
  ResponseText: "Synthetic capability",
  ContractVersion: 2,
  Protocol: "transfer-v1",
  ArtifactFormat: "s3-aead-v1",
  Environment: "test",
  Bank: "simulator",
  AccountScope: "a".repeat(64),
  Encodings: ["identity", "gzip"],
  Delivery: ["inline", "s3"],
  S3Origin: "https://synthetic-transfers.s3.eu-west-1.amazonaws.com",
  MaxRawUploadBytes: 33554432,
  MaxRawDownloadBytes: 33554432,
  MaxInlineRequestBytes: 6225920,
  MaxControlBytes: 2097152,
  GrantMaxSeconds: 300,
  ExecuteWindowSeconds: 3600,
  DeliveryWindowSeconds: 86400,
  RetentionSeconds: 604800,
};
const expected = { bank: "simulator", environment: "test" as const };
describe("explicit encrypted transfer capability", () => {
  it("binds the bank and environment and snapshots immutable metadata", () => {
    const input = structuredClone(encryptedCapability);
    const parsed = readEncryptedCapability(input, expected);
    input.Encodings.length = 0;
    expect(parsed.Encodings).toEqual(["identity", "gzip"]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.Encodings)).toBe(true);
    expect(Object.isFrozen(parsed.Delivery)).toBe(true);
  });
  it("rejects every missing field and unknown field", () => {
    for (const key of Object.keys(encryptedCapability)) {
      const value = Object.fromEntries(Object.entries(encryptedCapability).filter(([name]) => name !== key));
      expect(() => readEncryptedCapability(value, expected)).toThrow(ISecureTransferError);
    }
    expect(() => readEncryptedCapability({ ...encryptedCapability, Private: true }, expected)).toThrow(
      ISecureTransferError,
    );
  });
  it("rejects wrong protocol, scope, security policy and absent success", () => {
    for (const [field, value] of [
      ["ResponseCode", "01"],
      ["ContractVersion", 1],
      ["Protocol", "transfer-v2"],
      ["ArtifactFormat", "plaintext"],
      ["Environment", "production"],
      ["Bank", "other"],
      ["AccountScope", "A".repeat(64)],
      ["Encodings", ["gzip"]],
      ["Encodings", ["identity", "identity"]],
      ["Delivery", ["inline"]],
      ["S3Origin", "http://synthetic-transfers.s3.eu-west-1.amazonaws.com"],
      ["S3Origin", "https://synthetic-transfers.s3.eu-west-1.amazonaws.com.evil.invalid"],
      ["S3Origin", "https://u:p@synthetic-transfers.s3.eu-west-1.amazonaws.com"],
      ["S3Origin", "https://synthetic-transfers.s3.eu-west-1.amazonaws.com/"],
      ["S3Origin", "https://127.0.0.1"],
      ["RequestId", "x".repeat(129)],
    ])
      expect(() => readEncryptedCapability({ ...encryptedCapability, [field as string]: value }, expected)).toThrow(
        ISecureTransferError,
      );
    for (const value of [null, [], true, {}, { ResponseCode: "00" }])
      expect(() => readEncryptedCapability(value, expected)).toThrow(ISecureTransferError);
  });
});

it("rejects final line terminators instead of normalizing context or storage origins", () => {
  for (const ending of ["\n", "\r", "\u2028", "\u2029"]) {
    for (const field of ["AccountScope", "S3Origin", "Bank"] as const) {
      const value = { ...encryptedCapability, [field]: encryptedCapability[field] + ending };
      expect(() => readEncryptedCapability(value, { ...expected, bank: value.Bank })).toThrow(ISecureTransferError);
    }
  }
});

it("bounds every negotiated size and lifetime and rejects inconsistent policies", () => {
  const maxima = {
    MaxRawUploadBytes: 33554432,
    MaxRawDownloadBytes: 33554432,
    MaxInlineRequestBytes: 6225920,
    MaxControlBytes: 2097152,
    GrantMaxSeconds: 300,
    ExecuteWindowSeconds: 3600,
    DeliveryWindowSeconds: 86400,
    RetentionSeconds: 604800,
  };
  for (const [name, maximum] of Object.entries(maxima)) {
    for (const value of [0, -1, 1.5, maximum + 1, Number.MAX_SAFE_INTEGER, Infinity, NaN, "1", null]) {
      expect(() => readEncryptedCapability({ ...encryptedCapability, [name]: value }, expected)).toThrow(
        ISecureTransferError,
      );
    }
  }
  for (const override of [
    { MaxInlineRequestBytes: 1 },
    { ExecuteWindowSeconds: 1 },
    { DeliveryWindowSeconds: 1 },
    { RetentionSeconds: 1 },
  ])
    expect(() => readEncryptedCapability({ ...encryptedCapability, ...override }, expected)).toThrow(
      ISecureTransferError,
    );
  expect(
    readEncryptedCapability(
      {
        ...encryptedCapability,
        RequestId: "synthetic",
        Encodings: ["identity"],
        Delivery: ["s3"],
        Environment: "production",
      },
      { ...expected, environment: "production" },
    ).Environment,
  ).toBe("production");
  for (const bad of ["x".repeat(65537), "ä".repeat(40000)]) {
    expect(() => readEncryptedCapability({ ...encryptedCapability, ResponseText: bad }, expected)).toThrow(
      ISecureTransferError,
    );
  }
});

it("pins the backend export and keeps runtime limits aligned with its schema", () => {
  const bytes = readFileSync(new URL("../../transfer-api.json", import.meta.url));
  const lock = JSON.parse(readFileSync(new URL("../../transfer-contract.lock.json", import.meta.url), "utf8")) as {
    sha256: string;
    source: string;
  };
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(lock.sha256);
  expect(lock.source).toBe("ws-channel-api/transfer-api.json");
  const spec = JSON.parse(bytes.toString("utf8")) as {
    paths: Record<string, Record<string, unknown>>;
    definitions: { TransferCapabilityResponse: { properties: Record<string, { maximum?: number }> } };
  };
  expect(Object.keys(spec.paths)).toHaveLength(7);
  expect(Object.values(spec.paths).every((methods) => !Object.hasOwn(methods, "options"))).toBe(true);
  for (const [key, schema] of Object.entries(spec.definitions.TransferCapabilityResponse.properties)) {
    const maximum = schema.maximum;
    if (maximum !== undefined) {
      expect(() => readEncryptedCapability({ ...encryptedCapability, [key]: maximum }, expected)).not.toThrow();
      expect(() => readEncryptedCapability({ ...encryptedCapability, [key]: maximum + 1 }, expected)).toThrow(
        ISecureTransferError,
      );
    }
  }
});
