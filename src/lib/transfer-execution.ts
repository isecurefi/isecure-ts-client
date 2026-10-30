import type { components } from "../generated/transfer-api.js";
import type { EncryptedTransferCapability } from "./encrypted-transfers.js";
import { ISecureTransferError, type FileTransferOptions } from "./file-transfers.js";
import type { TransferReference } from "./transfer-control.js";
import { encodeTransferRepresentation } from "./transfer-representation.js";
import type { UploadedCiphertext } from "./transfer-s3.js";

export interface TransferExecutionInput {
  /** Detached signatures over original bytes, when required by account policy. */
  signature?: string;
  /** Original bytes only for an inline upload. S3 uploads reuse a verified receipt. */
  bytes?: Uint8Array;
}
type ExecuteBody = components["schemas"]["TransferExecuteRequest"];
/** Snapshot and budget the explicit execution payload; no network or bank effects. */
export async function prepareExecution(
  reference: TransferReference,
  capability: EncryptedTransferCapability,
  input: TransferExecutionInput,
  uploaded?: UploadedCiphertext,
  options: FileTransferOptions = {},
): Promise<ExecuteBody> {
  const invalid = () => new ISecureTransferError("invalid-input");
  if (
    input === null ||
    typeof input !== "object" ||
    Object.getPrototypeOf(input) !== Object.prototype ||
    Object.keys(input).some((key) => key !== "signature" && key !== "bytes")
  )
    throw invalid();
  const signature = input.signature;
  if (
    Object.hasOwn(input, "signature") &&
    (typeof signature !== "string" ||
      signature.length === 0 ||
      signature.length > 1024 * 1024 ||
      /[^\p{ASCII}]/u.test(signature))
  )
    throw invalid();
  const intent = reference.intent;
  if (intent.Operation === "download") {
    if (Object.keys(input).length !== 0) throw invalid();
    return {};
  }
  const body: ExecuteBody = signature === undefined ? {} : { Signature: signature };
  if (intent.Storage === "s3") {
    if (Object.hasOwn(input, "bytes") || !uploaded) throw invalid();
    body.Payload = { Kind: "s3", Version: uploaded.VersionId };
    if (
      new TextEncoder().encode(JSON.stringify(body)).length >
      Math.min(capability.MaxControlBytes, capability.MaxInlineRequestBytes)
    )
      throw new ISecureTransferError("size");
    return body;
  }
  const bytes = input.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.length !== intent.Integrity.RawBytes) throw invalid();
  if (bytes.length > capability.MaxRawUploadBytes) throw new ISecureTransferError("size");
  // JSON escaping of detached signatures is part of the actual request budget.
  const overhead = new TextEncoder().encode(
    JSON.stringify({
      ...body,
      Payload: { Kind: "inline", Encoding: intent.AcceptGzip ? "gzip" : "identity", Data: "" },
    }),
  ).length;
  if (overhead > capability.MaxControlBytes) throw new ISecureTransferError("size");
  const encoded = await encodeTransferRepresentation(bytes, intent.AcceptGzip, options);
  try {
    if (encoded.integrity.Sha256 !== intent.Integrity.Sha256) throw invalid();
    const shell = { ...body, Payload: { Kind: "inline" as const, Encoding: encoded.encoding, Data: "" } };
    const controlBytes = new TextEncoder().encode(JSON.stringify(shell)).length;
    if (
      controlBytes > capability.MaxControlBytes ||
      controlBytes + 4 * Math.ceil(encoded.bytes.length / 3) > capability.MaxInlineRequestBytes
    )
      throw new ISecureTransferError("size");
    const chunks: string[] = [];
    for (let offset = 0; offset < encoded.bytes.length; offset += 8192)
      chunks.push(String.fromCharCode(...encoded.bytes.subarray(offset, offset + 8192)));
    shell.Payload.Data = btoa(chunks.join(""));
    return shell;
  } finally {
    encoded.bytes.fill(0);
  }
}
