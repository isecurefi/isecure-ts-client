import type { components } from "../generated/transfer-api.js";
import type { EncryptedTransferCapability, TransferEnvironment } from "./encrypted-transfers.js";
import { ISecureTransferError } from "./file-transfers.js";

type WireIntent = components["schemas"]["TransferIntent"];
type CommonIntent = Pick<WireIntent, "Bank" | "FileType" | "TargetId" | "AcceptGzip">;
export type TransferIntent = Readonly<
  CommonIntent &
    (
      | { Operation: "download"; FileReference: string; Storage?: never; Integrity?: never; FileName?: never }
      | {
          Operation: "upload";
          Storage: "inline" | "s3";
          Integrity: Readonly<components["schemas"]["TransferIntegrity"]>;
          FileName?: string;
          FileReference?: never;
        }
    )
>;
/** Resumable metadata only. File selectors can still be private customer information. */
export interface TransferReference {
  readonly version: 1;
  readonly environment: TransferEnvironment;
  readonly baseUrl: string;
  readonly bank: string;
  readonly accountScope: string;
  readonly clientRequestId: string;
  readonly intent: TransferIntent;
  readonly transferId?: string;
}
type WireResponse = components["schemas"]["TransferResponse"];
export type TransferStatus = Readonly<
  Required<
    Pick<WireResponse, "ResponseCode" | "ResponseText" | "TransferId" | "State" | "ExecuteUntil" | "RetentionUntil">
  > &
    Pick<WireResponse, "DeliveryUntil" | "DeliveryRevokedAt" | "RequestId">
>;
const STATES = ["prepared", "executing", "completed", "failed", "uncertain", "cancelled"];
function object(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function closed(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  );
}
export function isTransferId(value: unknown): value is string {
  return typeof value === "string" && value.length === 64 && !/[^a-f0-9]/u.test(value);
}
function text(value: unknown, maximum: number, empty = false): value is string {
  if (typeof value !== "string" || (!empty && value.length === 0) || value.length > maximum || /[\p{Cc}]/u.test(value))
    return false;
  const bytes = new TextEncoder().encode(value);
  return bytes.length <= maximum && new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) === value;
}
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
export function readTransferIntegrity(value: unknown): Readonly<components["schemas"]["TransferIntegrity"]> {
  if (
    !object(value) ||
    !closed(value, ["RawBytes", "Sha256"]) ||
    !integer(value.RawBytes, 32 * 1024 * 1024) ||
    !isTransferId(value.Sha256)
  )
    throw new ISecureTransferError("invalid-input");
  return Object.freeze({ RawBytes: value.RawBytes, Sha256: value.Sha256 });
}
/** Validate before copying or sending. No text normalization or unknown field stripping. */
export function readTransferIntent(value: unknown): TransferIntent {
  const invalid = () => new ISecureTransferError("invalid-input");
  if (
    !object(value) ||
    !text(value.Bank, 64) ||
    /[^a-z0-9_-]/u.test(value.Bank) ||
    !text(value.FileType, 256) ||
    typeof value.AcceptGzip !== "boolean" ||
    (Object.hasOwn(value, "TargetId") && !text(value.TargetId, 256))
  )
    throw invalid();
  const common = ["Operation", "Bank", "FileType", "AcceptGzip"];
  if (value.Operation === "download") {
    if (!closed(value, [...common, "FileReference"], ["TargetId"]) || !text(value.FileReference, 256)) throw invalid();
  } else if (value.Operation === "upload") {
    if (
      !closed(value, [...common, "Storage", "Integrity"], ["TargetId", "FileName"]) ||
      (value.Storage !== "s3" && value.Storage !== "inline") ||
      (Object.hasOwn(value, "FileName") && !text(value.FileName, 256)) ||
      readTransferIntegrity(value.Integrity).RawBytes === 0
    )
      throw invalid();
  } else throw invalid();
  const wire = value as TransferIntent;
  return wire.Operation === "upload"
    ? Object.freeze({ ...wire, Integrity: Object.freeze({ ...wire.Integrity }) })
    : Object.freeze({ ...wire });
}
export function readTransferReference(value: unknown): TransferReference {
  if (
    !object(value) ||
    !closed(
      value,
      ["version", "environment", "baseUrl", "bank", "accountScope", "clientRequestId", "intent"],
      ["transferId"],
    ) ||
    value.version !== 1 ||
    (value.environment !== "test" && value.environment !== "production") ||
    typeof value.baseUrl !== "string" ||
    value.baseUrl.length > 2048 ||
    !isTransferId(value.accountScope) ||
    !isTransferId(value.clientRequestId) ||
    (Object.hasOwn(value, "transferId") && !isTransferId(value.transferId))
  )
    throw new ISecureTransferError("invalid-input");
  let url: URL;
  try {
    url = new URL(value.baseUrl);
  } catch {
    throw new ISecureTransferError("invalid-input");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !text(value.baseUrl, 2048))
    throw new ISecureTransferError("invalid-input");
  const intent = readTransferIntent(value.intent);
  if (value.bank !== intent.Bank) throw new ISecureTransferError("invalid-input");
  return Object.freeze({
    version: 1,
    environment: value.environment,
    baseUrl: value.baseUrl,
    bank: intent.Bank,
    accountScope: value.accountScope,
    clientRequestId: value.clientRequestId,
    intent,
    ...(typeof value.transferId === "string" ? { transferId: value.transferId } : {}),
  });
}
/** Metadata routes cannot release a key, grant or file. Completed is not bank success. */
export function readTransferStatus(value: unknown, expectedId?: string): TransferStatus {
  const invalid = () => new ISecureTransferError("invalid-response");
  if (
    !object(value) ||
    !text(value.ResponseCode, 64) ||
    !text(value.ResponseText, 65536, true) ||
    (Object.hasOwn(value, "RequestId") && !text(value.RequestId, 128))
  )
    throw invalid();
  if (value.ResponseCode === "01" && closed(value, ["ResponseCode", "ResponseText"], ["RequestId"]))
    throw new ISecureTransferError("refused");
  if (
    !closed(
      value,
      ["ResponseCode", "ResponseText", "TransferId", "State", "ExecuteUntil", "RetentionUntil"],
      ["DeliveryUntil", "DeliveryRevokedAt", "RequestId"],
    ) ||
    !isTransferId(value.TransferId) ||
    (expectedId !== undefined && value.TransferId !== expectedId) ||
    typeof value.State !== "string" ||
    !STATES.includes(value.State) ||
    !integer(value.ExecuteUntil) ||
    !integer(value.RetentionUntil) ||
    value.RetentionUntil <= value.ExecuteUntil ||
    Object.hasOwn(value, "DeliveryUntil") !== (value.State === "completed") ||
    (Object.hasOwn(value, "DeliveryUntil") &&
      (!integer(value.DeliveryUntil) || value.DeliveryUntil > value.RetentionUntil)) ||
    (Object.hasOwn(value, "DeliveryRevokedAt") &&
      (value.State !== "completed" ||
        !integer(value.DeliveryRevokedAt) ||
        value.DeliveryRevokedAt >= value.RetentionUntil))
  )
    throw invalid();
  return Object.freeze({ ...(value as TransferStatus) });
}

/** Pure admission budgeting; no account lookup or execution authority. */
export function checkTransferBudget(reference: TransferReference, capability: EncryptedTransferCapability): void {
  const intent = reference.intent;
  if (
    (intent.AcceptGzip && !capability.Encodings.includes("gzip")) ||
    (intent.Operation === "upload" && !capability.Delivery.includes(intent.Storage))
  )
    throw new ISecureTransferError("unsupported");
  if (
    (intent.Operation === "upload" && intent.Integrity.RawBytes > capability.MaxRawUploadBytes) ||
    new TextEncoder().encode(JSON.stringify({ ClientRequestId: reference.clientRequestId, Intent: intent })).length >
      capability.MaxControlBytes
  )
    throw new ISecureTransferError("size");
}
