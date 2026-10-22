import type {
  ImportSimulationFileInput,
  ReadSimulationFileInput,
  SimulationFileImportResult,
  SimulationFileContentResult,
  SimulationRunGetResult,
  SimulationRunListInput,
  SimulationRunListResult,
  StartSimulationRunInput,
  SimulationRunMutationResult,
  SimulationArtifactListInput,
  SimulationArtifactListResult,
  SimulationEventListInput,
  SimulationEventListResult,
  CreateSimulationScenarioInput,
  CreateSimulationWorkspaceInput,
  ProcessingCommandOptions,
  ProcessingRevisionCommandOptions,
  ReviseSimulationScenarioInput,
  ReviseSimulationWorkspaceInput,
  SimulationCapabilityListInput,
  SimulationCapabilityListResult,
  SimulationResourceGetInput,
  SimulationScenarioGetResult,
  SimulationScenarioListInput,
  SimulationScenarioListResult,
  SimulationScenarioMutationResult,
  SimulationWorkspaceGetResult,
  SimulationWorkspaceListInput,
  SimulationWorkspaceListResult,
  SimulationWorkspaceMutationResult,
  TransitionSimulationWorkspaceInput,
} from "../generated/iso20022-contracts.js";
import type { Iso20022Transport } from "./transport.js";
import { invoke } from "./operation.js";

/** Independent administration; discover runtime availability before offering execution. */
export function createSimulationAdminClient(transport: Pick<Iso20022Transport, "invoke">) {
  const simulationWorkspaceTransition = (
    operationId: "simulation_workspaces.activate" | "simulation_workspaces.close" | "simulation_workspaces.suspend",
    input: TransitionSimulationWorkspaceInput,
    options: ProcessingRevisionCommandOptions,
  ) =>
    invoke<TransitionSimulationWorkspaceInput, SimulationWorkspaceMutationResult>(
      transport,
      operationId,
      input,
      options,
    );

  return {
    simulationFiles: {
      import: (input: ImportSimulationFileInput, options: ProcessingCommandOptions) =>
        invoke<ImportSimulationFileInput, SimulationFileImportResult>(
          transport,
          "simulation_files.import",
          input,
          options,
        ),
      read: (input: ReadSimulationFileInput) =>
        invoke<ReadSimulationFileInput, SimulationFileContentResult>(transport, "simulation_files.read", input),
    },
    simulationRuns: {
      get: (input: SimulationResourceGetInput) =>
        invoke<SimulationResourceGetInput, SimulationRunGetResult>(transport, "simulation_runs.get", input),
      list: (input: SimulationRunListInput) =>
        invoke<SimulationRunListInput, SimulationRunListResult>(transport, "simulation_runs.list", input),
      start: (input: StartSimulationRunInput, options: ProcessingCommandOptions) =>
        invoke<StartSimulationRunInput, SimulationRunMutationResult>(
          transport,
          "simulation_runs.start",
          input,
          options,
        ),
    },
    simulationArtifacts: {
      list: (input: SimulationArtifactListInput) =>
        invoke<SimulationArtifactListInput, SimulationArtifactListResult>(
          transport,
          "simulation_artifacts.list",
          input,
        ),
    },
    simulationEvents: {
      list: (input: SimulationEventListInput) =>
        invoke<SimulationEventListInput, SimulationEventListResult>(transport, "simulation_events.list", input),
    },
    simulationCapabilities: {
      list: (input: SimulationCapabilityListInput) =>
        invoke<SimulationCapabilityListInput, SimulationCapabilityListResult>(
          transport,
          "simulation_capabilities.list",
          input,
        ),
    },
    simulationScenarios: {
      create: (input: CreateSimulationScenarioInput, options: ProcessingCommandOptions) =>
        invoke<CreateSimulationScenarioInput, SimulationScenarioMutationResult>(
          transport,
          "simulation_scenarios.create",
          input,
          options,
        ),
      get: (input: SimulationResourceGetInput) =>
        invoke<SimulationResourceGetInput, SimulationScenarioGetResult>(transport, "simulation_scenarios.get", input),
      list: (input: SimulationScenarioListInput) =>
        invoke<SimulationScenarioListInput, SimulationScenarioListResult>(
          transport,
          "simulation_scenarios.list",
          input,
        ),
      revise: (input: ReviseSimulationScenarioInput, options: ProcessingRevisionCommandOptions) =>
        invoke<ReviseSimulationScenarioInput, SimulationScenarioMutationResult>(
          transport,
          "simulation_scenarios.revise",
          input,
          options,
        ),
    },
    simulationWorkspaces: {
      activate: (input: TransitionSimulationWorkspaceInput, options: ProcessingRevisionCommandOptions) =>
        simulationWorkspaceTransition("simulation_workspaces.activate", input, options),
      close: (input: TransitionSimulationWorkspaceInput, options: ProcessingRevisionCommandOptions) =>
        simulationWorkspaceTransition("simulation_workspaces.close", input, options),
      create: (input: CreateSimulationWorkspaceInput, options: ProcessingCommandOptions) =>
        invoke<CreateSimulationWorkspaceInput, SimulationWorkspaceMutationResult>(
          transport,
          "simulation_workspaces.create",
          input,
          options,
        ),
      get: (input: SimulationResourceGetInput) =>
        invoke<SimulationResourceGetInput, SimulationWorkspaceGetResult>(transport, "simulation_workspaces.get", input),
      list: (input: SimulationWorkspaceListInput) =>
        invoke<SimulationWorkspaceListInput, SimulationWorkspaceListResult>(
          transport,
          "simulation_workspaces.list",
          input,
        ),
      revise: (input: ReviseSimulationWorkspaceInput, options: ProcessingRevisionCommandOptions) =>
        invoke<ReviseSimulationWorkspaceInput, SimulationWorkspaceMutationResult>(
          transport,
          "simulation_workspaces.revise",
          input,
          options,
        ),
      suspend: (input: TransitionSimulationWorkspaceInput, options: ProcessingRevisionCommandOptions) =>
        simulationWorkspaceTransition("simulation_workspaces.suspend", input, options),
    },
  } as const;
}

export type SimulationAdminClient = ReturnType<typeof createSimulationAdminClient>;

export type SimulationConfigurationClient = Pick<
  SimulationAdminClient,
  "simulationCapabilities" | "simulationScenarios" | "simulationWorkspaces"
>;
