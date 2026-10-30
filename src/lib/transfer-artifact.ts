import { AeadContext, parseArtifactKey, parseArtifactNonce, openEncoded, sealEncoded } from "./transfer-aead.js";
import { isTransferId, type TransferReference } from "./transfer-control.js";
import { ISecureTransferError } from "./file-transfers.js";

/** Memory-only owner of authenticated artifact material. Validation is shared
 * by upload and retained delivery; it grants no API or bank authority. */
export class BoundArtifact {
  readonly context: AeadContext;
  readonly encodedSha256: string;
  readonly ciphertextSha256: string | undefined;
  readonly #key: Uint8Array<ArrayBuffer>;
  readonly #nonce: Uint8Array<ArrayBuffer>;
  #disposed = false;
  private constructor(
    context: AeadContext,
    encoded: string,
    cipher: string | undefined,
    key: Uint8Array<ArrayBuffer>,
    nonce: Uint8Array<ArrayBuffer>,
  ) {
    this.context = context;
    this.encodedSha256 = encoded;
    this.ciphertextSha256 = cipher;
    this.#key = key;
    this.#nonce = nonce;
    Object.freeze(this);
  }
  static parse(value: unknown, reference: TransferReference, purpose: "upload" | "download"): BoundArtifact {
    let key: Uint8Array<ArrayBuffer> | undefined;
    let nonce: Uint8Array<ArrayBuffer> | undefined;
    let accepted = false;
    try {
      if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype)
        throw new Error();
      const wire = value as Record<string, unknown>;
      const required = ["Format", "Context", "Nonce", "Key", "EncodedSha256"];
      if (
        !required.every((name) => Object.hasOwn(wire, name)) ||
        Object.keys(wire).some((name) => !required.includes(name) && name !== "CiphertextSha256") ||
        wire.Format !== "s3-aead-v1" ||
        !isTransferId(wire.EncodedSha256) ||
        (Object.hasOwn(wire, "CiphertextSha256") && !isTransferId(wire.CiphertextSha256))
      )
        throw new Error();
      const context = AeadContext.parse(wire.Context);
      const fields = context.metadata;
      if (
        fields.Environment !== reference.environment ||
        fields.AccountScope !== reference.accountScope ||
        fields.TransferId !== reference.transferId ||
        fields.Purpose !== purpose
      )
        throw new Error();
      key = parseArtifactKey(wire.Key);
      nonce = parseArtifactNonce(wire.Nonce);
      const result = new BoundArtifact(
        context,
        wire.EncodedSha256,
        typeof wire.CiphertextSha256 === "string" ? wire.CiphertextSha256 : undefined,
        key,
        nonce,
      );
      accepted = true;
      return result;
    } catch {
      throw new ISecureTransferError("invalid-response");
    } finally {
      if (!accepted) {
        key?.fill(0);
        nonce?.fill(0);
      }
    }
  }
  async seal(encoded: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    if (this.#disposed) throw new ISecureTransferError("invalid-response");
    const bytes = await sealEncoded(this.context, this.#nonce, this.#key, encoded);
    if (this.#disposed) {
      bytes.fill(0);
      throw new ISecureTransferError("invalid-response");
    }
    return bytes;
  }
  async open(ciphertext: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    if (this.#disposed) throw new ISecureTransferError("invalid-response");
    const bytes = await openEncoded(this.context, this.#nonce, this.#key, ciphertext);
    if (this.#disposed) {
      bytes.fill(0);
      throw new ISecureTransferError("invalid-response");
    }
    return bytes;
  }
  dispose(): void {
    this.#disposed = true;
    this.#key.fill(0);
    this.#nonce.fill(0);
  }
  toJSON(): string {
    return "<redacted artifact>";
  }
}
