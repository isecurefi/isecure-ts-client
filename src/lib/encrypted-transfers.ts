import type { components } from "../generated/transfer-api.js";
import { ISecureTransferError } from "./file-transfers.js";

type WireCapability = components["schemas"]["TransferCapabilityResponse"];
export type TransferEnvironment = "test" | "production";
export type EncryptedTransferCapability = Readonly<
  Required<Omit<WireCapability, "RequestId" | "Encodings" | "Delivery">> & {
    Encodings: readonly ("identity" | "gzip")[];
    Delivery: readonly ("inline" | "s3")[];
    RequestId?: string;
  }
>;
export type EncryptedTransferSupport =
  { protocol: "unavailable" } | { protocol: "s3-aead-v1"; capability: EncryptedTransferCapability };

const LIMITS = {
  MaxRawUploadBytes: 32 * 1024 * 1024,
  MaxRawDownloadBytes: 32 * 1024 * 1024,
  MaxInlineRequestBytes: 6 * 1024 * 1024 - 64 * 1024,
  MaxControlBytes: 2 * 1024 * 1024,
  GrantMaxSeconds: 300,
  ExecuteWindowSeconds: 3600,
  DeliveryWindowSeconds: 86400,
  RetentionSeconds: 604800,
} as const;
const REQUIRED = [
  "ResponseCode",
  "ResponseText",
  "ContractVersion",
  "Protocol",
  "ArtifactFormat",
  "Environment",
  "Bank",
  "AccountScope",
  "Encodings",
  "Delivery",
  "S3Origin",
  ...Object.keys(LIMITS),
];
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function choices(value: unknown, allowed: readonly string[], required: string): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= allowed.length &&
    value.every((item: unknown) => typeof item === "string" && allowed.includes(item)) &&
    new Set(value).size === value.length &&
    value.includes(required)
  );
}
/** Authenticated detail response, never inferred from an HTTP error or a URL.
 * Validation and copying precede use; this metadata grants no execution authority. */
export function readEncryptedCapability(
  value: unknown,
  expected: { bank: string; environment: TransferEnvironment },
): EncryptedTransferCapability {
  if (
    !record(value) ||
    !REQUIRED.every((key) => Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !REQUIRED.includes(key) && key !== "RequestId") ||
    value.ResponseCode !== "00" ||
    typeof value.ResponseText !== "string" ||
    value.ResponseText.length > 65536 ||
    new TextEncoder().encode(value.ResponseText).length > 65536 ||
    value.ContractVersion !== 2 ||
    value.Protocol !== "transfer-v1" ||
    value.ArtifactFormat !== "s3-aead-v1" ||
    (value.Environment !== "test" && value.Environment !== "production") ||
    value.Environment !== expected.environment ||
    typeof value.Bank !== "string" ||
    !/^[a-z0-9_-]{1,64}$/.test(value.Bank) ||
    value.Bank !== expected.bank ||
    typeof value.AccountScope !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.AccountScope) ||
    !choices(value.Encodings, ["identity", "gzip"], "identity") ||
    !choices(value.Delivery, ["inline", "s3"], "s3") ||
    typeof value.S3Origin !== "string" ||
    value.S3Origin.length > 256 ||
    !/^https:\/\/[a-z0-9-]+\.s3\.eu-west-1\.amazonaws\.com$/.test(value.S3Origin) ||
    (Object.hasOwn(value, "RequestId") && (typeof value.RequestId !== "string" || value.RequestId.length > 128)) ||
    Object.entries(LIMITS).some(([name, maximum]) => {
      const number = value[name];
      return typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 || number > maximum;
    })
  )
    throw new ISecureTransferError("invalid-response");
  // The closed generated contract is narrowed exactly once after all wire fields
  // have been checked; callers never receive the mutable transport object.
  const wire = value as Required<Omit<WireCapability, "RequestId">> & Pick<WireCapability, "RequestId">;
  if (
    wire.MaxControlBytes > wire.MaxInlineRequestBytes ||
    wire.GrantMaxSeconds > wire.ExecuteWindowSeconds ||
    wire.GrantMaxSeconds > wire.DeliveryWindowSeconds ||
    wire.ExecuteWindowSeconds > wire.RetentionSeconds ||
    wire.DeliveryWindowSeconds > wire.RetentionSeconds
  )
    throw new ISecureTransferError("invalid-response");
  return Object.freeze({
    ...wire,
    Encodings: Object.freeze([...wire.Encodings]),
    Delivery: Object.freeze([...wire.Delivery]),
  });
}
