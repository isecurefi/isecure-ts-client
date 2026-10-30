import { BoundArtifact } from "./transfer-artifact.js";
import {
  readTransferIntegrity,
  readTransferReference,
  readTransferStatus,
  type TransferReference,
  type TransferStatus,
} from "./transfer-control.js";
import { ISecureTransferError, INLINE_JSON_BUDGET, type FileTransferOptions } from "./file-transfers.js";
import type { EncryptedTransferCapability } from "./encrypted-transfers.js";
import { decodeTransferRepresentation, sha256TransferBytes, type TransferEncoding } from "./transfer-representation.js";
import { readDownloadGrant, downloadCiphertext } from "./transfer-s3-download.js";

function invalid(): ISecureTransferError {
  return new ISecureTransferError("invalid-response");
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}
type Integrity = ReturnType<typeof readTransferIntegrity>;
type Payload =
  | { kind: "inline"; bytes: Uint8Array<ArrayBuffer> }
  | { kind: "s3"; artifact: BoundArtifact; grant: ReturnType<typeof readDownloadGrant> };
interface ReceiveEffects extends FileTransferOptions {
  now?: () => number;
  send?: typeof fetch;
  /** Recheck the owning session before storage access and before plaintext release. */
  beforeRelease?: () => void;
}
/** One-use private delivery material. Metadata-only replies remain metadata-only;
 * receiving or failing delivery cannot dispatch a bank operation. */
export class PendingDelivery {
  readonly status: TransferStatus;
  readonly #integrity: Integrity | undefined;
  readonly #encoding: TransferEncoding | undefined;
  #payload: Payload | undefined;
  #used = false;
  private constructor(status: TransferStatus, payload?: Payload, integrity?: Integrity, encoding?: TransferEncoding) {
    this.status = status;
    this.#payload = payload;
    this.#integrity = integrity;
    this.#encoding = encoding;
    Object.freeze(this);
  }
  static parse(
    value: unknown,
    reference: TransferReference,
    capability: EncryptedTransferCapability,
    now: number,
  ): PendingDelivery {
    let artifact: BoundArtifact | undefined;
    let bytes: Uint8Array<ArrayBuffer> | undefined;
    let accepted = false;
    try {
      const bound = readTransferReference(reference);
      if (!object(value) || !bound.transferId || !Number.isSafeInteger(now) || now < 0) throw invalid();
      const { FilePayload, Artifact, ...metadata } = value;
      const status = readTransferStatus(metadata, bound.transferId);
      if (!Object.hasOwn(value, "FilePayload")) {
        if (Object.hasOwn(value, "Artifact")) throw invalid();
        return new PendingDelivery(status);
      }
      if (
        status.State !== "completed" ||
        status.DeliveryUntil === undefined ||
        status.DeliveryUntil <= now ||
        status.DeliveryRevokedAt !== undefined ||
        !object(FilePayload)
      )
        throw invalid();
      const p = FilePayload;
      const integrity = readTransferIntegrity({ RawBytes: p.RawBytes, Sha256: p.Sha256 });
      const encoding = p.Encoding;
      if (
        integrity.RawBytes > capability.MaxRawDownloadBytes ||
        (encoding !== "identity" && encoding !== "gzip") ||
        !capability.Encodings.includes(encoding) ||
        (encoding === "gzip" && !bound.intent.AcceptGzip)
      )
        throw invalid();
      let payload: Payload;
      if (p.Kind === "inline") {
        if (
          !capability.Delivery.includes("inline") ||
          Object.hasOwn(value, "Artifact") ||
          Object.keys(p).length !== 5 ||
          typeof p.Data !== "string" ||
          p.Data.length > INLINE_JSON_BUDGET
        )
          throw invalid();
        const binary = atob(p.Data);
        if (
          btoa(binary) !== p.Data ||
          (encoding === "identity"
            ? binary.length !== integrity.RawBytes
            : binary.length === 0 || binary.length >= integrity.RawBytes)
        )
          throw invalid();
        bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        payload = { kind: "inline", bytes };
      } else if (p.Kind === "s3") {
        if (!capability.Delivery.includes("s3") || Object.keys(p).length !== 7 || p.TransferId !== bound.transferId)
          throw invalid();
        artifact = BoundArtifact.parse(Artifact, bound, "download");
        const context = artifact.context.metadata;
        if (
          context.Encoding !== encoding ||
          context.OriginalBytes !== integrity.RawBytes ||
          context.OriginalSha256 !== integrity.Sha256 ||
          artifact.ciphertextSha256 === undefined
        )
          throw invalid();
        const grant = readDownloadGrant(
          { Url: p.Url, ExpiresAt: p.ExpiresAt },
          {
            origin: capability.S3Origin,
            transferId: bound.transferId,
            now,
            deliveryUntil: status.DeliveryUntil,
            grantMaxSeconds: capability.GrantMaxSeconds,
            objectBytes: artifact.context.objectBytes,
            checksum: artifact.ciphertextSha256,
          },
        );
        payload = { kind: "s3", artifact, grant };
      } else throw invalid();
      const result = new PendingDelivery(status, payload, integrity, encoding);
      accepted = true;
      return result;
    } catch (error) {
      if (error instanceof ISecureTransferError && error.reason === "refused") throw error;
      throw invalid();
    } finally {
      if (!accepted) {
        artifact?.dispose();
        bytes?.fill(0);
      }
    }
  }
  async receive(effects: ReceiveEffects = {}): Promise<Uint8Array<ArrayBuffer> | undefined> {
    if (this.#used) throw invalid();
    this.#used = true;
    const { signal, beforeRelease } = effects;
    const now = effects.now ?? (() => Math.floor(Date.now() / 1000));
    const send = effects.send;
    const payload = this.#payload;
    let cipher: Uint8Array<ArrayBuffer> | undefined;
    let encoded: Uint8Array<ArrayBuffer> | undefined;
    let original: Uint8Array<ArrayBuffer> | undefined;
    let accepted = false;
    try {
      signal?.throwIfAborted();
      beforeRelease?.();
      if (!payload) return undefined;
      const timestamp = now();
      if (
        !Number.isSafeInteger(timestamp) ||
        timestamp < 0 ||
        this.status.DeliveryUntil === undefined ||
        timestamp >= this.status.DeliveryUntil ||
        !this.#integrity ||
        !this.#encoding
      )
        throw invalid();
      if (payload.kind === "inline") encoded = payload.bytes;
      else {
        cipher = await downloadCiphertext(payload.grant, {
          now,
          ...(send ? { send } : {}),
          ...(signal ? { signal } : {}),
          ...(beforeRelease ? { beforeSend: beforeRelease } : {}),
        });
        encoded = await payload.artifact.open(cipher);
        if ((await sha256TransferBytes(encoded)) !== payload.artifact.encodedSha256) throw invalid();
      }
      original = await decodeTransferRepresentation(encoded, this.#encoding, this.#integrity, signal ? { signal } : {});
      signal?.throwIfAborted();
      beforeRelease?.();
      const completedAt = now();
      if (
        this.#payload !== payload ||
        !Number.isSafeInteger(completedAt) ||
        completedAt < 0 ||
        completedAt >= this.status.DeliveryUntil
      )
        throw invalid();
      signal?.throwIfAborted();
      accepted = true;
      return original;
    } finally {
      cipher?.fill(0);
      encoded?.fill(0);
      if (!accepted) original?.fill(0);
      this.dispose();
    }
  }
  /** Sink receives a complete verified file, never provisional decrypted chunks.
   * The buffer is borrowed until the sink settles; copy it if retaining it. */
  async receiveTo(sink: (bytes: Uint8Array) => void | Promise<void>, effects: ReceiveEffects = {}): Promise<void> {
    if (typeof sink !== "function") throw new ISecureTransferError("invalid-input");
    const signal = effects.signal;
    const beforeRelease = effects.beforeRelease;
    const bytes = await this.receive({ ...effects });
    try {
      signal?.throwIfAborted();
      beforeRelease?.();
      signal?.throwIfAborted();
      if (bytes !== undefined) await sink(bytes);
    } finally {
      bytes?.fill(0);
    }
  }
  dispose(): void {
    this.#used = true;
    if (this.#payload?.kind === "s3") this.#payload.artifact.dispose();
    else this.#payload?.bytes.fill(0);
    this.#payload = undefined;
  }
  toJSON(): string {
    return "<redacted delivery>";
  }
}
