import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";
import {
  readTransferReference,
  readTransferStatus,
  type TransferReference,
  type TransferStatus,
} from "./transfer-control.js";

export type TransferControlCall = (
  operation: "create" | "status" | "retire",
  id: string | undefined,
  body: unknown,
  options: FileTransferOptions,
) => Promise<unknown>;
/** Random logical identifier, not a key derivation. Save it before the first mutation. */
export function createTransferRequestId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** Explicit controls; never dispatches a bank call or automatically retries a mutation. */
export class TransferSession {
  private snapshot: TransferReference;
  private busy = false;
  constructor(
    reference: TransferReference,
    private readonly call: TransferControlCall,
    private readonly assertCurrent: () => void,
  ) {
    this.snapshot = readTransferReference(reference);
  }
  get reference(): TransferReference {
    return this.snapshot;
  }
  /** An explicit identical repeat reconciles a lost create response using the same logical ID. */
  create(options: FileTransferOptions = {}): Promise<TransferStatus> {
    return this.control("create", options);
  }
  status(options: FileTransferOptions = {}): Promise<TransferStatus> {
    return this.control("status", options);
  }
  /** Cancels a prepared transfer or revokes retained delivery. It cannot undo bank processing. */
  retire(options: FileTransferOptions = {}): Promise<TransferStatus> {
    return this.control("retire", options);
  }
  private async control(
    operation: "create" | "status" | "retire",
    options: FileTransferOptions,
  ): Promise<TransferStatus> {
    if (this.busy) throw new ISecureTransferError("in-progress");
    const id = this.snapshot.transferId;
    if (operation !== "create" && id === undefined) throw new ISecureTransferError("invalid-input");
    this.assertCurrent();
    const signal = options.signal;
    signal?.throwIfAborted();
    this.busy = true;
    try {
      const body =
        operation === "create"
          ? { ClientRequestId: this.snapshot.clientRequestId, Intent: this.snapshot.intent }
          : undefined;
      const reply = await this.call(operation, operation === "create" ? undefined : id, body, signal ? { signal } : {});
      this.assertCurrent();
      signal?.throwIfAborted();
      const result = readTransferStatus(reply, id);
      this.snapshot = Object.freeze({ ...this.snapshot, transferId: result.TransferId });
      return result;
    } finally {
      this.busy = false;
    }
  }
}
