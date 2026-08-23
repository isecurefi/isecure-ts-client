import {
  iso20022Operations,
  type Iso20022OperationId,
  type PaymentExportResource,
  type ProcessingRequestMetadata,
} from "../generated/iso20022-contracts.js";

const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 5 * 60_000;
const MAX_REQUEST_URL_LENGTH = 16 * 1024;
const MAX_BOOTSTRAP_CREDENTIAL_LENGTH = 16 * 1024;
const PROCESSING_SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FORBIDDEN_LOCAL_SECRET_FIELDS = new Set([
  "armoredprivatekey",
  "detachedsignature",
  "keypassword",
  "passphrase",
  "password",
  "pgpprivatekey",
  "privatekey",
  "privatekeybytes",
  "secretkey",
  "signaturebytes",
]);

export interface Iso20022Transport {
  invoke<Input, Result>(
    operationId: Iso20022OperationId,
    input: Input,
    metadata: ProcessingRequestMetadata,
  ): Promise<Result>;
  downloadPaymentExport(
    input: unknown,
    metadata: ProcessingRequestMetadata,
    authority: PaymentExportContentAuthority,
  ): Promise<VerifiedPaymentExportContent>;
  downloadPaymentExportTo(
    input: unknown,
    metadata: ProcessingRequestMetadata,
    authority: PaymentExportContentAuthority,
    sink: PaymentExportContentSink,
  ): Promise<VerifiedPaymentExportContentMetadata>;
}

export interface ProcessingBootstrapAuthentication {
  readonly apiKey: string;
  readonly idToken: string;
}
export type ProcessingBootstrapAuthenticationProvider = () =>
  ProcessingBootstrapAuthentication | Promise<ProcessingBootstrapAuthentication>;

export interface ProcessingSessionMetadata {
  readonly audience: string;
  readonly expiresAtEpochSeconds: number;
  readonly schemaVersion: 1;
  readonly tokenType: "Processing";
}

export type PaymentExportContentAuthority = Readonly<
  Pick<PaymentExportResource, "artifact_id" | "artifact_digest" | "artifact_byte_length" | "artifact_media_type">
>;

export type VerifiedPaymentExportContentMetadata = PaymentExportContentAuthority;

export interface VerifiedPaymentExportContent extends VerifiedPaymentExportContentMetadata {
  readonly bytes: Uint8Array;
}

/** Called exactly once, and only after the complete response passes every integrity check. */
export type PaymentExportContentSink = (bytes: Uint8Array) => void | Promise<void>;

export interface Iso20022HttpTransportOptions {
  /** Absolute Processing API base URL selected by the deployment. */
  baseUrl: string | URL;
  /** Reads current WSChannel authentication only while exchanging a separate Processing session. */
  bootstrapAuthentication: ProcessingBootstrapAuthenticationProvider;
  /** Exact deployment-owned audience expected in the Processing session response. */
  processingAudience: string;
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
  | "invalid_session"
  | "integrity_check_failed"
  | "malformed_response"
  | "request_too_large"
  | "request_failed"
  | "response_too_large"
  | "sink_failed"
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

/** The authenticated tenant has no active commercial entitlement for the requested Processing operation. */
export class ProcessingEntitlementDeniedError extends Iso20022HttpError {
  readonly code = "processing_entitlement_denied" as const;

  constructor(body: unknown) {
    super(403, body);
    this.name = "ProcessingEntitlementDeniedError";
  }
}

/**
 * Fetch adapter for the selected generated ISO client operations. It serializes the
 * generated REST binding exactly once and deliberately adds no retry,
 * validation, profile, policy, or workflow behavior.
 */
export class Iso20022HttpTransport implements Iso20022Transport {
  private readonly baseUrl: URL;
  private readonly bootstrapAuthentication: ProcessingBootstrapAuthenticationProvider;
  private readonly processingAudience: string;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly maxRequestBytes: number;
  private readonly maxResponseBytes: number;
  private readonly timeoutMs: number;
  private processingSession: ProcessingSessionCredential | undefined;

  constructor(options: Iso20022HttpTransportOptions) {
    this.baseUrl = parseBaseUrl(options.baseUrl);
    this.bootstrapAuthentication = options.bootstrapAuthentication;
    this.processingAudience = parseProcessingAudience(options.processingAudience);
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

  /** Exchange the shared WSChannel identity for a short-lived, audience-bound Processing session. */
  async exchangeProcessingSession(): Promise<ProcessingSessionMetadata> {
    this.processingSession = undefined;
    const authentication = await resolveBootstrapAuthentication(this.bootstrapAuthentication);
    const controller = new AbortController();
    const timer = abortAfter(controller, this.timeoutMs);
    try {
      const response = await this.fetchImplementation(new URL("session", this.baseUrl), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: authentication.idToken,
          "x-api-key": authentication.apiKey,
        },
        redirect: "error",
        signal: controller.signal,
      });
      const body = await parseResponse(response, this.maxResponseBytes);
      if (!response.ok) throw processingHttpError(response.status, body);
      const session = parseProcessingSession(body, authentication.apiKey, this.processingAudience);
      this.processingSession = session;
      return sessionMetadata(session);
    } catch (cause) {
      if (cause instanceof Iso20022TransportError || cause instanceof Iso20022HttpError) throw cause;
      throw requestFailure(controller);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Forget the Processing credential immediately; shared WSChannel authentication is untouched. */
  clearProcessingSession(): void {
    this.processingSession = undefined;
  }

  get processingSessionMetadata(): ProcessingSessionMetadata | undefined {
    return this.processingSession === undefined ? undefined : sessionMetadata(this.processingSession);
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
    if (operation.successResponse.kind !== "json") {
      throw new Iso20022TransportError("unsupported_operation", "The operation requires the verified binary path");
    }
    const inputRecord = requireInputRecord(input);
    const url = buildUrl(this.baseUrl, operation, inputRecord);
    const session = this.requireProcessingSession();
    const headers = buildHeaders(session, operation, metadata);
    const requestBody = operation.requestBody ? serializeRequestBody(inputRecord, this.maxRequestBytes) : undefined;
    const controller = new AbortController();
    const timer = abortAfter(controller, this.timeoutMs);
    try {
      const request: RequestInit = {
        method: operation.method,
        headers,
        redirect: "error",
        signal: controller.signal,
      };
      if (requestBody !== undefined) request.body = requestBody;
      try {
        const response = await this.fetchImplementation(url, request);
        const responseBody = await parseResponse(response, this.maxResponseBytes);
        if (!response.ok) throw processingHttpError(response.status, responseBody);
        return responseBody as Result;
      } catch (cause) {
        if (cause instanceof Iso20022TransportError || cause instanceof Iso20022HttpError) throw cause;
        throw requestFailure(controller);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async downloadPaymentExport(
    input: unknown,
    metadata: ProcessingRequestMetadata,
    authority: PaymentExportContentAuthority,
  ): Promise<VerifiedPaymentExportContent> {
    const verified = await this.downloadVerified(input, metadata, authority);
    return { ...verified.metadata, bytes: verified.bytes };
  }

  async downloadPaymentExportTo(
    input: unknown,
    metadata: ProcessingRequestMetadata,
    authority: PaymentExportContentAuthority,
    sink: PaymentExportContentSink,
  ): Promise<VerifiedPaymentExportContentMetadata> {
    if (typeof sink !== "function") {
      throw new Iso20022TransportError("invalid_configuration", "A payment-export content sink is required");
    }
    const verified = await this.downloadVerified(input, metadata, authority);
    try {
      await sink(verified.bytes.slice());
    } catch {
      throw new Iso20022TransportError("sink_failed", "The caller-owned payment-export sink failed");
    }
    return verified.metadata;
  }

  private requireProcessingSession(): ProcessingSessionCredential {
    const session = this.processingSession;
    if (
      session?.audience !== this.processingAudience ||
      session?.expiresAtEpochSeconds === undefined ||
      session.expiresAtEpochSeconds <= Math.floor(Date.now() / 1000)
    ) {
      this.processingSession = undefined;
      throw new Iso20022TransportError("invalid_session", "A current audience-bound Processing session is required");
    }
    return session;
  }

  private async downloadVerified(
    input: unknown,
    metadata: ProcessingRequestMetadata,
    authority: PaymentExportContentAuthority,
  ): Promise<{ readonly bytes: Uint8Array; readonly metadata: VerifiedPaymentExportContentMetadata }> {
    const operation = lookupOperation("payment_exports.download_content");
    if (operation.successResponse.kind !== "binary") {
      throw new Iso20022TransportError("unsupported_operation", "The generated payment-export response is not binary");
    }
    if (metadata.contractVersion !== operation.version) {
      throw new Iso20022TransportError(
        "serialization_failed",
        "Contract version mismatch for payment_exports.download_content",
      );
    }
    const responseLimit = Math.min(this.maxResponseBytes, operation.successResponse.maximumBytes);
    const expected = validateContentAuthority(authority, operation.successResponse.mediaType, responseLimit);
    const inputRecord = requireInputRecord(input);
    const url = buildUrl(this.baseUrl, operation, inputRecord);
    const session = this.requireProcessingSession();
    const headers = buildHeaders(session, operation, metadata);
    const requestBody = serializeRequestBody(inputRecord, this.maxRequestBytes);
    const controller = new AbortController();
    const timer = abortAfter(controller, this.timeoutMs);
    try {
      const response = await this.fetchImplementation(url, {
        method: operation.method,
        body: requestBody,
        headers,
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await parseResponse(response, this.maxResponseBytes);
        throw processingHttpError(response.status, body);
      }
      const verified = await parseVerifiedBinaryResponse(response, responseLimit, operation.successResponse, expected);
      return verified;
    } catch (cause) {
      if (cause instanceof Iso20022TransportError || cause instanceof Iso20022HttpError) throw cause;
      throw requestFailure(controller);
    } finally {
      clearTimeout(timer);
    }
  }
}

interface ProcessingSessionCredential extends ProcessingSessionMetadata {
  readonly apiKey: string;
  readonly processingSession: string;
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

async function resolveBootstrapAuthentication(
  provider: ProcessingBootstrapAuthenticationProvider,
): Promise<ProcessingBootstrapAuthentication> {
  let authentication: unknown;
  try {
    authentication = await provider();
  } catch {
    throw new Iso20022TransportError("request_failed", "The Processing bootstrap identity could not be resolved");
  }
  const candidate = authentication as Partial<ProcessingBootstrapAuthentication> | null;
  const apiKey = candidate?.apiKey;
  const idToken = candidate?.idToken;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    !validCredential(apiKey) ||
    !validCredential(idToken)
  ) {
    throw new Iso20022TransportError("invalid_configuration", "The Processing bootstrap identity is invalid");
  }
  return { apiKey, idToken };
}

function validCredential(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_BOOTSTRAP_CREDENTIAL_LENGTH &&
    value.trim() === value &&
    !hasAsciiControl(value)
  );
}

function parseProcessingAudience(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    value.trim() !== value ||
    hasAsciiControl(value)
  ) {
    throw new Iso20022TransportError("invalid_configuration", "The Processing session audience is invalid");
  }
  return value;
}

function parseProcessingSession(
  body: Record<string, unknown>,
  apiKey: string,
  expectedAudience: string,
): ProcessingSessionCredential {
  const expectedKeys = ["audience", "expiresAtEpochSeconds", "processingSession", "schemaVersion", "tokenType"];
  if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Iso20022TransportError("invalid_session", "The Processing session response is malformed");
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    body.audience !== expectedAudience ||
    body.schemaVersion !== 1 ||
    body.tokenType !== "Processing" ||
    typeof body.processingSession !== "string" ||
    !PROCESSING_SESSION_TOKEN_PATTERN.test(body.processingSession) ||
    typeof body.expiresAtEpochSeconds !== "number" ||
    !Number.isSafeInteger(body.expiresAtEpochSeconds) ||
    body.expiresAtEpochSeconds <= now ||
    body.expiresAtEpochSeconds > now + 15 * 60
  ) {
    throw new Iso20022TransportError("invalid_session", "The Processing session response is invalid");
  }
  return {
    apiKey,
    audience: expectedAudience,
    expiresAtEpochSeconds: body.expiresAtEpochSeconds,
    processingSession: body.processingSession,
    schemaVersion: 1,
    tokenType: "Processing",
  };
}

function sessionMetadata(session: ProcessingSessionCredential): ProcessingSessionMetadata {
  return {
    audience: session.audience,
    expiresAtEpochSeconds: session.expiresAtEpochSeconds,
    schemaVersion: session.schemaVersion,
    tokenType: session.tokenType,
  };
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
  session: ProcessingSessionCredential,
  operation: Iso20022Operation,
  metadata: ProcessingRequestMetadata,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: operation.successResponse.mediaType,
    Authorization: `Processing ${session.processingSession}`,
    "ISECure-Contract-Version": String(operation.version),
    "x-api-key": session.apiKey,
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
      path = path.replace(
        `{${parameter.name}}`,
        parameter.objectFields.length === 0
          ? serializePathScalar(parameter.inputField, value)
          : serializeSimplePathObject(parameter.inputField, parameter.objectFields, value),
      );
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

function serializePathScalar(field: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Iso20022TransportError("serialization_failed", `Path field ${field} must be a string`);
  }
  return encodeURIComponent(value);
}

function serializeSimplePathObject(field: string, objectFields: readonly string[], value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Iso20022TransportError("serialization_failed", `Path field ${field} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(objectFields);
  if (Object.keys(record).some((member) => !allowed.has(member))) {
    throw new Iso20022TransportError("serialization_failed", `Path field ${field} has an unknown member`);
  }
  const components: string[] = [];
  for (const member of objectFields) {
    const memberValue = record[member];
    if (memberValue !== undefined) {
      components.push(
        encodeURIComponent(member),
        encodeURIComponent(serializeQueryValue(`${field}.${member}`, memberValue)),
      );
    }
  }
  if (components.length === 0) {
    throw new Iso20022TransportError("serialization_failed", `Path field ${field} must not be empty`);
  }
  return components.join(",");
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
    body = JSON.stringify(input, (key, value: unknown) => {
      if (FORBIDDEN_LOCAL_SECRET_FIELDS.has(key.replaceAll(/[^A-Za-z0-9]/gu, "").toLowerCase())) {
        throw new TypeError("request contains local secret material");
      }
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

function processingHttpError(status: number, body: Record<string, unknown>): Iso20022HttpError {
  if (status === 403 && hasIssueCode(body, "processing_entitlement_denied")) {
    return new ProcessingEntitlementDeniedError(body);
  }
  return new Iso20022HttpError(status, body);
}

function hasIssueCode(body: Record<string, unknown>, expected: string): boolean {
  const issues = body.issues;
  return (
    Array.isArray(issues) &&
    issues.some(
      (issue) =>
        issue !== null &&
        typeof issue === "object" &&
        !Array.isArray(issue) &&
        (issue as Record<string, unknown>).issue_code === expected,
    )
  );
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

function validateContentAuthority(
  authority: PaymentExportContentAuthority,
  mediaType: string,
  maximumBytes: number,
): VerifiedPaymentExportContentMetadata {
  const byteLength = parsePositiveByteLength(authority?.artifact_byte_length);
  if (
    authority === null ||
    typeof authority !== "object" ||
    !UUID_PATTERN.test(authority.artifact_id) ||
    !SHA256_PATTERN.test(authority.artifact_digest) ||
    authority.artifact_media_type !== mediaType ||
    byteLength === undefined ||
    byteLength > maximumBytes
  ) {
    throw new Iso20022TransportError("invalid_configuration", "The payment-export authority is invalid");
  }
  return {
    artifact_id: authority.artifact_id,
    artifact_digest: authority.artifact_digest,
    artifact_byte_length: authority.artifact_byte_length,
    artifact_media_type: authority.artifact_media_type,
  };
}

function parsePositiveByteLength(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

async function parseVerifiedBinaryResponse(
  response: Response,
  maxBytes: number,
  success: Extract<Iso20022Operation["successResponse"], { readonly kind: "binary" }>,
  expected: VerifiedPaymentExportContentMetadata,
): Promise<{ readonly bytes: Uint8Array; readonly metadata: VerifiedPaymentExportContentMetadata }> {
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const artifactId = response.headers.get(success.headers.artifactId);
  const artifactDigest = response.headers.get(success.headers.artifactDigest);
  const contentLength = parsePositiveByteLength(response.headers.get(success.headers.contentLength));
  const expectedLength = parsePositiveByteLength(expected.artifact_byte_length);
  if (
    mediaType !== success.mediaType ||
    artifactId !== expected.artifact_id ||
    artifactDigest !== expected.artifact_digest ||
    contentLength === undefined ||
    expectedLength === undefined ||
    contentLength !== expectedLength ||
    contentLength > maxBytes
  ) {
    throw new Iso20022TransportError("integrity_check_failed", "Payment-export response metadata did not match");
  }
  const bytes = await readBoundedResponse(response, maxBytes);
  if (bytes.byteLength !== contentLength || (await sha256(bytes)) !== expected.artifact_digest) {
    throw new Iso20022TransportError("integrity_check_failed", "Payment-export response bytes did not match");
  }
  return { bytes, metadata: expected };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Iso20022TransportError("invalid_configuration", "Web Crypto SHA-256 is required");
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = new Uint8Array(await subtle.digest("SHA-256", copy.buffer));
  return `sha256:${Array.from(digest, (value) => {
    return value.toString(16).padStart(2, "0");
  }).join("")}`;
}

function abortAfter(controller: AbortController, timeoutMs: number): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    controller.abort();
  }, timeoutMs);
}

function requestFailure(controller: AbortController): Iso20022TransportError {
  return new Iso20022TransportError(
    "request_failed",
    controller.signal.aborted ? "The Processing API request timed out" : "The Processing API request failed",
  );
}
