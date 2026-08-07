import {
  iso20022Operations,
  type Iso20022OperationId,
  type ProcessingRequestMetadata,
} from "../generated/iso20022-contracts.js";

const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_ACCESS_TOKEN_LENGTH = 16 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 5 * 60_000;
const MAX_REQUEST_URL_LENGTH = 16 * 1024;

export interface Iso20022Transport {
  invoke<Input, Result>(
    operationId: Iso20022OperationId,
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
  /** Maximum serialized request bytes. Defaults to 1 MiB and cannot exceed 16 MiB. */
  maxRequestBytes?: number;
  /** Maximum accepted response bytes. Defaults to 1 MiB and cannot exceed 16 MiB. */
  maxResponseBytes?: number;
  /** Request timeout in milliseconds. Defaults to 30 seconds and cannot exceed 5 minutes. */
  timeoutMs?: number;
}

export type Iso20022TransportErrorCode =
  | "invalid_configuration"
  | "malformed_response"
  | "request_too_large"
  | "request_failed"
  | "response_too_large"
  | "serialization_failed"
  | "unsupported_operation";

/** Local transport/configuration failure before a typed API result exists. */
export class Iso20022TransportError extends Error {
  readonly code: Iso20022TransportErrorCode;

  constructor(code: Iso20022TransportErrorCode, message: string) {
    super(message);
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
 * Fetch adapter for the selected generated ISO client operations. It serializes the
 * generated REST binding exactly once and deliberately adds no retry,
 * validation, profile, policy, or workflow behavior.
 */
export class Iso20022HttpTransport implements Iso20022Transport {
  private readonly baseUrl: URL;
  private readonly accessToken: AccessTokenProvider;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly maxRequestBytes: number;
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
    this.maxRequestBytes = parseByteLimit(
      options.maxRequestBytes,
      DEFAULT_MAX_REQUEST_BYTES,
      MAX_REQUEST_BYTES,
      "maxRequestBytes",
    );
    this.maxResponseBytes = parseByteLimit(
      options.maxResponseBytes,
      DEFAULT_MAX_RESPONSE_BYTES,
      MAX_RESPONSE_BYTES,
      "maxResponseBytes",
    );
    this.timeoutMs = parseTimeoutMs(options.timeoutMs);
  }

  async invoke<Input, Result>(
    operationId: Iso20022OperationId,
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
    const headers = buildHeaders(token, operation, metadata);
    const requestBody = operation.requestBody ? serializeRequestBody(inputRecord, this.maxRequestBytes) : undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const request: RequestInit = {
        method: operation.method,
        headers,
        signal: controller.signal,
      };
      if (requestBody !== undefined) request.body = requestBody;
      try {
        const response = await this.fetchImplementation(url, request);
        const responseBody = await parseResponse(response, this.maxResponseBytes);
        if (!response.ok) throw new Iso20022HttpError(response.status, responseBody);
        return responseBody as Result;
      } catch (cause) {
        if (cause instanceof Iso20022TransportError || cause instanceof Iso20022HttpError) throw cause;
        throw new Iso20022TransportError(
          "request_failed",
          controller.signal.aborted ? "The Processing API request timed out" : "The Processing API request failed",
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

type Iso20022Operation = (typeof iso20022Operations)[Iso20022OperationId];

function lookupOperation(operationId: Iso20022OperationId): Iso20022Operation {
  if (!Object.prototype.hasOwnProperty.call(iso20022Operations, operationId)) {
    throw new Iso20022TransportError("unsupported_operation", "The operation is not exposed by this surface");
  }
  return iso20022Operations[operationId];
}

function parseBaseUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = new URL(value.toString());
  } catch {
    throw new Iso20022TransportError("invalid_configuration", "The Processing API base URL is invalid");
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
      "The Processing API base URL must use HTTPS (or loopback HTTP) without credentials, query, or fragment",
    );
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function parseByteLimit(value: number | undefined, defaultValue: number, maximum: number, label: string): number {
  const selected = value ?? defaultValue;
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum) {
    throw new Iso20022TransportError(
      "invalid_configuration",
      `${label} must be an integer from 1 through ${String(maximum)}`,
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
  let token: unknown;
  try {
    token = typeof provider === "function" ? await provider() : provider;
  } catch {
    throw new Iso20022TransportError("request_failed", "The bearer credential could not be resolved");
  }
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

function buildHeaders(
  token: string,
  operation: Iso20022Operation,
  metadata: ProcessingRequestMetadata,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "ISECure-Contract-Version": String(operation.version),
  };
  bindRequiredHeader(
    headers,
    "Idempotency-Key",
    operation.idempotency,
    metadata.idempotencyKey,
    operation.idempotencyKeySchema,
  );
  bindRequiredHeader(
    headers,
    "If-Match",
    operation.expectedVersion,
    metadata.expectedResourceVersion,
    operation.expectedResourceVersionSchema,
  );
  if (operation.requestBody) headers["Content-Type"] = "application/json";
  return headers;
}

function bindRequiredHeader(
  headers: Record<string, string>,
  name: string,
  mode: "none" | "required",
  value: string | undefined,
  schema: GeneratedStringSchema | null,
): void {
  if (mode === "none") {
    if (value !== undefined) {
      throw new Iso20022TransportError("serialization_failed", `${name} is not accepted by this operation`);
    }
    return;
  }
  if (schema === null || value === undefined || !matchesGeneratedStringSchema(value, schema)) {
    throw new Iso20022TransportError("serialization_failed", `${name} is invalid or missing`);
  }
  headers[name] = value;
}

interface GeneratedStringSchema {
  readonly type: "string";
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly pattern: string | null;
}

function matchesGeneratedStringSchema(value: string, schema: GeneratedStringSchema): boolean {
  const length = Array.from(value).length;
  return (
    (schema.minLength === null || length >= schema.minLength) &&
    (schema.maxLength === null || length <= schema.maxLength) &&
    (schema.pattern === null || new RegExp(schema.pattern, "u").test(value))
  );
}

function buildUrl(baseUrl: URL, operation: Iso20022Operation, input: Record<string, unknown>): URL {
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
    } else if (parameter.style === "deepObject") {
      appendDeepObject(url, parameter.name, parameter.inputField, parameter.objectFields, value);
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

function appendDeepObject(
  url: URL,
  parameterName: string,
  inputField: string,
  objectFields: readonly string[],
  value: unknown,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Iso20022TransportError("serialization_failed", `Query field ${inputField} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(objectFields);
  if (Object.keys(record).some((field) => !allowed.has(field))) {
    throw new Iso20022TransportError("serialization_failed", `Query field ${inputField} has an unknown member`);
  }
  for (const field of objectFields) {
    const fieldValue = record[field];
    if (fieldValue !== undefined) {
      url.searchParams.append(`${parameterName}[${field}]`, serializeQueryValue(`${inputField}.${field}`, fieldValue));
    }
  }
}

function serializeQueryValue(field: string, value: unknown): string {
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new Iso20022TransportError("serialization_failed", `Query field ${field} is not a JSON scalar`);
}

function serializeRequestBody(input: Record<string, unknown>, maxBytes: number): string {
  let body: string | undefined;
  try {
    body = JSON.stringify(input, (_key, value: unknown) => {
      if (
        typeof value === "bigint" ||
        typeof value === "function" ||
        typeof value === "symbol" ||
        (typeof value === "number" && !Number.isFinite(value))
      ) {
        throw new TypeError("request contains a non-JSON value");
      }
      return value;
    });
  } catch {
    throw new Iso20022TransportError("serialization_failed", "The operation input is not valid JSON");
  }
  if (!body?.startsWith("{")) {
    throw new Iso20022TransportError("serialization_failed", "The operation input must serialize as an object");
  }
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new Iso20022TransportError("request_too_large", "The Processing API request exceeds the byte limit");
  }
  return body;
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
  } catch {
    throw new Iso20022TransportError("malformed_response", "The Processing API response is not valid UTF-8");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Iso20022TransportError("malformed_response", "The Processing API response is not valid JSON");
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
