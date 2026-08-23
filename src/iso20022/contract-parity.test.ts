import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { iso20022Operations } from "../generated/iso20022-contracts.js";

const PLATFORM_REVISION = "3795299a2a506b27bc17c69ffbffad9cd3647f9f";
const SIMULATION_OPERATION_IDS = [
  "simulation_artifacts.list",
  "simulation_branches.create",
  "simulation_capabilities.list",
  "simulation_checkpoints.create",
  "simulation_clocks.control",
  "simulation_events.list",
  "simulation_runs.get",
  "simulation_runs.list",
  "simulation_runs.start",
  "simulation_scenarios.create",
  "simulation_scenarios.get",
  "simulation_scenarios.list",
  "simulation_scenarios.revise",
  "simulation_workspaces.activate",
  "simulation_workspaces.close",
  "simulation_workspaces.create",
  "simulation_workspaces.get",
  "simulation_workspaces.list",
  "simulation_workspaces.reset",
  "simulation_workspaces.revise",
  "simulation_workspaces.suspend",
] as const;
const SIMULATION_OPERATION_VERSIONS: Record<(typeof SIMULATION_OPERATION_IDS)[number], number> = {
  "simulation_artifacts.list": 3,
  "simulation_branches.create": 4,
  "simulation_capabilities.list": 4,
  "simulation_checkpoints.create": 4,
  "simulation_clocks.control": 4,
  "simulation_events.list": 3,
  "simulation_runs.get": 4,
  "simulation_runs.list": 4,
  "simulation_runs.start": 4,
  "simulation_scenarios.create": 4,
  "simulation_scenarios.get": 3,
  "simulation_scenarios.list": 3,
  "simulation_scenarios.revise": 4,
  "simulation_workspaces.activate": 4,
  "simulation_workspaces.close": 4,
  "simulation_workspaces.create": 4,
  "simulation_workspaces.get": 4,
  "simulation_workspaces.list": 4,
  "simulation_workspaces.reset": 4,
  "simulation_workspaces.revise": 4,
  "simulation_workspaces.suspend": 4,
};

interface PlatformContractLock {
  schemaVersion: number;
  source: {
    repository: string;
    revision: string;
    processingClientSha256: string;
    processingOpenApiSha256: string;
    processingMockSha256: string;
  };
  generatedMock: {
    path: string;
    sha256: string;
  };
  generated: {
    path: string;
    sha256: string;
    operationIds: string[];
  };
}

describe("generated platform contract parity", () => {
  it("binds the exposed operation inventory to one digest-pinned platform revision", async () => {
    const root = resolve(import.meta.dirname, "../..");
    const lock = JSON.parse(
      await readFile(resolve(root, "platform-contracts.lock.json"), "utf8"),
    ) as PlatformContractLock;
    const [generated, generatedMock] = await Promise.all([
      readFile(resolve(root, lock.generated.path)),
      readFile(resolve(root, lock.generatedMock.path)),
    ]);

    expect(lock.schemaVersion).toBe(1);
    expect(lock.source.repository).toBe("isecurefi/bankfiles-platform");
    expect(lock.source.revision).toBe(PLATFORM_REVISION);
    expect(lock.source.processingClientSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.source.processingOpenApiSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.source.processingMockSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.generated.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.generatedMock.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(createHash("sha256").update(generated).digest("hex")).toBe(lock.generated.sha256);
    expect(createHash("sha256").update(generatedMock).digest("hex")).toBe(lock.generatedMock.sha256);
    expect(JSON.parse(generatedMock.toString("utf8"))).toMatchObject({
      source: {
        safety: {
          syntheticOnly: true,
          tenantAuthority: false,
          customerData: false,
          productionCredentials: false,
          genericTools: [],
          filesystemAccess: false,
          networkAccess: false,
          financialSideEffects: false,
        },
      },
    });
    expect(Object.keys(iso20022Operations)).toEqual(lock.generated.operationIds);
    expect(
      Object.values(iso20022Operations).every((operation) => operation.method === "GET" || operation.method === "POST"),
    ).toBe(true);
    expect(
      Object.values(iso20022Operations).every((operation) => operation.requestBody === (operation.method === "POST")),
    ).toBe(true);
    expect(
      Object.values(iso20022Operations).every(
        (operation) => operation.expectedVersion === "none" || operation.idempotency === "required",
      ),
    ).toBe(true);
    for (const operation of Object.values(iso20022Operations)) {
      expect(operation.idempotencyKeySchema).toEqual(
        operation.idempotency === "required"
          ? { type: "string", minLength: 1, maxLength: 256, pattern: "^[!-~]+(?![\\s\\S])" }
          : null,
      );
      expect(operation.expectedResourceVersionSchema).toEqual(
        operation.expectedVersion === "required"
          ? { type: "string", minLength: null, maxLength: null, pattern: '^"(?:0|[1-9][0-9]*)"$' }
          : null,
      );
    }
    expect(new Set(Object.values(iso20022Operations).map((operation) => operation.contractDigest)).size).toBe(
      lock.generated.operationIds.length,
    );
  });

  it("selects the exact public Bank Simulation authority contract without private or agent tools", async () => {
    const selected = Object.keys(iso20022Operations).filter((operationId) => operationId.startsWith("simulation_"));
    const generatedMock = JSON.parse(
      await readFile(resolve(import.meta.dirname, "../../test-data/generated/iso20022-scenarios.json"), "utf8"),
    ) as {
      operations: { operationId: string; version: number; bindings: { adapter: string }[] }[];
    };
    const simulationMocks = generatedMock.operations.filter(({ operationId }) => operationId.startsWith("simulation_"));

    expect(selected).toEqual(SIMULATION_OPERATION_IDS);
    expect(iso20022Operations).not.toHaveProperty("bank_simulation.apply_transition");
    expect(simulationMocks.map(({ operationId }) => operationId)).toEqual(SIMULATION_OPERATION_IDS);
    for (const operationId of SIMULATION_OPERATION_IDS) {
      const operation = iso20022Operations[operationId];
      const mock = simulationMocks.find(({ operationId: candidate }) => candidate === operationId);
      expect(operation.version).toBe(SIMULATION_OPERATION_VERSIONS[operationId]);
      expect(operation.permission).toBe("manage_simulation");
      expect(operation.audiences).toEqual(["admin", "cli", "rest", "typescript"]);
      expect(operation.successResponse).toMatchObject({ kind: "json" });
      expect(operation.contractDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(operation.idempotency).toBe(operation.method === "POST" ? "required" : "none");
      expect(mock?.version).toBe(SIMULATION_OPERATION_VERSIONS[operationId]);
      expect(mock?.bindings.map(({ adapter }) => adapter)).toEqual(["rest", "typescript", "cli", "admin"]);
    }
  });

  it("retains generated revision-reference and snapshot-pagination schemas", () => {
    const getOperations = [
      iso20022Operations["simulation_runs.get"],
      iso20022Operations["simulation_scenarios.get"],
      iso20022Operations["simulation_workspaces.get"],
    ];
    for (const operation of getOperations) {
      expect(operation.parameters).toEqual([
        {
          name: "resource_reference",
          location: "path",
          inputField: "resource_reference",
          required: true,
          style: "simple",
          objectFields: ["resource_type", "resource_id", "resource_version", "revision_id"],
        },
      ]);
    }

    for (const operationId of SIMULATION_OPERATION_IDS.filter((operationId) => operationId.endsWith(".list"))) {
      const page = iso20022Operations[operationId].parameters.find((parameter) => parameter.name === "page");
      expect(page).toMatchObject({
        location: "query",
        required: true,
        style: "deepObject",
        objectFields: ["page_size", "cursor"],
      });
    }
  });
});
