import { PendingDelivery } from "./transfer-delivery.js";
import { prepareExecution, type TransferExecutionInput } from "./transfer-execution.js";
import { PendingUpload, type PreparedUploadSummary } from "./transfer-upload.js";
import {
  readUploadControlResult,
  uploadCiphertext,
  type UploadedCiphertext,
  type UploadControlResult,
} from "./transfer-s3.js";
import type { EncryptedTransferCapability } from "./encrypted-transfers.js";
import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";
import {
  readTransferReference,
  readTransferStatus,
  type TransferReference,
  type TransferStatus,
} from "./transfer-control.js";

export type TransferControlCall = (
  operation: "create" | "status" | "retire" | "prepare" | "grant" | "execute" | "delivery",
  id: string | undefined,
  body: unknown,
  options: FileTransferOptions,
) => Promise<unknown>;
/** Random logical identifier, not a key derivation. Save it before the first mutation. */
export function createTransferRequestId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export interface TransferFileResult {
  readonly status: TransferStatus;
  readonly bytes?: Uint8Array;
}
/** Explicit controls. Only execute may contact a bank; no mutation is automatically retried. */
export class TransferSession {
  private snapshot: TransferReference;
  private busy = false;
  private lastStatus: TransferStatus | undefined;
  private needsStatus = false;
  private delivery: PendingDelivery | undefined;
  private upload: PendingUpload | undefined;
  private uploaded: UploadedCiphertext | "uncertain" | undefined;
  constructor(
    reference: TransferReference,
    private readonly call: TransferControlCall,
    private readonly assertCurrent: () => void,
    private readonly capability?: EncryptedTransferCapability,
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
  /** Upload retained ciphertext once. A lost S3 acknowledgement requires storage
   * reconciliation; repeating this method never blindly repeats a POST. */
  async uploadPrepared(options: FileTransferOptions = {}): Promise<UploadedCiphertext> {
    return this.exclusive(options, async (checked) => {
      if (this.uploaded === "uncertain") throw new ISecureTransferError("storage-uncertain");
      if (this.uploaded) return this.uploaded;
      const upload = this.upload;
      const summary = upload?.summary;
      if (!upload || !summary) throw new ISecureTransferError("invalid-input");
      const result = await this.inspectUpload(summary, checked);
      if (result.kind === "stored") {
        this.uploaded = result.receipt;
        return result.receipt;
      }
      this.assertCurrent();
      checked.signal?.throwIfAborted();
      const ciphertext = upload.copyCiphertext();
      try {
        this.uploaded = "uncertain";
        this.uploaded = await uploadCiphertext(result.grant, ciphertext, summary, {
          ...checked,
          beforeSend: this.assertCurrent,
        });
        return this.uploaded;
      } finally {
        ciphertext.fill(0);
      }
    });
  }
  /** Check storage after a lost acknowledgement; never sends file bytes or
   * executes a bank request. Undefined means the server confirmed absence. */
  async reconcileUpload(options: FileTransferOptions = {}): Promise<UploadedCiphertext | undefined> {
    return this.exclusive(options, async (checked) => {
      const summary = this.upload?.summary;
      if (!summary) throw new ISecureTransferError("invalid-input");
      const result = await this.inspectUpload(summary, checked);
      this.uploaded = result.kind === "stored" ? result.receipt : undefined;
      return this.uploaded;
    });
  }
  /** Execute a confirmed prepared intent. After uncertainty, check status first;
   * another execution always requires an explicit caller decision. */
  async execute(input: TransferExecutionInput = {}, options: FileTransferOptions = {}): Promise<TransferStatus> {
    return this.exclusive(options, async (checked) => {
      const id = this.snapshot.transferId;
      const capability = this.capability;
      if (this.needsStatus) throw new ISecureTransferError("execution-uncertain");
      if (
        !id ||
        !capability ||
        this.lastStatus?.State !== "prepared" ||
        Math.floor(Date.now() / 1000) >= this.lastStatus.ExecuteUntil
      )
        throw new ISecureTransferError("invalid-input");
      if (this.uploaded === "uncertain") throw new ISecureTransferError("storage-uncertain");
      const body = await prepareExecution(this.snapshot, capability, input, this.uploaded, checked);
      this.assertCurrent();
      checked.signal?.throwIfAborted();
      this.clearDelivery();
      this.needsStatus = true;
      try {
        const reply = await this.request("execute", id, body, checked);
        const delivery = PendingDelivery.parse(reply, this.snapshot, capability, Math.floor(Date.now() / 1000));
        this.delivery = delivery;
        this.lastStatus = delivery.status;
        this.needsStatus = delivery.status.State === "prepared";
        return delivery.status;
      } catch {
        // Even an error response can follow bank dispatch. Do not retain its body,
        // or turn an unknown outcome into an automatic retry.
        throw new ISecureTransferError("execution-uncertain");
      }
    });
  }
  /** Reauthorize retained delivery and renew its URL. Never contacts the bank. */
  async refreshDelivery(options: FileTransferOptions = {}): Promise<TransferStatus> {
    return this.exclusive(options, async (checked) => {
      const id = this.snapshot.transferId;
      const capability = this.capability;
      if (!id || !capability) throw new ISecureTransferError("invalid-input");
      this.clearDelivery();
      const reply = await this.request("delivery", id, {}, checked);
      const now = Math.floor(Date.now() / 1000);
      this.delivery = PendingDelivery.parse(reply, this.snapshot, capability, now);
      if (
        this.delivery.status.State !== "completed" ||
        this.delivery.status.DeliveryUntil === undefined ||
        this.delivery.status.DeliveryUntil <= now ||
        this.delivery.status.DeliveryRevokedAt !== undefined
      )
        throw new ISecureTransferError("invalid-response");
      this.lastStatus = this.delivery.status;
      return this.delivery.status;
    });
  }
  /** Consume the current delivery once. Expired/failed delivery needs an explicit
   * refreshDelivery; neither this method nor refresh re-executes the bank request. */
  async receive(options: FileTransferOptions = {}): Promise<TransferFileResult> {
    let bytes: Uint8Array | undefined;
    try {
      return await this.exclusive(options, async (checked) => {
        const delivery = this.delivery;
        if (!delivery) throw new ISecureTransferError("invalid-input");
        this.delivery = undefined;
        bytes = await delivery.receive({ ...checked, beforeRelease: this.assertCurrent });
        return { status: delivery.status, ...(bytes === undefined ? {} : { bytes }) };
      });
    } catch (error) {
      bytes?.fill(0);
      throw error;
    }
  }
  /** The sink borrows one fully verified file until its promise settles. Copy
   * bytes if retaining them; private buffers are cleared afterwards. */
  async receiveTo(
    sink: (bytes: Uint8Array) => void | Promise<void>,
    options: FileTransferOptions = {},
  ): Promise<TransferStatus> {
    return this.exclusive(options, async (checked) => {
      const delivery = this.delivery;
      if (!delivery || typeof sink !== "function") throw new ISecureTransferError("invalid-input");
      this.delivery = undefined;
      await delivery.receiveTo(sink, { ...checked, beforeRelease: this.assertCurrent });
      return delivery.status;
    });
  }
  /** Release local delivery keys and buffers without any remote operation. */
  discardDelivery(): void {
    if (this.busy) throw new ISecureTransferError("in-progress");
    this.clearDelivery();
  }
  private clearDelivery(): void {
    this.delivery?.dispose();
    this.delivery = undefined;
  }
  private async inspectUpload(
    summary: PreparedUploadSummary,
    checked: FileTransferOptions,
  ): Promise<UploadControlResult> {
    const id = this.snapshot.transferId;
    const capability = this.capability;
    if (!id || !capability) throw new ISecureTransferError("invalid-input");
    const reply = await this.request("grant", id, { CiphertextSha256: summary.CiphertextSha256 }, checked);
    return readUploadControlResult(reply, {
      origin: capability.S3Origin,
      transferId: id,
      summary,
      now: Math.floor(Date.now() / 1000),
      grantMaxSeconds: capability.GrantMaxSeconds,
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
      if (operation === "retire") this.clearDelivery();
      if (operation !== "create" && id === undefined) throw new ISecureTransferError("invalid-input");
      const body =
        operation === "create"
          ? { ClientRequestId: this.snapshot.clientRequestId, Intent: this.snapshot.intent }
          : undefined;
      const reply = await this.request(operation, operation === "create" ? undefined : id, body, checked);
      const result = readTransferStatus(reply, id);
      this.lastStatus = result;
      if (operation === "status") {
        this.needsStatus = false;
        if (result.State !== "completed" || result.DeliveryRevokedAt !== undefined) this.clearDelivery();
      }
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
    try {
      this.assertCurrent();
    } catch (error) {
      this.clearDelivery();
      throw error;
    }
    const signal = options.signal;
    signal?.throwIfAborted();
    this.busy = true;
    try {
      const result = await action(signal ? { signal } : {});
      this.assertCurrent();
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      this.clearDelivery();
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
