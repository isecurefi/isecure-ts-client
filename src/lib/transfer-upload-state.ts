import { readTransferReference, isTransferId, type TransferReference } from "./transfer-control.js";
import type { PreparedUploadSummary } from "./transfer-upload.js";
import { ISecureTransferError } from "./file-transfers.js";

/** Persist alongside the ciphertext, never alongside a key or signed grant.
 * Metadata includes private file selectors; keep it out of logs. */
export interface SavedUpload {
  readonly version: 1;
  readonly reference: TransferReference;
  readonly prepared: PreparedUploadSummary;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}
function sameFlat(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every((key) => Object.hasOwn(right, key) && left[key] === right[key])
  );
}
/** Compare validated records semantically, without depending on JSON field order. */
function sameReference(left: TransferReference, right: TransferReference): boolean {
  const { intent: l, ...leftScope } = left;
  const { intent: r, ...rightScope } = right;
  const { Integrity: li, ...leftIntent } = l;
  const { Integrity: ri, ...rightIntent } = r;
  return (
    sameFlat(leftScope, rightScope) &&
    sameFlat(leftIntent, rightIntent) &&
    (li === undefined ? ri === undefined : li.RawBytes === ri?.RawBytes && li.Sha256 === ri.Sha256)
  );
}
/** Pure closed validation before allocating file buffers or making an API call. Local state grants
 * no remote authority; ciphertext must still pass authenticated artifact checks. */
export function readSavedUpload(value: unknown, reference: TransferReference): SavedUpload {
  const invalid = () => new ISecureTransferError("invalid-input");
  const bound = readTransferReference(reference);
  if (
    bound.transferId === undefined ||
    bound.intent.Operation !== "upload" ||
    bound.intent.Storage !== "s3" ||
    !object(value) ||
    Object.keys(value).length !== 3 ||
    value.version !== 1 ||
    !sameReference(readTransferReference(value.reference), bound) ||
    !object(value.prepared)
  )
    throw invalid();
  const p = value.prepared;
  if (
    Object.keys(p).length !== 5 ||
    (p.Encoding !== "identity" && p.Encoding !== "gzip") ||
    typeof p.EncodedBytes !== "number" ||
    !Number.isSafeInteger(p.EncodedBytes) ||
    p.EncodedBytes < 1 ||
    !isTransferId(p.EncodedSha256) ||
    !isTransferId(p.CiphertextSha256) ||
    p.ObjectBytes !== p.EncodedBytes + 36 ||
    (p.Encoding === "identity"
      ? p.EncodedBytes !== bound.intent.Integrity.RawBytes || p.EncodedSha256 !== bound.intent.Integrity.Sha256
      : !bound.intent.AcceptGzip || p.EncodedBytes >= bound.intent.Integrity.RawBytes)
  )
    throw invalid();
  return Object.freeze({
    version: 1,
    reference: bound,
    prepared: Object.freeze({
      Encoding: p.Encoding,
      EncodedBytes: p.EncodedBytes,
      EncodedSha256: p.EncodedSha256,
      CiphertextSha256: p.CiphertextSha256,
      ObjectBytes: p.EncodedBytes + 36,
    }),
  });
}
