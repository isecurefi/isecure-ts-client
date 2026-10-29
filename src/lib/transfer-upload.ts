import type { components } from "../generated/transfer-api.js";
import { AeadContext, parseArtifactKey, parseArtifactNonce, sealEncoded } from "./transfer-aead.js";
import { readTransferReference, readTransferStatus, isTransferId, type TransferReference } from "./transfer-control.js";
import {
  encodeTransferRepresentation,
  sha256TransferBytes,
  type TransferRepresentation,
} from "./transfer-representation.js";
import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";

type Preparation = Readonly<components["schemas"]["TransferUploadPrepareRequest"]>;
export type PreparedUploadSummary = Readonly<Preparation & { CiphertextSha256: string; ObjectBytes: number }>;
function invalid(): ISecureTransferError {
  return new ISecureTransferError("invalid-response");
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function artifactReply(reply: unknown, reference: TransferReference, preparation: Preparation, now: number) {
  if (!object(reply)) throw invalid();
  const { Artifact: artifact, ...metadata } = reply;
  const status = readTransferStatus(metadata, reference.transferId);
  if (
    status.State !== "prepared" ||
    status.ResponseCode !== "00" ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now >= status.ExecuteUntil ||
    !object(artifact)
  )
    throw invalid();
  const required = ["Format", "Context", "Nonce", "Key", "EncodedSha256"];
  if (
    !required.every((key) => Object.hasOwn(artifact, key)) ||
    Object.keys(artifact).some((key) => !required.includes(key) && key !== "CiphertextSha256") ||
    artifact.Format !== "s3-aead-v1" ||
    artifact.EncodedSha256 !== preparation.EncodedSha256 ||
    (Object.hasOwn(artifact, "CiphertextSha256") && !isTransferId(artifact.CiphertextSha256))
  )
    throw invalid();
  const context = AeadContext.parse(artifact.Context);
  const fields = context.metadata;
  if (
    reference.intent.Operation !== "upload" ||
    fields.Environment !== reference.environment ||
    fields.AccountScope !== reference.accountScope ||
    fields.TransferId !== reference.transferId ||
    fields.Purpose !== "upload" ||
    fields.Encoding !== preparation.Encoding ||
    fields.EncodedBytes !== preparation.EncodedBytes ||
    fields.OriginalBytes !== reference.intent.Integrity.RawBytes ||
    fields.OriginalSha256 !== reference.intent.Integrity.Sha256
  )
    throw invalid();
  return { artifact, context, ciphertextSha256: artifact.CiphertextSha256 };
}
/** Memory-only representation/ciphertext owner. Serializing it never includes
 * file bytes or a key. It cannot execute a bank operation or issue an S3 request. */
export class PendingUpload {
  readonly preparation: Preparation;
  readonly #reference: TransferReference;
  #encoded: Uint8Array<ArrayBuffer> | undefined;
  #ciphertext: Uint8Array<ArrayBuffer> | undefined;
  #summary: PreparedUploadSummary | undefined;
  #sealing = false;
  #disposed = false;
  private constructor(reference: TransferReference, representation: TransferRepresentation, hash: string) {
    this.#reference = reference;
    this.#encoded = representation.bytes;
    this.preparation = Object.freeze({
      Encoding: representation.encoding,
      EncodedBytes: representation.bytes.length,
      EncodedSha256: hash,
    });
  }
  static async create(
    reference: TransferReference,
    bytes: Uint8Array,
    options: FileTransferOptions = {},
  ): Promise<PendingUpload> {
    const signal = options.signal;
    const bound = readTransferReference(reference);
    if (
      bound.transferId === undefined ||
      bound.intent.Operation !== "upload" ||
      bound.intent.Storage !== "s3" ||
      !(bytes instanceof Uint8Array) ||
      bytes.length !== bound.intent.Integrity.RawBytes
    )
      throw new ISecureTransferError("invalid-input");
    const representation = await encodeTransferRepresentation(bytes, bound.intent.AcceptGzip, signal ? { signal } : {});
    let accepted = false;
    try {
      if (representation.integrity.Sha256 !== bound.intent.Integrity.Sha256)
        throw new ISecureTransferError("invalid-input");
      const hash = await sha256TransferBytes(representation.bytes);
      signal?.throwIfAborted();
      const pending = new PendingUpload(bound, representation, hash);
      accepted = true;
      return pending;
    } finally {
      if (!accepted) representation.bytes.fill(0);
    }
  }
  get summary(): PreparedUploadSummary | undefined {
    return this.#summary;
  }
  /** Confirm original input on an explicit retry, without recompressing it. */
  async requireOriginal(bytes: Uint8Array, options: FileTransferOptions = {}): Promise<void> {
    const signal = options.signal;
    if (
      this.#disposed ||
      this.#reference.intent.Operation !== "upload" ||
      !(bytes instanceof Uint8Array) ||
      bytes.length !== this.#reference.intent.Integrity.RawBytes
    )
      throw new ISecureTransferError("invalid-input");
    const copy = new Uint8Array(bytes);
    try {
      signal?.throwIfAborted();
      if ((await sha256TransferBytes(copy)) !== this.#reference.intent.Integrity.Sha256)
        throw new ISecureTransferError("invalid-input");
      signal?.throwIfAborted();
      if (this.#disposed) throw new ISecureTransferError("invalid-input");
    } finally {
      copy.fill(0);
    }
  }
  async seal(reply: unknown, now: number, options: FileTransferOptions = {}): Promise<PreparedUploadSummary> {
    const signal = options.signal;
    if (this.#disposed) throw new ISecureTransferError("invalid-input");
    if (this.#sealing) throw new ISecureTransferError("in-progress");
    signal?.throwIfAborted();
    if (this.#summary) return this.#summary;
    this.#sealing = true;
    let key: Uint8Array<ArrayBuffer> | undefined;
    let nonce: Uint8Array<ArrayBuffer> | undefined;
    let ciphertext: Uint8Array<ArrayBuffer> | undefined;
    let accepted = false;
    try {
      const { artifact, context, ciphertextSha256 } = artifactReply(reply, this.#reference, this.preparation, now);
      nonce = parseArtifactNonce(artifact.Nonce);
      key = parseArtifactKey(artifact.Key);
      if (!this.#encoded) throw invalid();
      ciphertext = await sealEncoded(context, nonce, key, this.#encoded);
      const hash = await sha256TransferBytes(ciphertext);
      if (ciphertextSha256 !== undefined && ciphertextSha256 !== hash) throw invalid();
      signal?.throwIfAborted();
      if (this.#disposed) throw invalid();
      const summary = Object.freeze({ ...this.preparation, CiphertextSha256: hash, ObjectBytes: ciphertext.length });
      this.#ciphertext = ciphertext;
      this.#encoded.fill(0);
      this.#encoded = undefined;
      this.#summary = summary;
      accepted = true;
      return summary;
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof ISecureTransferError) throw error;
      throw invalid();
    } finally {
      key?.fill(0);
      nonce?.fill(0);
      if (!accepted) ciphertext?.fill(0);
      this.#sealing = false;
    }
  }
  copyCiphertext(): Uint8Array<ArrayBuffer> {
    if (!this.#ciphertext || this.#disposed) throw new ISecureTransferError("invalid-input");
    return this.#ciphertext.slice();
  }
  dispose(): void {
    this.#disposed = true;
    this.#encoded?.fill(0);
    this.#encoded = undefined;
    this.#ciphertext?.fill(0);
    this.#ciphertext = undefined;
    this.#summary = undefined;
  }
  toJSON(): { preparation: Preparation; sealed: boolean } {
    return { preparation: this.preparation, sealed: this.#summary !== undefined };
  }
}
