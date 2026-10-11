import { afterEach, describe, expect, it, vi } from "vitest";
import { Iso20022HttpTransport } from "../iso20022/transport.js";
import { createPlatformClient, type IntegrationSetupAnswerInput, type IntegrationSetupResult } from "./index.js";

const integrationId = "00000000-0000-4000-8000-000000000800";
const setupSessionId = "00000000-0000-4000-8000-000000000801";
const retryId = "00000000-0000-4000-8000-000000000802";
const audience = "isecure-processing-gpgtest-v1";

function setupResult(operationId = "integrations.setup_begin"): IntegrationSetupResult {
  return {
    context: {
      request_id: retryId,
      operation_id: operationId,
      contract_version: "1",
      accepted_at: "2026-10-11T00:00:00Z",
      authorization: { authorization_decision_id: retryId, decided_at: "2026-10-11T00:00:00Z" },
    },
    setup_session_id: setupSessionId,
    checkpoint_generation: "3",
    status: "active",
  };
}

function session() {
  return Response.json({
    audience,
    expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
    processingSession: "A".repeat(43),
    schemaVersion: 1,
    tokenType: "Processing",
  });
}

function requestBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
  return JSON.parse(init.body) as unknown;
}

function clientWith(response: () => Response) {
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    requests.push({ url, init });
    return Promise.resolve(url.pathname.endsWith("/session") ? session() : response());
  });
  const transport = new Iso20022HttpTransport({
    baseUrl: "https://processing.example.test/",
    bootstrapAuthentication: () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" }),
    processingAudience: audience,
    fetch,
  });
  return { client: createPlatformClient(transport), transport, requests };
}

describe("hosted Integration setup through the public Platform client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("begins the exact retained draft using generated routing and separate retry/version headers", async () => {
    const result = setupResult();
    const { client, transport, requests } = clientWith(() => Response.json(result));
    await transport.exchangeProcessingSession();
    const input = { integration_id: integrationId, expected_revision: "7" };
    await expect(
      client.integrations.setupBegin(input, { idempotencyKey: retryId, expectedResourceVersion: '"7"' }),
    ).resolves.toEqual(result);
    expect(requests).toHaveLength(2);
    const operation = requests[1];
    expect(operation?.url.pathname).toBe("/v1/integrations:setup-begin");
    expect(operation?.init?.method).toBe("POST");
    const headers = new Headers(operation?.init?.headers);
    expect(headers.get("ISECure-Contract-Version")).toBe("1");
    expect(headers.get("Idempotency-Key")).toBe(retryId);
    expect(headers.get("If-Match")).toBe('"7"');
    expect(requestBody(operation?.init)).toEqual(input);
    expect(operation?.url.search).toBe("");
  });

  it("reopens the retained session without command headers or a new setup", async () => {
    const result = setupResult("integrations.setup_read");
    const { client, transport, requests } = clientWith(() => Response.json(result));
    await transport.exchangeProcessingSession();
    await expect(client.integrations.setupRead({ setup_session_id: setupSessionId })).resolves.toEqual(result);
    expect(requests.map(({ url }) => url.pathname)).toEqual(["/session", "/v1/integrations:setup-read"]);
    const operation = requests[1];
    expect(operation?.init?.method).toBe("POST");
    expect(requestBody(operation?.init)).toEqual({ setup_session_id: setupSessionId });
    const headers = new Headers(operation?.init?.headers);
    expect(headers.get("ISECure-Contract-Version")).toBe("1");
    expect(headers.has("Idempotency-Key")).toBe(false);
    expect(headers.has("If-Match")).toBe(false);
  });

  it.each([
    ["setupResume", "setup-resume"],
    ["setupCancel", "setup-cancel"],
  ] as const)("%s targets the saved session and checkpoint without creating another draft", async (method, route) => {
    const { client, transport, requests } = clientWith(() => Response.json(setupResult()));
    await transport.exchangeProcessingSession();
    const input = Object.freeze({ setup_session_id: setupSessionId, expected_checkpoint_generation: "3" });
    await client.integrations[method](input, { idempotencyKey: retryId, expectedResourceVersion: '"3"' });
    expect(requests).toHaveLength(2);
    const operation = requests[1];
    expect(operation?.url.pathname).toBe(`/v1/integrations:${route}`);
    expect(operation?.init?.method).toBe("POST");
    expect(requestBody(operation?.init)).toEqual(input);
    const headers = new Headers(operation?.init?.headers);
    expect(headers.get("Idempotency-Key")).toBe(retryId);
    expect(headers.get("If-Match")).toBe('"3"');
  });

  it("answers only the retained challenge, preserving the user's selected option", async () => {
    const { client, transport, requests } = clientWith(() => Response.json(setupResult()));
    await transport.exchangeProcessingSession();
    const input: IntegrationSetupAnswerInput = {
      setup_session_id: setupSessionId,
      expected_checkpoint_generation: "3",
      challenge_id: "00000000-0000-4000-8000-000000000803",
      challenge_sequence: "2",
      answer: { answer_type: "selection", option_id: "synthetic-option" },
    };
    await client.integrations.setupAnswer(input, { idempotencyKey: retryId, expectedResourceVersion: '"3"' });
    expect(requests).toHaveLength(2);
    expect(requests[1]?.url.pathname).toBe("/v1/integrations:setup-answer");
    expect(requestBody(requests[1]?.init)).toEqual(input);
  });

  it("refuses an expired session before sending a setup command", async () => {
    const { client, transport, requests } = clientWith(() => Response.json(setupResult()));
    await transport.exchangeProcessingSession();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 601_000);
    await expect(
      client.integrations.setupResume(
        { setup_session_id: setupSessionId, expected_checkpoint_generation: "3" },
        { idempotencyKey: retryId, expectedResourceVersion: '"3"' },
      ),
    ).rejects.toMatchObject({ code: "invalid_session" });
    expect(requests).toHaveLength(1);
    expect(transport.processingSessionMetadata).toBeUndefined();
  });

  it.each([401, 403, 409, 412, 503])("returns HTTP %s without silently retrying provider work", async (status) => {
    const body = { issues: [{ issue_code: "synthetic_refusal" }] };
    const { client, transport, requests } = clientWith(() => Response.json(body, { status }));
    await transport.exchangeProcessingSession();
    await expect(
      client.integrations.setupResume(
        { setup_session_id: setupSessionId, expected_checkpoint_generation: "3" },
        { idempotencyKey: retryId, expectedResourceVersion: '"3"' },
      ),
    ).rejects.toMatchObject({ status, body });
    expect(requests.map(({ url }) => url.pathname)).toEqual(["/session", "/v1/integrations:setup-resume"]);
  });

  it("allows explicit reauthentication and retry of the same saved command without replacing its identity", async () => {
    let authorized = false;
    const { client, transport, requests } = clientWith(() =>
      authorized
        ? Response.json(setupResult("integrations.setup_resume"))
        : Response.json({ issues: [] }, { status: 401 }),
    );
    const input = Object.freeze({ setup_session_id: setupSessionId, expected_checkpoint_generation: "3" });
    const options = Object.freeze({ idempotencyKey: retryId, expectedResourceVersion: '"3"' });
    await transport.exchangeProcessingSession();
    await expect(client.integrations.setupResume(input, options)).rejects.toMatchObject({ status: 401 });
    authorized = true;
    await transport.exchangeProcessingSession();
    await expect(client.integrations.setupResume(input, options)).resolves.toMatchObject({
      setup_session_id: setupSessionId,
    });
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      "/session",
      "/v1/integrations:setup-resume",
      "/session",
      "/v1/integrations:setup-resume",
    ]);
    expect(requests[1]?.init?.body).toBe(requests[3]?.init?.body);
    expect(new Headers(requests[3]?.init?.headers).get("Idempotency-Key")).toBe(retryId);
    expect(new Headers(requests[3]?.init?.headers).get("If-Match")).toBe('"3"');
  });
});
