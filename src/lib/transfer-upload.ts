import { readSavedUpload, type SavedUpload } from "./transfer-upload-state.js";
import type { components } from "../generated/transfer-api.js";
import { BoundArtifact } from "./transfer-artifact.js";
import { readTransferReference, readTransferStatus, type TransferReference } from "./transfer-control.js";
import {
  encodeTransferRepresentation,
  sha256TransferBytes,
  decodeTransferRepresentation,
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
  const bound = BoundArtifact.parse(artifact, reference, "upload");
  const fields = bound.context.metadata;
  if (
    reference.intent.Operation !== "upload" ||
    bound.encodedSha256 !== preparation.EncodedSha256 ||
    fields.Encoding !== preparation.Encoding ||
    fields.EncodedBytes !== preparation.EncodedBytes ||
    fields.OriginalBytes !== reference.intent.Integrity.RawBytes ||
    fields.OriginalSha256 !== reference.intent.Integrity.Sha256
  ) {
    bound.dispose();
    throw invalid();
  }
  return bound;
}
/** Memory-only representation/ciphertext owner. Serializing it never includes
 * file bytes or a key. It cannot execute a bank operation or issue an S3 request. */
export class PendingUpload {
  readonly preparation: Preparation;
  readonly #reference: TransferReference;
  #encoded: Uint8Array<ArrayBuffer> | undefined;
  #ciphertext: Uint8Array<ArrayBuffer> | undefined;
  #summary: PreparedUploadSummary | undefined;
  #saved: PreparedUploadSummary | undefined;
  #sealing = false;
  #disposed = false;
  private constructor(reference: TransferReference, preparation: Preparation, encoded?: Uint8Array<ArrayBuffer>) {
    this.#reference = reference;
    this.#encoded = encoded;
    this.preparation = Object.freeze({ ...preparation });
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
      const pending = new PendingUpload(
        bound,
        { Encoding: representation.encoding, EncodedBytes: representation.bytes.length, EncodedSha256: hash },
        representation.bytes,
      );
      accepted = true;
      return pending;
    } finally {
      if (!accepted) representation.bytes.fill(0);
    }
  }
  static async fromSaved(
    reference: TransferReference,
    saved: unknown,
    bytes: Uint8Array,
    options: FileTransferOptions = {},
  ): Promise<PendingUpload> {
    const signal = options.signal;
    const state = readSavedUpload(saved, reference);
    if (!(bytes instanceof Uint8Array) || bytes.length !== state.prepared.ObjectBytes)
      throw new ISecureTransferError("invalid-input");
    signal?.throwIfAborted();
    const copy = new Uint8Array(bytes);
    let accepted = false;
    try {
      if ((await sha256TransferBytes(copy)) !== state.prepared.CiphertextSha256)
        throw new ISecureTransferError("invalid-input");
      signal?.throwIfAborted();
      const pending = new PendingUpload(state.reference, {
        Encoding: state.prepared.Encoding,
        EncodedBytes: state.prepared.EncodedBytes,
        EncodedSha256: state.prepared.EncodedSha256,
      });
      pending.#ciphertext = copy;
      pending.#saved = state.prepared;
      accepted = true;
      return pending;
    } finally {
      if (!accepted) copy.fill(0);
    }
  }
  save(): SavedUpload {
    if (!this.#summary || this.#disposed) throw new ISecureTransferError("invalid-input");
    return Object.freeze({ version: 1, reference: this.#reference, prepared: this.#summary });
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
    let artifact: BoundArtifact | undefined;
    let ciphertext: Uint8Array<ArrayBuffer> | undefined;
    let accepted = false;
    try {
      artifact = artifactReply(reply, this.#reference, this.preparation, now);
      const ciphertextSha256 = artifact.ciphertextSha256;
      if (this.#encoded) ciphertext = await artifact.seal(this.#encoded);
      else if (this.#ciphertext && this.#saved) {
        // Restoring never encrypts: verify the saved object under the freshly
        // authorized descriptor/key, then the original file, before making it usable.
        let encoded: Uint8Array<ArrayBuffer> | undefined;
        let original: Uint8Array<ArrayBuffer> | undefined;
        try {
          encoded = await artifact.open(this.#ciphertext);
          if (
            (await sha256TransferBytes(encoded)) !== this.preparation.EncodedSha256 ||
            this.#reference.intent.Operation !== "upload"
          )
            throw invalid();
          original = await decodeTransferRepresentation(
            encoded,
            this.preparation.Encoding,
            this.#reference.intent.Integrity,
            signal ? { signal } : {},
          );
          ciphertext = this.#ciphertext;
        } finally {
          encoded?.fill(0);
          original?.fill(0);
        }
      } else throw invalid();
      const hash = await sha256TransferBytes(ciphertext);
      if (
        (ciphertextSha256 !== undefined && ciphertextSha256 !== hash) ||
        (this.#saved && this.#saved.CiphertextSha256 !== hash)
      )
        throw invalid();
      signal?.throwIfAborted();
      if (this.#disposed) throw invalid();
      const summary = Object.freeze({ ...this.preparation, CiphertextSha256: hash, ObjectBytes: ciphertext.length });
      this.#ciphertext = ciphertext;
      this.#encoded?.fill(0);
      this.#encoded = undefined;
      this.#summary = summary;
      accepted = true;
      return summary;
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof ISecureTransferError) throw error;
      throw invalid();
    } finally {
      artifact?.dispose();
      if (!accepted) ciphertext?.fill(0);
      this.#sealing = false;
    }
  }
  copyCiphertext(): Uint8Array<ArrayBuffer> {
    if (!this.#ciphertext || !this.#summary || this.#disposed) throw new ISecureTransferError("invalid-input");
    return this.#ciphertext.slice();
  }
  dispose(): void {
    this.#disposed = true;
    this.#encoded?.fill(0);
    this.#encoded = undefined;
    this.#ciphertext?.fill(0);
    this.#ciphertext = undefined;
    this.#summary = undefined;
    this.#saved = undefined;
  }
  toJSON(): { preparation: Preparation; sealed: boolean } {
    return { preparation: this.preparation, sealed: this.#summary !== undefined };
  }
}
