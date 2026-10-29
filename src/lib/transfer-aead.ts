import type { components } from "../generated/transfer-api.js";

/** s3-aead-v1 codec. Random keys are supplied by the authenticated transfer API;
 * context is authenticated data, never input to an implicit key derivation. */
const MAX_BYTES = 32 * 1024 * 1024;
const HEADER_BYTES = 20;
const OVERHEAD = 36;
const CONTEXT_KEYS = [
  "Environment",
  "AccountScope",
  "TransferId",
  "ArtifactId",
  "Purpose",
  "Encoding",
  "OriginalBytes",
  "EncodedBytes",
  "OriginalSha256",
];
type ContextFields = components["schemas"]["TransferArtifactContext"];

class ArtifactError extends Error {
  constructor() {
    super("Encrypted file artifact rejected");
    this.name = "ArtifactError";
  }
}
function digest(value: unknown): string {
  if (typeof value !== "string" || value.length !== 64 || !/^[0-9a-f]{64}$/.test(value)) throw new ArtifactError();
  return value;
}
function boundedLength(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > MAX_BYTES)
    throw new ArtifactError();
  return value;
}
function unhex(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from({ length: text.length / 2 }, (_, i) => Number.parseInt(text.slice(i * 2, i * 2 + 2), 16));
}
function fixed(value: Uint8Array, size: number): Uint8Array<ArrayBuffer> {
  if (!(value instanceof Uint8Array) || value.byteLength !== size) throw new ArtifactError();
  return new Uint8Array(value);
}
function header(nonce: Uint8Array): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(HEADER_BYTES);
  result.set(new TextEncoder().encode("ISECAED1"));
  result.set(fixed(nonce, 12), 8);
  return result;
}
/** Parsing validates a descriptor; it does not authorize its account or operation. */
export class AeadContext {
  private constructor(private readonly fields: Readonly<ContextFields>) {}
  static parse(value: unknown): AeadContext {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ArtifactError();
    const wire = value as Record<string, unknown>;
    if (Object.keys(wire).length !== CONTEXT_KEYS.length || !CONTEXT_KEYS.every((key) => Object.hasOwn(wire, key)))
      throw new ArtifactError();
    if (
      (wire.Environment !== "test" && wire.Environment !== "production") ||
      (wire.Purpose !== "upload" && wire.Purpose !== "download") ||
      (wire.Encoding !== "identity" && wire.Encoding !== "gzip")
    )
      throw new ArtifactError();
    const fields: ContextFields = {
      Environment: wire.Environment,
      AccountScope: digest(wire.AccountScope),
      TransferId: digest(wire.TransferId),
      ArtifactId: digest(wire.ArtifactId),
      Purpose: wire.Purpose,
      Encoding: wire.Encoding,
      OriginalBytes: boundedLength(wire.OriginalBytes),
      EncodedBytes: boundedLength(wire.EncodedBytes),
      OriginalSha256: digest(wire.OriginalSha256),
    };
    if (
      fields.Encoding === "identity"
        ? fields.OriginalBytes !== fields.EncodedBytes
        : fields.EncodedBytes === 0 || fields.EncodedBytes >= fields.OriginalBytes
    )
      throw new ArtifactError();
    return new AeadContext(Object.freeze(fields));
  }
  get metadata(): Readonly<ContextFields> {
    return this.fields;
  }
  get encodedBytes(): number {
    return this.fields.EncodedBytes;
  }
  get objectBytes(): number {
    return this.fields.EncodedBytes + OVERHEAD;
  }
  /** Fixed binary order and big-endian integers, independent of JSON property order. */
  aad(nonce: Uint8Array): Uint8Array<ArrayBuffer> {
    const f = this.fields;
    const result = new Uint8Array(186);
    result.set(new TextEncoder().encode("ISECure.S3.AEAD.v1\0"));
    result.set(header(nonce), 19);
    result[39] = f.Environment === "test" ? 0 : 1;
    result.set(unhex(f.AccountScope), 40);
    result.set(unhex(f.TransferId), 72);
    result.set(unhex(f.ArtifactId), 104);
    result[136] = f.Purpose === "upload" ? 0 : 1;
    result[137] = f.Encoding === "identity" ? 0 : 1;
    const view = new DataView(result.buffer);
    view.setBigUint64(138, BigInt(f.OriginalBytes), false);
    view.setBigUint64(146, BigInt(f.EncodedBytes), false);
    result.set(unhex(f.OriginalSha256), 154);
    return result;
  }
}
async function importKey(bytes: Uint8Array, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const copy = fixed(bytes, 32);
  try {
    return await crypto.subtle.importKey("raw", copy, "AES-GCM", false, [usage]);
  } finally {
    copy.fill(0);
  }
}
/** Call once per frozen key/nonce/representation; retries reuse its ciphertext. */
export async function sealEncoded(
  context: AeadContext,
  nonce: Uint8Array,
  key: Uint8Array,
  encoded: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  let plaintext: Uint8Array<ArrayBuffer> | undefined;
  try {
    if (!(context instanceof AeadContext)) throw new ArtifactError();
    const iv = fixed(nonce, 12);
    plaintext = fixed(encoded, context.encodedBytes);
    const algorithm = { name: "AES-GCM", iv, additionalData: context.aad(iv), tagLength: 128 };
    const encrypted = await crypto.subtle.encrypt(algorithm, await importKey(key, "encrypt"), plaintext);
    const object = new Uint8Array(context.objectBytes);
    object.set(header(iv));
    object.set(new Uint8Array(encrypted), HEADER_BYTES);
    return object;
  } catch {
    throw new ArtifactError();
  } finally {
    plaintext?.fill(0);
  }
}
/** Returns authenticated encoded bytes only. The caller must still bounded-decode
 * and verify original length/hash before sending to a bank or caller's sink. */
export async function openEncoded(
  context: AeadContext,
  nonce: Uint8Array,
  key: Uint8Array,
  object: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    if (!(context instanceof AeadContext)) throw new ArtifactError();
    const iv = fixed(nonce, 12);
    if (
      !(object instanceof Uint8Array) ||
      object.byteLength !== context.objectBytes ||
      !header(iv).every((byte, i) => byte === object[i])
    )
      throw new ArtifactError();
    // Snapshot before the first await: caller mutation cannot alter the admitted envelope.
    const ciphertext = new Uint8Array(object.subarray(HEADER_BYTES));
    const algorithm = { name: "AES-GCM", iv, additionalData: context.aad(iv), tagLength: 128 };
    return new Uint8Array(await crypto.subtle.decrypt(algorithm, await importKey(key, "decrypt"), ciphertext));
  } catch {
    throw new ArtifactError();
  }
}

/** Canonical padded RFC 4648 control encoding. Never normalize alternate forms. */
function parseSecret(value: unknown, length: 12 | 32): Uint8Array<ArrayBuffer> {
  try {
    if (typeof value !== "string" || value.length !== Math.ceil(length / 3) * 4) throw new ArtifactError();
    const binary = atob(value);
    if (binary.length !== length || btoa(binary) !== value) throw new ArtifactError();
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new ArtifactError();
  }
}
export function parseArtifactKey(value: unknown): Uint8Array<ArrayBuffer> {
  return parseSecret(value, 32);
}
export function parseArtifactNonce(value: unknown): Uint8Array<ArrayBuffer> {
  return parseSecret(value, 12);
}
