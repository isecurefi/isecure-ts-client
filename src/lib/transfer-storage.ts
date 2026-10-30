import { isTransferId } from "./transfer-control.js";
import { ISecureTransferError } from "./file-transfers.js";
function invalid(): ISecureTransferError {
  return new ISecureTransferError("invalid-response");
}
/** Shared canonical storage metadata; no HTTP or AWS effects. */
export function base64Hash(hash: string): string {
  if (!isTransferId(hash)) throw invalid();
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => parseInt(hash.slice(index * 2, index * 2 + 2), 16));
  return btoa(String.fromCharCode(...bytes));
}
export function objectVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value !== "null" &&
    value.length > 0 &&
    value.length <= 1024 &&
    !/[\s\p{Cc}]/u.test(value) &&
    new TextEncoder().encode(value).length <= 1024 &&
    new TextDecoder("utf-8", { ignoreBOM: true }).decode(new TextEncoder().encode(value)) === value
  );
}
