import {
  iso20022ObservationOperations,
  type Iso20022ObservationOperationId,
  type ProcessingRequestMetadata,
} from "../generated/iso20022-observations.js";

const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_ACCESS_TOKEN_LENGTH = 16 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 5 * 60_000;
const MAX_REQUEST_URL_LENGTH = 16 * 1024;

export interface Iso20022Transport {
  invoke<Input, Result>(
    operationId: Iso20022ObservationOperationId,
    input: Input,
    metadata: ProcessingRequestMetadata,
  ): Promise<Result>;
}

export type AccessTokenProvider = string | (() => string | Promise<string>);

export interface Iso20022HttpTransportOptions {
  /** Absolute Processing API base URL selected by the deployment. */
  baseUrl: string | URL;
  /** Bearer credential or a provider called once immediately before each request. */
  accessToken: AccessTokenProvider;
  /** Optional fetch implementation for non-browser runtimes and tests. */
  fetch?: typeof globalThis.fetch;
  /** Maximum accepted response bytes. Defaults to 1 MiB and cannot exceed 16 MiB. */
  maxResponseBytes?: number;
  /** Request timeout in milliseconds. Defaults to 30 seconds and cannot exceed 5 minutes. */
  timeoutMs?: number;
}

export type Iso20022TransportErrorCode =
  | "invalid_configuration"
  | "malformed_response"
  | "response_too_large"
  | "serialization_failed"
  | "unsupported_operation";

/** Local transport/configuration failure before a typed API result exists. */
export class Iso20022TransportError extends Error {
  readonly code: Iso20022TransportErrorCode;

  constructor(code: Iso20022TransportErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "Iso20022TransportError";
    this.code = code;
  }
}

/** A non-success Processing API response carrying its generated issue envelope. */
export class Iso20022HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`ISECure Processing API request failed with HTTP ${String(status)}`);
    this.name = "Iso20022HttpError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Fetch adapter for the generated observation operations. It serializes the
 * generated REST binding exactly once and deliberately adds no retry,
 * validation, profile, policy, or workflow behavior.
 */
export class Iso20022HttpTransport implements Iso20022Transport {
  private readonly baseUrl: URL;
  private readonly accessToken: AccessTokenProvider;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly maxResponseBytes: number;
  private readonly timeoutMs: number;

  constructor(options: Iso20022HttpTransportOptions) {
    this.baseUrl = parseBaseUrl(options.baseUrl);
    this.accessToken = options.accessToken;
    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new Iso20022TransportError("invalid_configuration", "A fetch implementation is required");
    }
    this.fetchImplementation = fetchImplementation;
    this.maxResponseBytes = parseMaxResponseBytes(options.maxResponseBytes);
    this.timeoutMs = parseTimeoutMs(options.timeoutMs);
  }

  async invoke<Input, Result>(
    operationId: Iso20022ObservationOperationId,
    input: Input,
    metadata: ProcessingRequestMetadata,
  ): Promise<Result> {
    const operation = lookupOperation(operationId);
    if (metadata.contractVersion !== operation.version) {
      throw new Iso20022TransportError("serialization_failed", `Contract version mismatch for ${operationId}`);
    }
    const inputRecord = requireInputRecord(input);
    const url = buildUrl(this.baseUrl, operation, inputRecord);
    const token = await resolveAccessToken(this.accessToken);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const response = await this.fetchImplementation(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "ISECure-Contract-Version": String(operation.version),
        },
        signal: controller.signal,
      });
      const body = await parseResponse(response, this.maxResponseBytes);
      if (!response.ok) throw new Iso20022HttpError(response.status, body);
      return body as Result;
    } finally {
      clearTimeout(timer);
    }
  }
}

type ObservationOperation = (typeof iso20022ObservationOperations)[Iso20022ObservationOperationId];

function lookupOperation(operationId: Iso20022ObservationOperationId): ObservationOperation {
  if (!Object.prototype.hasOwnProperty.call(iso20022ObservationOperations, operationId)) {
    throw new Iso20022TransportError("unsupported_operation", "The operation is not exposed by this surface");
  }
  return iso20022ObservationOperations[operationId];
}

function parseBaseUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = new URL(value.toString());
  } catch (cause) {
    throw new Iso20022TransportError("invalid_configuration", "The Processing API base URL is invalid", {
      cause,
    });
  }
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Iso20022TransportError(
      "invalid_configuration",
      "The Processing API base URL must be an HTTP(S) URL without credentials, query, or fragment",
    );
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function parseMaxResponseBytes(value: number | undefined): number {
  const selected = value ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > MAX_RESPONSE_BYTES) {
    throw new Iso20022TransportError(
      "invalid_configuration",
      `maxResponseBytes must be an integer from 1 through ${String(MAX_RESPONSE_BYTES)}`,
    );
  }
  return selected;
}

function parseTimeoutMs(value: number | undefined): number {
  const selected = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > MAX_TIMEOUT_MS) {
    throw new Iso20022TransportError(
      "invalid_configuration",
      `timeoutMs must be an integer from 1 through ${String(MAX_TIMEOUT_MS)}`,
    );
  }
  return selected;
}

async function resolveAccessToken(provider: AccessTokenProvider): Promise<string> {
  const token = typeof provider === "function" ? await provider() : provider;
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_ACCESS_TOKEN_LENGTH ||
    token.trim() !== token ||
    hasAsciiControl(token)
  ) {
    throw new Iso20022TransportError("invalid_configuration", "The bearer credential is invalid");
  }
  return token;
}

function hasAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}

function requireInputRecord(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Iso20022TransportError("serialization_failed", "Operation input must be an object");
  }
  return input as Record<string, unknown>;
}

function buildUrl(baseUrl: URL, operation: ObservationOperation, input: Record<string, unknown>): URL {
  let path: string = operation.path;
  const url = new URL(operation.path.slice(1), baseUrl);
  for (const parameter of operation.parameters) {
    const value = input[parameter.inputField];
    if (value === undefined) {
      if (parameter.required) {
        throw new Iso20022TransportError("serialization_failed", `Missing required field ${parameter.inputField}`);
      }
      continue;
    }
    if (parameter.location === "path") {
      if (typeof value !== "string" || value.length === 0) {
        throw new Iso20022TransportError("serialization_failed", `Path field ${parameter.inputField} must be a string`);
      }
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(value));
    } else {
      url.searchParams.append(parameter.name, serializeQueryValue(parameter.inputField, value));
    }
  }
  url.pathname = new URL(path.slice(1), baseUrl).pathname;
  if (new TextEncoder().encode(url.href).byteLength > MAX_REQUEST_URL_LENGTH) {
    throw new Iso20022TransportError("serialization_failed", "The generated request URL exceeds the byte limit");
  }
  return url;
}

function serializeQueryValue(field: string, value: unknown): string {
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new Iso20022TransportError("serialization_failed", `Query field ${field} is not a JSON scalar`);
}

async function parseResponse(response: Response, maxBytes: number): Promise<Record<string, unknown>> {
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json" && !mediaType?.endsWith("+json")) {
    throw new Iso20022TransportError("malformed_response", "The Processing API response is not JSON");
  }
  const bytes = await readBoundedResponse(response, maxBytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new Iso20022TransportError("malformed_response", "The Processing API response is not valid UTF-8", {
      cause,
    });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (cause) {
    throw new Iso20022TransportError("malformed_response", "The Processing API response is not valid JSON", {
      cause,
    });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Iso20022TransportError("malformed_response", "The Processing API response must be an object");
  }
  return body as Record<string, unknown>;
}

async function readBoundedResponse(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/u.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new Iso20022TransportError("response_too_large", "The Processing API response exceeds the byte limit");
  }
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Iso20022TransportError("response_too_large", "The Processing API response exceeds the byte limit");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}
