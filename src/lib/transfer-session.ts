import { PendingUpload, type PreparedUploadSummary } from "./transfer-upload.js";
import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";
import {
  readTransferReference,
  readTransferStatus,
  type TransferReference,
  type TransferStatus,
} from "./transfer-control.js";

export type TransferControlCall = (
  operation: "create" | "status" | "retire" | "prepare",
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
  private upload: PendingUpload | undefined;
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
  /** Freeze/compress the original once, persist its encoded fingerprint, then
   * encrypt with the authenticated key. Successful preparation retains ciphertext for reuse. */
  async prepareUpload(bytes: Uint8Array, options: FileTransferOptions = {}): Promise<PreparedUploadSummary> {
    return this.exclusive(options, async (checked) => {
      if (this.snapshot.transferId === undefined) throw new ISecureTransferError("invalid-input");
      if (this.upload) await this.upload.requireOriginal(bytes, checked);
      else this.upload = await PendingUpload.create(this.snapshot, bytes, checked);
      this.assertCurrent();
      if (this.upload.summary) return this.upload.summary;
      const reply = await this.request("prepare", this.snapshot.transferId, this.upload.preparation, checked);
      return this.upload.seal(reply, Math.floor(Date.now() / 1000), checked);
    });
  }
  /** Release retained local representation/ciphertext. This does not retire the remote transfer. */
  discardUpload(): void {
    if (this.busy) throw new ISecureTransferError("in-progress");
    this.upload?.dispose();
    this.upload = undefined;
  }
  private async control(
    operation: "create" | "status" | "retire",
    options: FileTransferOptions,
  ): Promise<TransferStatus> {
    return this.exclusive(options, async (checked) => {
      const id = this.snapshot.transferId;
      if (operation !== "create" && id === undefined) throw new ISecureTransferError("invalid-input");
      const body =
        operation === "create"
          ? { ClientRequestId: this.snapshot.clientRequestId, Intent: this.snapshot.intent }
          : undefined;
      const reply = await this.request(operation, operation === "create" ? undefined : id, body, checked);
      const result = readTransferStatus(reply, id);
      this.snapshot = Object.freeze({ ...this.snapshot, transferId: result.TransferId });
      if (operation === "retire") {
        this.upload?.dispose();
        this.upload = undefined;
      }
      return result;
    });
  }
  private async request(
    operation: Parameters<TransferControlCall>[0],
    id: string | undefined,
    body: unknown,
    options: FileTransferOptions,
  ): Promise<unknown> {
    this.assertCurrent();
    options.signal?.throwIfAborted();
    const reply = await this.call(operation, id, body, options);
    this.assertCurrent();
    options.signal?.throwIfAborted();
    return reply;
  }
  private async exclusive<Result>(
    options: FileTransferOptions,
    action: (checked: FileTransferOptions) => Promise<Result>,
  ): Promise<Result> {
    if (this.busy) throw new ISecureTransferError("in-progress");
    this.assertCurrent();
    const signal = options.signal;
    signal?.throwIfAborted();
    this.busy = true;
    try {
      const result = await action(signal ? { signal } : {});
      this.assertCurrent();
      signal?.throwIfAborted();
      return result;
    } finally {
      this.busy = false;
    }
  }
}
