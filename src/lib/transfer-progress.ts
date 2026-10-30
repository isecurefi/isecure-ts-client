import { ISecureTransferError, type FileTransferOptions, type FileTransferProgress } from "./file-transfers.js";

/** Capture one observer without granting it control over mutation outcomes.
 * In particular, an observer failure must not turn a successful POST into an
 * apparent failure that invites replay. AbortSignal remains the cancellation port. */
export function transferProgressObserver(
  value: FileTransferOptions["onProgress"],
): (event: FileTransferProgress) => void {
  if (value !== undefined && typeof value !== "function") throw new ISecureTransferError("invalid-input");
  if (!value) return () => undefined;
  return (event) => {
    try {
      const result = value(Object.freeze({ ...event }));
      if (result !== undefined) void Promise.resolve(result).catch(() => undefined);
    } catch {
      // Observational only: never log observer errors or attach them to API errors.
    }
  };
}
