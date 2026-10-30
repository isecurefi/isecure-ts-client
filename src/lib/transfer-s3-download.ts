import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";
import { isTransferId } from "./transfer-control.js";
import { isTransferS3Origin } from "./encrypted-transfers.js";
import { base64Hash, objectVersion } from "./transfer-storage.js";
import { sha256TransferBytes } from "./transfer-representation.js";

function invalid(): ISecureTransferError {
  return new ISecureTransferError("invalid-response");
}
/** Validated memory-only bearer URL, bound to one immutable ciphertext version. */
class DownloadGrant {
  constructor(
    readonly url: string,
    readonly expiresAt: number,
    readonly version: string,
    readonly objectBytes: number,
    readonly checksum: string,
  ) {
    Object.freeze(this);
  }
  toJSON(): string {
    return "<redacted download grant>";
  }
}
interface DownloadExpectation {
  readonly origin: string;
  readonly transferId: string;
  readonly now: number;
  readonly deliveryUntil: number;
  readonly grantMaxSeconds: number;
  readonly objectBytes: number;
  readonly checksum: string;
}
const PARAMETERS = [
  "versionId",
  "response-content-type",
  "response-cache-control",
  "response-content-disposition",
  "X-Amz-Algorithm",
  "X-Amz-Credential",
  "X-Amz-Date",
  "X-Amz-Expires",
  "X-Amz-SignedHeaders",
  "X-Amz-Signature",
];
/** Validate against authenticated API context. Never rewrite a signed URL. */
export function readDownloadGrant(value: unknown, expected: DownloadExpectation): DownloadGrant {
  try {
    if (
      !isTransferS3Origin(expected.origin) ||
      !isTransferId(expected.transferId) ||
      !isTransferId(expected.checksum) ||
      !Number.isSafeInteger(expected.now) ||
      expected.now < 0 ||
      !Number.isSafeInteger(expected.deliveryUntil) ||
      expected.deliveryUntil <= expected.now ||
      !Number.isSafeInteger(expected.grantMaxSeconds) ||
      expected.grantMaxSeconds < 1 ||
      expected.grantMaxSeconds > 300 ||
      !Number.isSafeInteger(expected.objectBytes) ||
      expected.objectBytes < 36 ||
      expected.objectBytes > 32 * 1024 * 1024 + 36 ||
      value === null ||
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype
    )
      throw invalid();
    const wire = value as Record<string, unknown>;
    if (
      Object.keys(wire).length !== 2 ||
      typeof wire.Url !== "string" ||
      wire.Url.length > 16384 ||
      typeof wire.ExpiresAt !== "number" ||
      !Number.isSafeInteger(wire.ExpiresAt) ||
      wire.ExpiresAt <= expected.now ||
      wire.ExpiresAt > expected.deliveryUntil ||
      wire.ExpiresAt - expected.now > expected.grantMaxSeconds
    )
      throw invalid();
    const url = new URL(wire.Url);
    if (
      url.href !== wire.Url ||
      url.origin !== expected.origin ||
      url.username ||
      url.password ||
      url.hash ||
      !new RegExp(`^/transfers/${expected.transferId}/[a-f0-9]{64}/download$`, "u").test(url.pathname)
    )
      throw invalid();
    const params = url.searchParams;
    if (
      !PARAMETERS.every((name) => params.has(name)) ||
      [...params.keys()].some(
        (name) => params.getAll(name).length !== 1 || (!PARAMETERS.includes(name) && name !== "X-Amz-Security-Token"),
      ) ||
      [...params.values()].some((v) => v.length === 0 || /[\p{Cc}]/u.test(v))
    )
      throw invalid();
    const version = params.get("versionId");
    const expires = params.get("X-Amz-Expires") ?? "";
    if (
      !objectVersion(version) ||
      params.get("response-content-type") !== "application/octet-stream" ||
      params.get("response-cache-control") !== "no-store" ||
      !/^attachment; filename="[A-Za-z0-9_-][A-Za-z0-9_.-]{0,119}"$/u.test(
        params.get("response-content-disposition") ?? "",
      ) ||
      params.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" ||
      params.get("X-Amz-SignedHeaders") !== "host" ||
      !isTransferId(params.get("X-Amz-Signature")) ||
      !/^[A-Za-z0-9]{1,128}\/[0-9]{8}\/eu-west-1\/s3\/aws4_request$/u.test(params.get("X-Amz-Credential") ?? "") ||
      !/^[0-9]{8}T[0-9]{6}Z$/u.test(params.get("X-Amz-Date") ?? "") ||
      !/^[1-9][0-9]{0,2}$/u.test(expires) ||
      Number(expires) > expected.grantMaxSeconds
    )
      throw invalid();
    return new DownloadGrant(wire.Url, wire.ExpiresAt, version, expected.objectBytes, expected.checksum);
  } catch {
    throw invalid();
  }
}
interface DownloadEffects extends FileTransferOptions {
  now?: () => number;
  send?: typeof fetch;
  beforeSend?: () => void;
}
/** One bounded GET. No API credentials, replay, decompression or plaintext release. */
export async function downloadCiphertext(
  grant: DownloadGrant,
  effects: DownloadEffects = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (!(grant instanceof DownloadGrant)) throw invalid();
  const signal = effects.signal;
  const now = effects.now ?? (() => Math.floor(Date.now() / 1000));
  const send = effects.send ?? fetch;
  const beforeSend = effects.beforeSend;
  signal?.throwIfAborted();
  const remaining = grant.expiresAt - now();
  if (!Number.isSafeInteger(remaining) || remaining <= 0 || remaining > 300) throw invalid();
  beforeSend?.();
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  let output: Uint8Array<ArrayBuffer> | undefined;
  let accepted = false;
  const cancelReader = () => {
    void reader?.cancel().catch(() => undefined);
  };
  const abort = () => {
    controller.abort();
    cancelReader();
  };
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, Math.min(remaining * 1000, 120000));
  try {
    signal?.throwIfAborted();
    response = await send(grant.url, {
      method: "GET",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    const length = response.headers.get("content-length");
    const checksum = response.headers.get("x-amz-checksum-sha256");
    // Ordinary presigned GET may omit S3's checksum header. The complete body is
    // always hashed against the authenticated API digest below, before AEAD.
    if (
      response.status !== 200 ||
      response.redirected ||
      controller.signal.aborted ||
      response.headers.get("x-amz-version-id") !== grant.version ||
      (checksum !== null && checksum !== base64Hash(grant.checksum)) ||
      (length !== null && length !== String(grant.objectBytes)) ||
      ![null, "identity"].includes(response.headers.get("content-encoding")) ||
      !response.body
    )
      throw invalid();
    reader = response.body.getReader();
    output = new Uint8Array(grant.objectBytes);
    let offset = 0;
    for (;;) {
      const next = await reader.read();
      if (controller.signal.aborted) throw invalid();
      if (next.done) break;
      if (!(next.value instanceof Uint8Array) || next.value.length > output.length - offset) throw invalid();
      output.set(next.value, offset);
      offset += next.value.length;
    }
    if (offset !== output.length || (await sha256TransferBytes(output)) !== grant.checksum || controller.signal.aborted)
      throw invalid();
    beforeSend?.();
    signal?.throwIfAborted();
    accepted = true;
    return output;
  } catch {
    throw invalid();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (!accepted) output?.fill(0);
    try {
      if (reader) {
        cancelReader();
        reader.releaseLock();
      } else {
        void response?.body?.cancel().catch(() => undefined);
      }
    } catch {
      /* No remote body or signed URL in diagnostics. */
    }
  }
}
