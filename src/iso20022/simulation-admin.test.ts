import { describe, expect, it, vi } from "vitest";
import { createSimulationAdminClient, SimulationAdminHttpTransport } from "./index.js";

const authentication = () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" });
const baseUrl = "https://simulator.example.test";
const query = { contractVersion: 4 } as const;
const command = { contractVersion: 4, idempotencyKey: "synthetic-attempt" };
const revision = { ...command, expectedResourceVersion: '"1"' };

describe("independent Simulator administration transport", () => {
  it("reads configuration with current WS identity and no Processing session", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ workspaces: [] }));
    const current = vi.fn(authentication);
    const transport = new SimulationAdminHttpTransport({ baseUrl, authentication: current, fetch });
    const client = createSimulationAdminClient(transport);
    await expect(client.simulationWorkspaces.list({ page: {} })).resolves.toEqual({ workspaces: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(current).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls[0]?.[0] as URL).href).toBe(`${baseUrl}/v1/simulation-workspaces`);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
      headers: {
        Authorization: "Bearer synthetic-token",
        "x-api-key": "synthetic-key",
        "ISECure-Contract-Version": "4",
      },
    });
    expect(client).not.toHaveProperty("paymentBatches");
    expect(client).toHaveProperty("simulationRuns");
    expect(client.simulationWorkspaces).not.toHaveProperty("reset");
  });

  it("preserves command identity, body and revision on explicit retry after response loss", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error("private network information"))
      .mockResolvedValueOnce(Response.json({ workspace: {} }));
    const transport = new SimulationAdminHttpTransport({ baseUrl, authentication, fetch });
    const input = { reason: "synthetic revision" };
    await expect(transport.invoke("simulation_workspaces.revise", input, revision)).rejects.toMatchObject({
      code: "request_failed",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await transport.invoke("simulation_workspaces.revise", input, revision);
    expect(fetch.mock.calls.map(([, request]) => request?.body)).toEqual([
      JSON.stringify(input),
      JSON.stringify(input),
    ]);
    for (const [, request] of fetch.mock.calls) {
      expect(request?.headers).toMatchObject({
        "Idempotency-Key": "synthetic-attempt",
        "If-Match": '"1"',
        "Content-Type": "application/json",
      });
    }
  });

  it("refuses unsupported execution, other services and invalid command metadata before sending", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const transport = new SimulationAdminHttpTransport({ baseUrl, authentication, fetch });
    for (const operation of [
      "simulation_clocks.control",
      "simulation_workspaces.reset",
      "plugin_catalogue.list",
      "payment_orders.list",
    ] as const) {
      await expect(transport.invoke(operation, {}, command)).rejects.toMatchObject({ code: "unsupported_operation" });
    }
    for (const metadata of [
      query,
      { ...command, expectedResourceVersion: "bad" },
      { ...revision, contractVersion: 2 },
    ]) {
      await expect(transport.invoke("simulation_workspaces.revise", {}, metadata)).rejects.toMatchObject({
        code: "serialization_failed",
      });
    }
    await expect(transport.invoke("simulation_workspaces.list", { page: {} }, command)).rejects.toMatchObject({
      code: "serialization_failed",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not retry denied, stale, expired, throttled or unavailable responses", async () => {
    for (const status of [401, 403, 409, 410, 429, 503]) {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json({ code: "unavailable" }, { status }));
      const transport = new SimulationAdminHttpTransport({ baseUrl, authentication, fetch });
      await expect(transport.invoke("simulation_workspaces.create", {}, command)).rejects.toMatchObject({
        status,
        name: "SimulationAdminHttpError",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("bounds request and response bytes and refuses local secret material", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ oversized: "x".repeat(100) }));
    const transport = new SimulationAdminHttpTransport({ baseUrl, authentication, fetch, maxResponseBytes: 50 });
    await expect(
      transport.invoke("simulation_workspaces.create", { text: "x".repeat(256 * 1024) }, command),
    ).rejects.toMatchObject({ code: "request_too_large" });
    await expect(
      transport.invoke("simulation_workspaces.create", { privateKey: "synthetic" }, command),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    expect(fetch).not.toHaveBeenCalled();
    await expect(transport.invoke("simulation_workspaces.list", { page: {} }, query)).rejects.toMatchObject({
      code: "response_too_large",
    });
  });

  it("stops in-flight work and refuses later calls when the owning login closes", async () => {
    const controller = new AbortController();
    let finish: ((response: Response) => void) | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const transport = new SimulationAdminHttpTransport({ baseUrl, authentication, fetch, signal: controller.signal });
    const pending = transport.invoke("simulation_workspaces.list", { page: {} }, query);
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    controller.abort();
    finish?.(Response.json({ workspaces: ["old-account"] }));
    await expect(pending).rejects.toMatchObject({ code: "request_failed" });
    await expect(transport.invoke("simulation_workspaces.list", { page: {} }, query)).rejects.toMatchObject({
      code: "request_failed",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("bounds stalled authentication and never sends after it resolves too late", async () => {
    let finish: ((value: ReturnType<typeof authentication>) => void) | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>();
    const transport = new SimulationAdminHttpTransport({
      baseUrl,
      fetch,
      timeoutMs: 5,
      authentication: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await expect(transport.invoke("simulation_workspaces.list", { page: {} }, query)).rejects.toMatchObject({
      code: "request_failed",
    });
    finish?.(authentication());
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds stalled fetches without requiring an injected fetch to honor cancellation", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise(() => undefined));
    const transport = new SimulationAdminHttpTransport({ baseUrl, authentication, fetch, timeoutMs: 5 });
    await expect(transport.invoke("simulation_workspaces.list", { page: {} }, query)).rejects.toMatchObject({
      code: "request_failed",
    });
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("resolves fresh identity and uses generated reference and pagination encoding", async () => {
    let identity = authentication();
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json({}));
    const transport = new SimulationAdminHttpTransport({ baseUrl, authentication: () => identity, fetch });
    const client = createSimulationAdminClient(transport);
    await client.simulationWorkspaces.get({
      resource_reference: { resource_type: "workspace", resource_id: "synthetic/resource" },
    });
    identity = { apiKey: "replacement-key", idToken: "replacement-token" };
    await client.simulationWorkspaces.list({ page: { page_size: 25, cursor: "synthetic/cursor" } });
    expect((fetch.mock.calls[0]?.[0] as URL).pathname).toBe(
      "/v1/simulation-workspaces/resource_type,workspace,resource_id,synthetic%2Fresource",
    );
    const second = fetch.mock.calls[1];
    expect((second?.[0] as URL).searchParams.get("page[cursor]")).toBe("synthetic/cursor");
    expect(second?.[1]?.headers).toMatchObject({
      Authorization: "Bearer replacement-token",
      "x-api-key": "replacement-key",
    });
  });

  it("refuses unsafe endpoints, invalid limits, missing fetch and invalid credentials", async () => {
    for (const unsafe of [
      "http://remote.example.test",
      "https://user:password@example.test",
      "https://example.test?token=x",
    ]) {
      expect(() => new SimulationAdminHttpTransport({ baseUrl: unsafe, authentication })).toThrow();
    }
    for (const limits of [{ timeoutMs: 0 }, { maxResponseBytes: 0 }]) {
      expect(() => new SimulationAdminHttpTransport({ baseUrl, authentication, ...limits })).toThrow();
    }
    const fetch = vi.fn<typeof globalThis.fetch>();
    const transport = new SimulationAdminHttpTransport({
      baseUrl,
      fetch,
      authentication: () => ({ apiKey: "bad\nkey", idToken: "token" }),
    });
    await expect(transport.invoke("simulation_workspaces.list", { page: {} }, query)).rejects.toMatchObject({
      code: "invalid_configuration",
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", undefined);
    try {
      expect(() => new SimulationAdminHttpTransport({ baseUrl, authentication })).toThrow(
        "A fetch implementation is required",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

it("imports a synthetic file and runs it using current WS identity without opening Processing", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json({}));
  const client = createSimulationAdminClient(new SimulationAdminHttpTransport({ baseUrl, authentication, fetch }));
  const workspace = {
    resource_type: "simulation_workspace",
    resource_id: "00000000-0000-4000-8000-000000000001",
    resource_version: "1",
    revision_id: "00000000-0000-4000-8000-000000000002",
  };
  const artifact = {
    artifact_reference: { ...workspace, resource_type: "artifact" },
    file_exchange_occurrence_reference: { ...workspace, resource_type: "file_exchange_occurrence" },
    role: "input" as const,
    media_type: "application/xml",
    profile_id: "synthetic",
    profile_version: "1",
  };
  await client.simulationFiles.import(
    {
      workspace_revision_reference: workspace,
      data_admission_mode: "synthetic",
      source: { source_type: "uploaded_file", content_base64: "PHN5bnRoZXRpYy8+" },
    },
    { idempotencyKey: "input-attempt" },
  );
  await client.simulationRuns.start(
    {
      workspace_revision_reference: workspace,
      scenario_revision_reference: { ...workspace, resource_type: "simulation_scenario" },
      data_admission_mode: "synthetic",
      input: { input_type: "exact_artifact", artifact },
    },
    { idempotencyKey: "run-attempt" },
  );
  await client.simulationFiles.read({ workspace_reference: workspace, artifact });
  expect(fetch.mock.calls.map(([url]) => (url as URL).pathname)).toEqual([
    "/v1/simulation-files:import",
    "/v1/simulation-runs:start",
    "/v1/simulation-files:read",
  ]);
  expect(
    fetch.mock.calls.map(([, request]) => (request?.headers as Record<string, string>)["Idempotency-Key"]),
  ).toEqual(["input-attempt", "run-attempt", undefined]);
  for (const [, request] of fetch.mock.calls)
    expect(request?.headers).toMatchObject({ Authorization: "Bearer synthetic-token", "x-api-key": "synthetic-key" });
  expect(client).not.toHaveProperty("paymentBatches");
});

it("preserves a server retry delay without automatically retrying", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({ issues: [] }, { status: 429, headers: { "retry-after": "3" } }));
  const client = createSimulationAdminClient(
    new SimulationAdminHttpTransport({
      baseUrl: "https://simulator-admin-api.test.isecure.fi",
      authentication: () => ({ idToken: "synthetic-token", apiKey: "synthetic-key" }),
      fetch,
    }),
  );
  await expect(client.simulationCapabilities.list({ page: {} })).rejects.toMatchObject({
    status: 429,
    retryAfterMs: 3000,
  });
  expect(fetch).toHaveBeenCalledOnce();
});
