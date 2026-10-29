import type { components } from "../generated/wsapi-v2.js";
import type { UploadFileRequest } from "./api-types.js";
import { ISecureError } from "./errors.js";

/** Generated from the backend-owned additive ListCerts metadata contract. */
export type FileTransferCapability = components["schemas"]["FileTransferCapability"];
export type TransferErrorReason = "invalid-input" | "invalid-response" | "unsupported" | "size" | "session-changed";

/** Static diagnostics only: never attaches file bytes, signatures or response bodies. */
export class ISecureTransferError extends ISecureError {
  constructor(readonly reason: TransferErrorReason) {
    const messages: Record<TransferErrorReason, string> = {
      "invalid-input": "Invalid file transfer input",
      "invalid-response": "Invalid file transfer metadata or response",
      unsupported: "This SDK and server do not share an available inline transfer protocol",
      size: "File or metadata exceeds the available inline transfer budget; large-file delivery is not enabled",
      "session-changed": "Session or transfer destination changed; do not automatically resubmit the operation",
    };
    super(messages[reason]);
    this.name = "ISecureTransferError";
  }
}

export interface UploadFileBytesRequest extends Omit<UploadFileRequest, "FileContents"> {
  /** Exact original bytes covered by Signature. The helper does not sign or reinterpret them. */
  bytes: Uint8Array;
}
export interface FileTransferOptions {
  signal?: AbortSignal;
}
export type InlineTransferSupport = {
  protocol: "legacy-inline" | "inline-v1";
  maxRawUploadBytes: number;
  maxRawDownloadBytes: number;
  maxInlineRequestBytes: number;
};
export type FileTransferSupport = InlineTransferSupport | { protocol: "unavailable" };
export interface FileBytesResult<Response> {
  /** Original envelope, including bank response codes and optional immediate upload Content. */
  response: Response;
  /** Present only for successful responses containing valid inline Content. */
  bytes?: Uint8Array;
  protocol: InlineTransferSupport["protocol"];
}

/** Six MiB invocation ceiling minus the design's bounded mapping reserve. Server checks remain authoritative. */
export const INLINE_JSON_BUDGET = 6 * 1024 * 1024 - 64 * 1024;
const MAX_INLINE_RAW_BYTES = Math.floor(INLINE_JSON_BUDGET / 4) * 3;
const MAX_CONTROL_BYTES = 2 * 1024 * 1024;
const MAX_ADVERTISED_RAW_BYTES = 32 * 1024 * 1024;
export const LEGACY_INLINE_SUPPORT: Readonly<InlineTransferSupport> = Object.freeze({
  protocol: "legacy-inline",
  maxRawUploadBytes: MAX_INLINE_RAW_BYTES,
  maxRawDownloadBytes: MAX_INLINE_RAW_BYTES,
  maxInlineRequestBytes: INLINE_JSON_BUDGET,
});
const CAPABILITY_KEYS = [
  "ContractVersion",
  "Bank",
  "Protocols",
  "Encodings",
  "Delivery",
  "MaxRawUploadBytes",
  "MaxRawDownloadBytes",
  "MaxInlineRequestBytes",
];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function boundedInteger(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= max;
}
function choices(value: unknown, allowed: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= allowed.length &&
    value.every((item: unknown) => typeof item === "string" && allowed.includes(item)) &&
    new Set(value).size === value.length
  );
}
function capability(value: unknown): FileTransferCapability {
  if (
    !record(value) ||
    Object.keys(value).length !== CAPABILITY_KEYS.length ||
    !Object.keys(value).every((key) => CAPABILITY_KEYS.includes(key)) ||
    value.ContractVersion !== 1 ||
    typeof value.Bank !== "string" ||
    !/^[a-z0-9_-]{1,64}$/.test(value.Bank) ||
    !choices(value.Protocols, ["inline-v1", "transfer-v1"]) ||
    !choices(value.Encodings, ["identity", "gzip"]) ||
    !choices(value.Delivery, ["inline", "s3"]) ||
    !boundedInteger(value.MaxRawUploadBytes, MAX_ADVERTISED_RAW_BYTES) ||
    !boundedInteger(value.MaxRawDownloadBytes, MAX_ADVERTISED_RAW_BYTES) ||
    !boundedInteger(value.MaxInlineRequestBytes, INLINE_JSON_BUDGET)
  ) {
    throw new ISecureTransferError("invalid-response");
  }
  return value as FileTransferCapability;
}

function readCapabilities(response: unknown): FileTransferCapability[] | undefined {
  if (!record(response) || response.ResponseCode !== "00" || !Array.isArray(response.Certs)) {
    throw new ISecureTransferError("invalid-response");
  }
  if (!Object.hasOwn(response, "FileTransferCapabilities")) return undefined;
  const raw: unknown = response.FileTransferCapabilities;
  if (!Array.isArray(raw) || raw.length > 32) throw new ISecureTransferError("invalid-response");
  const caps = raw.map(capability);
  if (new Set(caps.map((item) => item.Bank)).size !== caps.length) throw new ISecureTransferError("invalid-response");
  return caps;
}
/** Read the closed bootstrap once for both unchanged inline and optional detail discovery. */
export function readTransferDiscovery(
  response: unknown,
  bank: string,
): {
  support: FileTransferSupport;
  transferAdvertised: boolean;
} {
  const caps = readCapabilities(response);
  return {
    support: inlineSupport(caps, bank),
    transferAdvertised: caps?.find((item) => item.Bank === bank)?.Protocols.includes("transfer-v1") ?? false,
  };
}
/** Pure negotiation. A present malformed advertisement never degrades to legacy. */
export function readTransferSupport(response: unknown, bank: string): FileTransferSupport {
  return readTransferDiscovery(response, bank).support;
}
function inlineSupport(caps: FileTransferCapability[] | undefined, bank: string): FileTransferSupport {
  if (!caps) return { ...LEGACY_INLINE_SUPPORT };
  const selected = caps.find((item) => item.Bank === bank);
  if (
    !selected?.Protocols.includes("inline-v1") ||
    !selected.Encodings.includes("identity") ||
    !selected.Delivery.includes("inline")
  ) {
    return { protocol: "unavailable" };
  }
  return {
    protocol: "inline-v1",
    maxRawUploadBytes: Math.min(selected.MaxRawUploadBytes, MAX_INLINE_RAW_BYTES),
    maxRawDownloadBytes: Math.min(selected.MaxRawDownloadBytes, MAX_INLINE_RAW_BYTES),
    maxInlineRequestBytes: selected.MaxInlineRequestBytes,
  };
}

export function requireInlineSupport(support: FileTransferSupport): InlineTransferSupport {
  if (support.protocol === "unavailable") throw new ISecureTransferError("unsupported");
  return support;
}
function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Validate/budget before allocating base64. JSON string escaping is counted exactly. */
export function prepareInlineUpload(input: UploadFileBytesRequest, support: FileTransferSupport): UploadFileRequest {
  const limits = requireInlineSupport(support);
  if (
    !record(input) ||
    !(input.bytes instanceof Uint8Array) ||
    input.bytes.byteLength === 0 ||
    ![input.FileName, input.FileType, input.Signature].every((value) => typeof value === "string" && value.length > 0)
  ) {
    throw new ISecureTransferError("invalid-input");
  }
  if (
    input.bytes.byteLength > limits.maxRawUploadBytes ||
    [input.FileName, input.FileType, input.Signature].some((value) => value.length > MAX_CONTROL_BYTES)
  ) {
    throw new ISecureTransferError("size");
  }
  const body = { FileContents: "", FileName: input.FileName, FileType: input.FileType, Signature: input.Signature };
  assertInlineUploadBudget(input.bytes.byteLength, body, support);
  const chunks: string[] = [];
  for (let offset = 0; offset < input.bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...input.bytes.subarray(offset, offset + 8192)));
  }
  body.FileContents = btoa(chunks.join(""));
  return body;
}

/** Recheck a frozen upload against the negotiated server budget, without re-encoding its bytes. */
export function assertInlineUploadBudget(
  rawBytes: number,
  body: UploadFileRequest,
  support: FileTransferSupport,
): void {
  const limits = requireInlineSupport(support);
  const overhead = utf8Bytes(JSON.stringify({ ...body, FileContents: "" }));
  if (
    rawBytes > limits.maxRawUploadBytes ||
    overhead > MAX_CONTROL_BYTES ||
    overhead + 4 * Math.ceil(rawBytes / 3) > limits.maxInlineRequestBytes
  ) {
    throw new ISecureTransferError("size");
  }
}

/** Bounded identity decoder; errors never cause another bank request. */
export function decodeInlineResult(
  response: unknown,
  support: FileTransferSupport,
  requireContent: boolean,
): Uint8Array | undefined {
  const limits = requireInlineSupport(support);
  if (
    !record(response) ||
    typeof response.ResponseCode !== "string" ||
    response.ResponseCode.length === 0 ||
    response.ResponseCode.length > 64
  ) {
    throw new ISecureTransferError("invalid-response");
  }
  if (response.ResponseCode !== "00") return undefined;
  if (Object.hasOwn(response, "FilePayload")) throw new ISecureTransferError("invalid-response");
  if (response.Content === undefined && !requireContent) return undefined;
  if (typeof response.Content !== "string") throw new ISecureTransferError("invalid-response");
  if (response.Content.length > 4 * Math.ceil(limits.maxRawDownloadBytes / 3)) throw new ISecureTransferError("size");
  let binary: string;
  try {
    binary = atob(response.Content);
  } catch {
    throw new ISecureTransferError("invalid-response");
  }
  if (btoa(binary) !== response.Content) throw new ISecureTransferError("invalid-response");
  if (binary.length > limits.maxRawDownloadBytes) throw new ISecureTransferError("size");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
