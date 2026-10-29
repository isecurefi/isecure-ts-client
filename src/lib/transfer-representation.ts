import type { components } from "../generated/transfer-api.js";
import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";
import { readTransferIntegrity } from "./transfer-control.js";

type Integrity = Readonly<components["schemas"]["TransferIntegrity"]>;
export type TransferEncoding = "identity" | "gzip";
export interface TransferRepresentation {
  readonly encoding: TransferEncoding;
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly integrity: Integrity;
}
const MAX_BYTES = 32 * 1024 * 1024;
const CHUNK_BYTES = 64 * 1024;
function invalid(): ISecureTransferError {
  return new ISecureTransferError("invalid-response");
}
function snapshot(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES) throw new ISecureTransferError("size");
  return new Uint8Array(bytes);
}
export async function sha256TransferBytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function integrity(bytes: Uint8Array<ArrayBuffer>): Promise<Integrity> {
  return Object.freeze({ RawBytes: bytes.length, Sha256: await sha256TransferBytes(bytes) });
}
/** Native transforms behind one bounded collector. Overflow never returns partial bytes. */
async function transform(
  input: Uint8Array<ArrayBuffer>,
  codec: CompressionStream | DecompressionStream,
  limit: number,
  capture: boolean,
  signal: AbortSignal | undefined,
  inputChunkBytes = CHUNK_BYTES,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  signal?.throwIfAborted();
  let offset = 0;
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      if (offset === input.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + inputChunkBytes, input.length);
      controller.enqueue(input.subarray(offset, end));
      offset = end;
    },
  });
  const reader = source.pipeThrough(codec).getReader();
  const abort = (): void => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", abort, { once: true });
  // Output capacity is known before reading. For compression it is at most the
  // original length minus one. Validation-only passes retain no output buffer.
  const output = new Uint8Array(capture ? limit : 0);
  let length = 0;
  let complete = false;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) {
        signal?.throwIfAborted();
        break;
      }
      try {
        signal?.throwIfAborted();
        if (chunk.value.length > limit - length) return undefined;
        if (capture) output.set(chunk.value, length);
        length += chunk.value.length;
      } finally {
        chunk.value.fill(0);
      }
    }
    if (!capture) {
      complete = true;
      return output;
    }
    const result = length === output.length ? output : output.slice(0, length);
    complete = result === output;
    return result;
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    if (!complete) output.fill(0);
  }
}
/** RFC 1952 framing only. Native gzip validates header CRC, data CRC and ISIZE.
 * No compression or checksum primitive is implemented here. */
function deflatePayload(gzip: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (gzip.length < 18 || gzip[0] !== 0x1f || gzip[1] !== 0x8b || gzip[2] !== 8) throw invalid();
  const flags = gzip[3] ?? 0;
  if ((flags & 0xe0) !== 0) throw invalid();
  const trailer = gzip.length - 8;
  let at = 10;
  if (flags & 4) {
    if (at + 2 > trailer) throw invalid();
    at += 2 + (gzip[at] ?? 0) + ((gzip[at + 1] ?? 0) << 8);
    if (at > trailer) throw invalid();
  }
  for (const flag of [8, 16]) {
    if (flags & flag) {
      while (at < trailer && gzip[at] !== 0) at++;
      if (at >= trailer) throw invalid();
      at++;
    }
  }
  if (flags & 2) at += 2;
  if (at >= trailer) throw invalid();
  return gzip.subarray(at, trailer);
}
/** Freeze original bytes before any await; gzip is selected only when smaller.
 * The returned representation must be retained unchanged for encrypted retries. */
export async function encodeTransferRepresentation(
  bytes: Uint8Array,
  allowGzip: boolean,
  options: FileTransferOptions = {},
): Promise<TransferRepresentation> {
  if (typeof allowGzip !== "boolean") throw new ISecureTransferError("invalid-input");
  const original = snapshot(bytes);
  const signal = options.signal;
  let retained = false;
  let compressed: Uint8Array<ArrayBuffer> | undefined;
  try {
    signal?.throwIfAborted();
    const metadata = await integrity(original);
    signal?.throwIfAborted();
    if (allowGzip && original.length > 1)
      compressed = await transform(original, new CompressionStream("gzip"), original.length - 1, true, signal);
    signal?.throwIfAborted();
    retained = compressed === undefined;
    return {
      encoding: compressed === undefined ? "identity" : "gzip",
      bytes: compressed ?? original,
      integrity: metadata,
    };
  } catch {
    compressed?.fill(0);
    signal?.throwIfAborted();
    throw invalid();
  } finally {
    if (!retained) original.fill(0);
  }
}
/** Authenticate encrypted input before calling this decoder. No provisional
 * decoded bytes escape before framing, original length and SHA-256 all pass. */
export async function decodeTransferRepresentation(
  bytes: Uint8Array,
  encoding: TransferEncoding,
  metadata: Integrity,
  options: FileTransferOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  let expected: Integrity;
  try {
    expected = readTransferIntegrity(metadata);
  } catch {
    throw invalid();
  }
  if (encoding !== "identity" && encoding !== "gzip") throw invalid();
  if (
    !(bytes instanceof Uint8Array) ||
    (encoding === "identity"
      ? bytes.length !== expected.RawBytes
      : bytes.length === 0 || bytes.length >= expected.RawBytes)
  )
    throw invalid();
  const input = snapshot(bytes);
  const signal = options.signal;
  let original: Uint8Array<ArrayBuffer> | undefined;
  let accepted = false;
  try {
    signal?.throwIfAborted();
    if (encoding === "identity") original = input;
    else {
      // Node 24's gzip decoder accepts concatenated members. Its deflate-raw
      // decoder rejects trailing compressed input. Use that native check first,
      // then validate gzip checksums in a second bounded, non-retaining pass.
      original = await transform(
        deflatePayload(input),
        new DecompressionStream("deflate-raw"),
        expected.RawBytes,
        true,
        signal,
        4096,
      );
      if (original?.length !== expected.RawBytes) throw invalid();
      if (
        (await transform(input, new DecompressionStream("gzip"), expected.RawBytes, false, signal, 4096)) === undefined
      )
        throw invalid();
    }
    if ((await integrity(original)).Sha256 !== expected.Sha256) throw invalid();
    signal?.throwIfAborted();
    accepted = true;
    return original;
  } catch {
    signal?.throwIfAborted();
    throw invalid();
  } finally {
    if (original !== input || !accepted) input.fill(0);
    if (!accepted) original?.fill(0);
  }
}
