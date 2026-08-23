import { describe, expect, it, vi } from "vitest";
import type { ProcessingRevisionCommandOptions, ResourceReference } from "../generated/iso20022-contracts.js";
import { createIso20022Client } from "./client.js";
import { Iso20022HttpError, Iso20022HttpTransport } from "./transport.js";

const API_KEY = "synthetic-api-key";
const ID_TOKEN = "synthetic-id-token";
const PROCESSING_TOKEN = "S".repeat(43);
const AUDIENCE = "isecure-processing-gpgtest-v1";
const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const REVISION_ID = "00000000-0000-4000-8000-000000000002";

const workspaceReference: ResourceReference = {
  resource_type: "simulation_workspace",
  resource_id: WORKSPACE_ID,
  resource_version: "7",
  revision_id: REVISION_ID,
};
const scenarioReference: ResourceReference = {
  resource_type: "simulation_scenario",
  resource_id: "00000000-0000-4000-8000-000000000003",
  resource_version: "4",
  revision_id: "00000000-0000-4000-8000-000000000004",
};
const runReference: ResourceReference = {
  resource_type: "simulation_run",
  resource_id: "00000000-0000-4000-8000-000000000005",
  resource_version: "2",
  revision_id: "00000000-0000-4000-8000-000000000006",
};
const checkpointReference: ResourceReference = {
  resource_type: "simulation_checkpoint",
  resource_id: "00000000-0000-4000-8000-000000000007",
  resource_version: "1",
};
const revisionOptions: ProcessingRevisionCommandOptions = {
  idempotencyKey: "clock-step-11",
  expectedResourceVersion: '"7"',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readySimulator(operationFetch: typeof globalThis.fetch) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith("/session")) {
      return jsonResponse({
        audience: AUDIENCE,
        expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
        processingSession: PROCESSING_TOKEN,
        schemaVersion: 1,
        tokenType: "Processing",
      });
    }
    return operationFetch(input, init);
  });
  const transport = new Iso20022HttpTransport({
    baseUrl: "https://api.example.test/processing/",
    bootstrapAuthentication: () => ({ apiKey: API_KEY, idToken: ID_TOKEN }),
    processingAudience: AUDIENCE,
    fetch,
  });
  await transport.exchangeProcessingSession();
  return { client: createIso20022Client(transport), operationFetch, transport };
}

describe("experimental Bank Simulation Processing client", () => {
  it("serializes exact revision references and snapshot pagination without reducing either", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const { client } = await readySimulator(operationFetch);

    await client.simulationWorkspaces.get({ resource_reference: workspaceReference });
    await client.simulationEvents.list({
      workspace_reference: workspaceReference,
      event_kind: "artifact_produced",
      page: { page_size: 50, cursor: "snapshot-cursor" },
    });

    expect(String(operationFetch.mock.calls[0]?.[0])).toBe(
      `https://api.example.test/processing/v1/simulation-workspaces/resource_type,simulation_workspace,resource_id,${WORKSPACE_ID},resource_version,7,revision_id,${REVISION_ID}`,
    );
    const eventUrl = new URL(String(operationFetch.mock.calls[1]?.[0]));
    expect(Object.fromEntries(eventUrl.searchParams)).toEqual({
      "workspace_reference[resource_type]": "simulation_workspace",
      "workspace_reference[resource_id]": WORKSPACE_ID,
      "workspace_reference[resource_version]": "7",
      "workspace_reference[revision_id]": REVISION_ID,
      event_kind: "artifact_produced",
      "page[page_size]": "50",
      "page[cursor]": "snapshot-cursor",
    });
  });

  it("uses fully typed workspace, scenario, and run references with generated revision options", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const { client } = await readySimulator(operationFetch);

    await client.simulationScenarios.list({ workspace_reference: workspaceReference, page: {} });
    await client.simulationRuns.get({ resource_reference: runReference });
    await client.simulationArtifacts.list({ run_reference: runReference, page: {} });
    await client.simulationBranches.create(
      { checkpoint_reference: checkpointReference, scenario_revision_reference: scenarioReference },
      { idempotencyKey: "typed-branch" },
    );
    await client.simulationClocks.control(
      {
        workspace_reference: workspaceReference,
        expected_clock_revision: "11",
        control_kind: "step_event",
      },
      revisionOptions,
    );

    expect(operationFetch).toHaveBeenCalledTimes(5);
  });

  it("orders and encodes simple-style path members deterministically", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const { client } = await readySimulator(operationFetch);
    const shuffledReference: ResourceReference = {
      revision_id: "revision/with space",
      resource_version: "7",
      resource_id: "resource/with space",
      resource_type: "simulation/workspace",
    };

    await client.simulationWorkspaces.get({ resource_reference: shuffledReference });

    expect(String(operationFetch.mock.calls[0]?.[0])).toBe(
      "https://api.example.test/processing/v1/simulation-workspaces/resource_type,simulation%2Fworkspace,resource_id,resource%2Fwith%20space,resource_version,7,revision_id,revision%2Fwith%20space",
    );
  });

  it("rejects empty, unknown, and secret-shaped path members without leaking their names or values", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const { client } = await readySimulator(operationFetch);
    const secretField = "private_key";
    const secretValue = "local-private-key-material";

    for (const resource_reference of [
      {},
      { ...workspaceReference, unexpected: "value" },
      { ...workspaceReference, [secretField]: secretValue },
    ]) {
      const error = await client.simulationWorkspaces
        .get({ resource_reference } as never)
        .catch((cause: unknown) => cause);
      expect(error).toMatchObject({ code: "serialization_failed" });
      expect(String(error)).not.toContain("unexpected");
      expect(String(error)).not.toContain(secretField);
      expect(String(error)).not.toContain(secretValue);
    }
    expect(operationFetch).not.toHaveBeenCalled();
  });

  it("binds generated contract version, idempotency, and optimistic concurrency exactly once", async () => {
    const stale = { issues: [{ issue_code: "stale_resource_version", safe_message: "Stale revision" }] };
    const operationFetch = vi.fn(async () => jsonResponse(stale, 409));
    const { client } = await readySimulator(operationFetch);
    const input = {
      workspace_reference: workspaceReference,
      expected_clock_revision: "11",
      control_kind: "step_event",
    } as const;

    const error = await client.simulationClocks.control(input, revisionOptions).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Iso20022HttpError);
    expect(error).toMatchObject({ status: 409, body: stale });
    expect(operationFetch).toHaveBeenCalledTimes(1);
    const request = operationFetch.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        Authorization: `Processing ${PROCESSING_TOKEN}`,
        "ISECure-Contract-Version": "4",
        "Idempotency-Key": "clock-step-11",
        "If-Match": '"7"',
        "x-api-key": API_KEY,
      },
    });
    expect(JSON.parse(String(request?.body))).toEqual(input);
  });

  it("forwards substituted references only to the server authority boundary and keeps diagnostics value-free", async () => {
    const refusal = { issues: [{ issue_code: "authorization_denied", safe_message: "Denied" }] };
    const operationFetch = vi.fn(async () => jsonResponse(refusal, 403));
    const { client } = await readySimulator(operationFetch);
    const substitutedId = "00000000-0000-4000-8000-000000000099";

    const error = await client.simulationRuns
      .list({
        workspace_reference: { ...workspaceReference, resource_id: substitutedId },
        page: {},
      })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Iso20022HttpError);
    expect(error).toMatchObject({ status: 403, body: refusal });
    expect(String(error)).not.toContain(substitutedId);
    expect(operationFetch).toHaveBeenCalledTimes(1);
    expect(String(operationFetch.mock.calls[0]?.[0])).toContain(substitutedId);
  });

  it("revokes the separate Processing session without changing or reusing shared authentication", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ capabilities: [], page: {} }));
    const { client, transport } = await readySimulator(operationFetch);

    transport.clearProcessingSession();

    await expect(client.simulationCapabilities.list({ page: {} })).rejects.toMatchObject({ code: "invalid_session" });
    expect(operationFetch).not.toHaveBeenCalled();
    expect(transport.processingSessionMetadata).toBeUndefined();
  });

  it("rejects secret-shaped simulator input and over-broad pagination before network access", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const { client } = await readySimulator(operationFetch);
    const secret = "local-private-key-material";

    const secretError = await client.simulationRuns
      .start(
        {
          workspace_revision_reference: workspaceReference,
          scenario_revision_reference: { ...workspaceReference, resource_type: "simulation_scenario" },
          data_admission_mode: "synthetic",
          input: { input_type: "payment_order_revision", private_key: secret },
        } as never,
        { idempotencyKey: "run-secret-refusal" },
      )
      .catch((cause: unknown) => cause);
    expect(secretError).toMatchObject({
      code: "serialization_failed",
      message: "The operation input is not valid JSON",
    });
    expect(String(secretError)).not.toContain(secret);

    await expect(client.simulationWorkspaces.list({ page: { cursor: "x".repeat(17_000) } })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    await expect(client.simulationWorkspaces.list({ page: { unexpected: "value" } } as never)).rejects.toMatchObject({
      code: "serialization_failed",
    });
    expect(operationFetch).not.toHaveBeenCalled();
  });
});
