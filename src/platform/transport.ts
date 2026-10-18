import type { ProcessingRequestMetadata } from "../generated/iso20022-contracts.js";
import {
  Iso20022HttpError,
  Iso20022TransportError,
  buildUrl,
  lookupOperation,
  parseBaseUrl,
  parseByteLimit,
  parseResponse,
  parseTimeoutMs,
  requireInputRecord,
  resolveBootstrapAuthentication,
  type ProcessingBootstrapAuthenticationProvider,
} from "../iso20022/transport.js";
import type { PlatformTransport } from "./client.js";

export interface PluginHttpTransportOptions {
  readonly baseUrl: string | URL;
  /** Current WS-channel identity; no Processing session or AWS credential is required. */
  readonly authentication: ProcessingBootstrapAuthenticationProvider;
  readonly fetch?: typeof globalThis.fetch;
  readonly maxResponseBytes?: number;
  readonly timeoutMs?: number;
}

export class PluginHttpError extends Iso20022HttpError {
  constructor(status: number, body: unknown) {
    super(status, body);
    this.name = "PluginHttpError";
    this.message = `ISECure Plugin API request failed with HTTP ${String(status)}`;
  }
}

/** Direct, uncached reads of the independent Plugin API using the generated wire bindings. */
export class PluginHttpTransport implements PlatformTransport {
  private readonly baseUrl: URL;
  private readonly authentication: ProcessingBootstrapAuthenticationProvider;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly maxResponseBytes: number;
  private readonly timeoutMs: number;

  constructor(options: PluginHttpTransportOptions) {
    this.baseUrl = parseBaseUrl(options.baseUrl);
    this.authentication = options.authentication;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof this.fetchImplementation !== "function") {
      throw new Iso20022TransportError("invalid_configuration", "A fetch implementation is required");
    }
    this.maxResponseBytes = parseByteLimit(
      options.maxResponseBytes,
      4 * 1024 * 1024,
      16 * 1024 * 1024,
      "maxResponseBytes",
    );
    this.timeoutMs = parseTimeoutMs(options.timeoutMs);
  }

  async invoke<Input, Result>(
    operationId: Parameters<PlatformTransport["invoke"]>[0],
    input: Input,
    metadata: ProcessingRequestMetadata,
  ): Promise<Result> {
    if (operationId !== "plugin_catalogue.list" && operationId !== "plugin_artifact.get") {
      throw new Iso20022TransportError(
        "unsupported_operation",
        "The Plugin API exposes only catalogue and artifact reads",
      );
    }
    const operation = lookupOperation(operationId);
    if (
      metadata.contractVersion !== operation.version ||
      metadata.idempotencyKey !== undefined ||
      metadata.expectedResourceVersion !== undefined
    ) {
      throw new Iso20022TransportError("serialization_failed", "Invalid Plugin API request metadata");
    }
    const url = buildUrl(this.baseUrl, operation, requireInputRecord(input));
    const authentication = await resolveBootstrapAuthentication(this.authentication);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const response = await this.fetchImplementation(url, {
        method: operation.method,
        headers: {
          Accept: operation.successResponse.mediaType,
          Authorization: `Bearer ${authentication.idToken}`,
          "x-api-key": authentication.apiKey,
          "ISECure-Contract-Version": String(operation.version),
        },
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      const body = await parseResponse(response, this.maxResponseBytes);
      if (!response.ok) throw new PluginHttpError(response.status, body);
      return body as Result;
    } catch (cause) {
      if (cause instanceof Iso20022TransportError || cause instanceof Iso20022HttpError) throw cause;
      throw new Iso20022TransportError(
        "request_failed",
        controller.signal.aborted ? "The Plugin API request timed out" : "The Plugin API request failed",
      );
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
}
