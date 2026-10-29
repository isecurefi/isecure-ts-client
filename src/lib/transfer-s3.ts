import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";
import { isTransferId, readTransferStatus } from "./transfer-control.js";
import { isTransferS3Origin } from "./encrypted-transfers.js";
import { sha256TransferBytes } from "./transfer-representation.js";
import type { PreparedUploadSummary } from "./transfer-upload.js";
import type { components } from "../generated/transfer-api.js";

const REQUIRED_FIELDS = [
  "key",
  "Content-Type",
  "success_action_status",
  "x-amz-server-side-encryption",
  "x-amz-checksum-algorithm",
  "x-amz-checksum-sha256",
  "x-amz-algorithm",
  "x-amz-credential",
  "x-amz-date",
  "policy",
  "x-amz-signature",
] as const;
function invalid(): ISecureTransferError {
  return new ISecureTransferError("invalid-response");
}
function object(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function canonicalBase64(value: string): boolean {
  if (value.length === 0 || value.length > 20 * 1024) return false;
  try {
    return btoa(atob(value)) === value;
  } catch {
    return false;
  }
}
function base64Hash(hash: string): string {
  if (!isTransferId(hash)) throw invalid();
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => parseInt(hash.slice(index * 2, index * 2 + 2), 16));
  return btoa(String.fromCharCode(...bytes));
}
/** Validated, immutable bearer grant. Never attach it to logs/errors or persist it. */
class UploadGrant {
  constructor(
    readonly Url: string,
    readonly Fields: Readonly<Record<string, string>>,
    readonly ExpiresAt: number,
  ) {
    Object.freeze(this);
  }
  toJSON(): string {
    return "<redacted upload grant>";
  }
}
export interface UploadGrantExpectation {
  readonly origin: string;
  readonly transferId: string;
  readonly summary: PreparedUploadSummary;
  readonly now: number;
  readonly executeUntil: number;
  readonly grantMaxSeconds: number;
}
/** Pure boundary validation against authenticated discovery and frozen ciphertext. */
export function readUploadGrant(value: unknown, expected: UploadGrantExpectation): UploadGrant {
  if (
    !isTransferS3Origin(expected.origin) ||
    !isTransferId(expected.transferId) ||
    !Number.isSafeInteger(expected.now) ||
    expected.now < 0 ||
    !Number.isSafeInteger(expected.executeUntil) ||
    expected.executeUntil <= expected.now ||
    !Number.isSafeInteger(expected.grantMaxSeconds) ||
    expected.grantMaxSeconds < 1 ||
    expected.grantMaxSeconds > 300 ||
    !object(value) ||
    Object.keys(value).length !== 3 ||
    value.Url !== `${expected.origin}/` ||
    typeof value.ExpiresAt !== "number" ||
    !Number.isSafeInteger(value.ExpiresAt) ||
    value.ExpiresAt <= expected.now ||
    value.ExpiresAt > expected.executeUntil ||
    value.ExpiresAt - expected.now > expected.grantMaxSeconds ||
    !object(value.Fields)
  )
    throw invalid();
  const fields = value.Fields;
  if (
    !REQUIRED_FIELDS.every((name) => Object.hasOwn(fields, name)) ||
    Object.keys(fields).some(
      (name) => !(REQUIRED_FIELDS as readonly string[]).includes(name) && name !== "x-amz-security-token",
    ) ||
    Object.values(fields).some(
      (field) =>
        typeof field !== "string" || field.length === 0 || field.length > 20 * 1024 || /[^\x20-\x7e]/u.test(field),
    ) ||
    JSON.stringify(fields).length > 20 * 1024
  )
    throw invalid();
  // Every field has been bounded and narrowed above; never strip unknown fields.
  const wire = fields as Record<(typeof REQUIRED_FIELDS)[number], string>;
  if (
    wire["Content-Type"] !== "application/octet-stream" ||
    wire.success_action_status !== "201" ||
    wire["x-amz-server-side-encryption"] !== "AES256" ||
    wire["x-amz-checksum-algorithm"] !== "SHA256" ||
    wire["x-amz-checksum-sha256"] !== base64Hash(expected.summary.CiphertextSha256) ||
    wire["x-amz-algorithm"] !== "AWS4-HMAC-SHA256" ||
    !isTransferId(wire["x-amz-signature"]) ||
    !/^[A-Za-z0-9]{16,128}\/[0-9]{8}\/eu-west-1\/s3\/aws4_request$/u.test(wire["x-amz-credential"]) ||
    !/^[0-9]{8}T[0-9]{6}Z$/u.test(wire["x-amz-date"]) ||
    !canonicalBase64(wire.policy) ||
    !new RegExp(`^transfers/${expected.transferId}/[a-f0-9]{64}/upload$`, "u").test(wire.key)
  )
    throw invalid();
  return new UploadGrant(value.Url, Object.freeze({ ...wire }), value.ExpiresAt);
}
export type UploadedCiphertext = Readonly<components["schemas"]["TransferUploadedCiphertext"]>;
interface StorageEffects extends FileTransferOptions {
  now?: () => number;
  send?: typeof fetch;
  beforeSend?: () => void;
}
function objectVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value !== "null" &&
    value.length > 0 &&
    value.length <= 1024 &&
    !/[\s\p{Cc}]/u.test(value) &&
    new TextEncoder().encode(value).length <= 1024
  );
}
export type UploadControlResult =
  | { readonly kind: "stored"; readonly receipt: UploadedCiphertext }
  | { readonly kind: "missing"; readonly grant: UploadGrant };
/** A control response either identifies the verified existing object or grants
 * a new upload. Unknown/ambiguous responses cannot authorize a resend. */
export function readUploadControlResult(
  value: unknown,
  expected: Omit<UploadGrantExpectation, "executeUntil">,
): UploadControlResult {
  if (!object(value)) throw invalid();
  const { Upload, Uploaded, ...metadata } = value;
  const status = readTransferStatus(metadata, expected.transferId);
  if (Object.hasOwn(value, "Upload") === Object.hasOwn(value, "Uploaded")) throw invalid();
  if (
    status.State !== "prepared" ||
    status.ResponseCode !== "00" ||
    !Number.isSafeInteger(expected.now) ||
    expected.now < 0 ||
    expected.now >= status.ExecuteUntil
  )
    throw invalid();
  if (Object.hasOwn(value, "Upload"))
    return { kind: "missing", grant: readUploadGrant(Upload, { ...expected, executeUntil: status.ExecuteUntil }) };
  if (
    !object(Uploaded) ||
    Object.keys(Uploaded).length !== 3 ||
    !objectVersion(Uploaded.VersionId) ||
    Uploaded.CiphertextSha256 !== expected.summary.CiphertextSha256 ||
    Uploaded.ObjectBytes !== expected.summary.ObjectBytes
  )
    throw invalid();
  return {
    kind: "stored",
    receipt: Object.freeze({
      VersionId: Uploaded.VersionId,
      CiphertextSha256: expected.summary.CiphertextSha256,
      ObjectBytes: expected.summary.ObjectBytes,
    }),
  };
}
/** Narrow S3 transport. Has no API client, credentials, XML parser or retry loop.
 * Any failure after dispatch is uncertain; reconcile storage before resending. */
export async function uploadCiphertext(
  grant: UploadGrant,
  ciphertext: Uint8Array,
  summary: PreparedUploadSummary,
  effects: StorageEffects = {},
): Promise<UploadedCiphertext> {
  const signal = effects.signal;
  const now = effects.now ?? (() => Math.floor(Date.now() / 1000));
  const send = effects.send ?? fetch;
  const beforeSend = effects.beforeSend;
  const hash = summary.CiphertextSha256;
  const size = summary.ObjectBytes;
  if (
    !(grant instanceof UploadGrant) ||
    !(ciphertext instanceof Uint8Array) ||
    !Number.isSafeInteger(size) ||
    size < 37 ||
    size > 32 * 1024 * 1024 + 36 ||
    ciphertext.length !== size ||
    !isTransferId(hash) ||
    grant.Fields["x-amz-checksum-sha256"] !== base64Hash(hash)
  )
    throw new ISecureTransferError("invalid-input");
  signal?.throwIfAborted();
  const owned = new Uint8Array(ciphertext);
  try {
    if ((await sha256TransferBytes(owned)) !== hash) throw new ISecureTransferError("invalid-input");
    signal?.throwIfAborted();
    const remaining = grant.ExpiresAt - now();
    if (!Number.isSafeInteger(remaining) || remaining <= 0 || remaining > 300) throw invalid();
    beforeSend?.();
    const body = new FormData();
    for (const [name, value] of Object.entries(grant.Fields)) body.append(name, value);
    body.append("file", new Blob([owned], { type: "application/octet-stream" }), "artifact.bin");
    owned.fill(0);
    const controller = new AbortController();
    const abort = () => {
      controller.abort();
    };
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, Math.min(remaining * 1000, 120000));
    let response: Response | undefined;
    try {
      signal?.throwIfAborted();
      response = await send(grant.Url, {
        method: "POST",
        body,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      const version = response.headers.get("x-amz-version-id");
      if (
        response.status !== 201 ||
        response.redirected ||
        controller.signal.aborted ||
        !objectVersion(version) ||
        response.headers.get("x-amz-checksum-sha256") !== base64Hash(hash)
      )
        throw invalid();
      return Object.freeze({ VersionId: version, CiphertextSha256: hash, ObjectBytes: size });
    } catch {
      // Do not retain a fetch error: it may include a signed URL or server body.
      throw new ISecureTransferError("storage-uncertain");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      // POST bodies are unnecessary XML (including on failure); never buffer/parse them.
      try {
        // Request cancellation, but do not wait on remote cleanup to release a
        // verified receipt. A stalled cancel must not turn success into uncertainty.
        void response?.body?.cancel().catch(() => undefined);
      } catch {
        /* No diagnostic from S3 bodies. */
      }
    }
  } finally {
    owned.fill(0);
  }
}
