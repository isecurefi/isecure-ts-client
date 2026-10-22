import type { Iso20022OperationId, ProcessingRequestMetadata } from "../generated/iso20022-contracts.js";
import {
  Iso20022HttpError,
  Iso20022TransportError,
  buildOperationHeaders,
  buildUrl,
  lookupOperation,
  parseBaseUrl,
  parseByteLimit,
  parseResponse,
  parseTimeoutMs,
  requireInputRecord,
  resolveBootstrapAuthentication,
  serializeRequestBody,
  type Iso20022Transport,
  type ProcessingBootstrapAuthenticationProvider,
} from "./transport.js";

export interface SimulationAdminHttpTransportOptions {
  readonly baseUrl: string | URL;
  /** Resolve the current WS login for every request; no Processing session is exchanged. */
  readonly authentication: ProcessingBootstrapAuthenticationProvider;
  readonly fetch?: typeof globalThis.fetch;
  readonly maxResponseBytes?: number;
  readonly timeoutMs?: number;
  /** Abort when the owning login ends. Later calls through this transport are then refused. */
  readonly signal?: AbortSignal;
}

export class SimulationAdminHttpError extends Iso20022HttpError {
  readonly retryAfterMs: number | undefined;
  constructor(status: number, body: unknown, retryAfter?: string | null) {
    super(status, body);
    const milliseconds =
      retryAfter == null
        ? Number.NaN
        : /^\d+$/u.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Date.parse(retryAfter) - Date.now();
    this.retryAfterMs = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : undefined;
    this.name = "SimulationAdminHttpError";
    this.message = `ISECure Simulator administration request failed with HTTP ${String(status)}`;
  }
}

const administrationOperations: ReadonlySet<Iso20022OperationId> = new Set([
  "simulation_files.import",
  "simulation_files.read",
  "simulation_runs.start",
  "simulation_runs.list",
  "simulation_runs.get",
  "simulation_artifacts.list",
  "simulation_events.list",
  "simulation_capabilities.list",
  "simulation_workspaces.list",
  "simulation_workspaces.get",
  "simulation_workspaces.create",
  "simulation_workspaces.revise",
  "simulation_workspaces.activate",
  "simulation_workspaces.suspend",
  "simulation_workspaces.close",
  "simulation_scenarios.list",
  "simulation_scenarios.get",
  "simulation_scenarios.create",
  "simulation_scenarios.revise",
]);

/** One bounded request per invocation. Explicit retries must retain the original command options. */
export class SimulationAdminHttpTransport implements Pick<Iso20022Transport, "invoke"> {
  private readonly baseUrl: URL;
  private readonly authentication: ProcessingBootstrapAuthenticationProvider;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly maxResponseBytes: number;
  private readonly timeoutMs: number;
  private readonly signal: AbortSignal | undefined;

  constructor(options: SimulationAdminHttpTransportOptions) {
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
    this.signal = options.signal;
  }

  async invoke<Input, Result>(
    operationId: Iso20022OperationId,
    input: Input,
    metadata: ProcessingRequestMetadata,
  ): Promise<Result> {
    if (!administrationOperations.has(operationId)) {
      throw new Iso20022TransportError(
        "unsupported_operation",
        "This operation is not exposed by the Simulator administration transport",
      );
    }
    const operation = lookupOperation(operationId);
    if (metadata.contractVersion !== operation.version) {
      throw new Iso20022TransportError("serialization_failed", "Invalid Simulator administration contract version");
    }
    const record = requireInputRecord(input);
    const url = buildUrl(this.baseUrl, operation, record);
    const headers = buildOperationHeaders(operation, metadata);
    const body = operation.requestBody ? serializeRequestBody(record, 256 * 1024) : undefined;
    const controller = new AbortController();
    const cancel = () => {
      controller.abort();
    };
    this.signal?.addEventListener("abort", cancel, { once: true });
    if (this.signal?.aborted) cancel();
    const timer = setTimeout(cancel, this.timeoutMs);
    const cancellation = new Promise<never>((_resolve, reject) => {
      const refuse = () => {
        reject(new Error("Request cancelled"));
      };
      controller.signal.addEventListener("abort", refuse, { once: true });
      if (controller.signal.aborted) refuse();
    });
    const send = async (): Promise<Result> => {
      controller.signal.throwIfAborted();
      const authentication = await resolveBootstrapAuthentication(this.authentication);
      controller.signal.throwIfAborted();
      const response = await this.fetchImplementation(url, {
        method: operation.method,
        headers: { ...headers, Authorization: `Bearer ${authentication.idToken}`, "x-api-key": authentication.apiKey },
        ...(body === undefined ? {} : { body }),
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      const result = await parseResponse(response, this.maxResponseBytes);
      controller.signal.throwIfAborted();
      if (!response.ok)
        throw new SimulationAdminHttpError(response.status, result, response.headers.get("retry-after"));
      return result as Result;
    };
    try {
      return await Promise.race([send(), cancellation]);
    } catch (cause) {
      if (cause instanceof Iso20022TransportError || cause instanceof Iso20022HttpError) throw cause;
      throw new Iso20022TransportError("request_failed", "The Simulator administration request did not complete");
    } finally {
      clearTimeout(timer);
      this.signal?.removeEventListener("abort", cancel);
      controller.abort();
    }
  }
}
