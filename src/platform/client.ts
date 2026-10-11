import { iso20022Operations } from "../generated/iso20022-contracts.js";
import type {
  IntegrationActiveConnectorInput,
  IntegrationActiveConnectorResult,
  IntegrationDraftInput,
  IntegrationGetInput,
  IntegrationGetResult,
  IntegrationListInput,
  IntegrationListResult,
  IntegrationReviseInput,
  IntegrationSetupAnswerInput,
  IntegrationSetupBeginInput,
  IntegrationSetupReadInput,
  IntegrationSetupResult,
  IntegrationSetupTransitionInput,
  IntegrationTransitionInput,
  IntegrationWriteResult,
  ProcessingCommandOptions,
  ProcessingRevisionCommandOptions,
  PluginArtifactGetInput,
  PluginArtifactLink,
  PluginCatalogueListInput,
  PluginCatalogueListResult,
  ProcessingRequestMetadata,
} from "../generated/iso20022-contracts.js";

/**
 * The authenticated Processing transport the Platform API shares (ADR 0093). `Iso20022HttpTransport`
 * implements it: it exchanges the signed-in session and resolves each generated operation's route.
 */
export interface PlatformTransport {
  invoke<Input, Result>(
    operationId: (typeof platformOperationIds)[number],
    input: Input,
    metadata: ProcessingRequestMetadata,
  ): Promise<Result>;
}

const version1: ProcessingRequestMetadata = { contractVersion: 1 };

/** The generated Processing operations this client owns; the ISO 20022 client does not project them. */
export const platformOperationIds = [
  "integrations.activate",
  "integrations.approve",
  "integrations.create_draft",
  "integrations.get",
  "integrations.list",
  "integrations.pause",
  "integrations.resolve_active_connector",
  "integrations.revise_draft",
  "integrations.revoke",
  "integrations.setup_answer",
  "integrations.setup_begin",
  "integrations.setup_cancel",
  "integrations.setup_read",
  "integrations.setup_resume",
  "integrations.submit_for_review",
  "plugin_artifact.get",
  "plugin_catalogue.list",
] as const;

/**
 * The Platform API: governed Integration lifecycle/setup, the per-account plugin catalogue, and
 * short-lived links to a listed release's signed package or resource bundle. Each listed entry
 * carries its complete canonical release entry; the whole listing is never linked. Links are bearer
 * capabilities: fetch them promptly and verify the bytes against their signatures.
 */
export function createPlatformClient(transport: PlatformTransport) {
  return {
    integrations: {
      activate: (input: IntegrationTransitionInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationTransitionInput, IntegrationWriteResult>(transport, "integrations.activate", input, options),
      approve: (input: IntegrationTransitionInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationTransitionInput, IntegrationWriteResult>(transport, "integrations.approve", input, options),
      createDraft: (input: IntegrationDraftInput, options: ProcessingCommandOptions) =>
        invoke<IntegrationDraftInput, IntegrationWriteResult>(transport, "integrations.create_draft", input, options),
      get: (input: IntegrationGetInput) =>
        invoke<IntegrationGetInput, IntegrationGetResult>(transport, "integrations.get", input),
      list: (input: IntegrationListInput) =>
        invoke<IntegrationListInput, IntegrationListResult>(transport, "integrations.list", input),
      pause: (input: IntegrationTransitionInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationTransitionInput, IntegrationWriteResult>(transport, "integrations.pause", input, options),
      resolveActiveConnector: (input: IntegrationActiveConnectorInput) =>
        invoke<IntegrationActiveConnectorInput, IntegrationActiveConnectorResult>(
          transport,
          "integrations.resolve_active_connector",
          input,
        ),
      reviseDraft: (input: IntegrationReviseInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationReviseInput, IntegrationWriteResult>(transport, "integrations.revise_draft", input, options),
      revoke: (input: IntegrationTransitionInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationTransitionInput, IntegrationWriteResult>(transport, "integrations.revoke", input, options),
      setupAnswer: (input: IntegrationSetupAnswerInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationSetupAnswerInput, IntegrationSetupResult>(
          transport,
          "integrations.setup_answer",
          input,
          options,
        ),
      setupBegin: (input: IntegrationSetupBeginInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationSetupBeginInput, IntegrationSetupResult>(
          transport,
          "integrations.setup_begin",
          input,
          options,
        ),
      setupCancel: (input: IntegrationSetupTransitionInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationSetupTransitionInput, IntegrationSetupResult>(
          transport,
          "integrations.setup_cancel",
          input,
          options,
        ),
      setupRead: (input: IntegrationSetupReadInput) =>
        invoke<IntegrationSetupReadInput, IntegrationSetupResult>(transport, "integrations.setup_read", input),
      setupResume: (input: IntegrationSetupTransitionInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationSetupTransitionInput, IntegrationSetupResult>(
          transport,
          "integrations.setup_resume",
          input,
          options,
        ),
      submitForReview: (input: IntegrationTransitionInput, options: ProcessingRevisionCommandOptions) =>
        invoke<IntegrationTransitionInput, IntegrationWriteResult>(
          transport,
          "integrations.submit_for_review",
          input,
          options,
        ),
    },
    pluginCatalogue: {
      list: (input: PluginCatalogueListInput) =>
        transport.invoke<PluginCatalogueListInput, PluginCatalogueListResult>("plugin_catalogue.list", input, version1),
    },
    pluginArtifact: {
      get: (input: PluginArtifactGetInput) =>
        transport.invoke<PluginArtifactGetInput, PluginArtifactLink>("plugin_artifact.get", input, version1),
    },
  };
}

export type PlatformClient = ReturnType<typeof createPlatformClient>;

function invoke<Input, Result>(
  transport: PlatformTransport,
  operationId: (typeof platformOperationIds)[number],
  input: Input,
  options: Omit<ProcessingRequestMetadata, "contractVersion"> = {},
): Promise<Result> {
  return transport.invoke<Input, Result>(operationId, input, {
    ...options,
    contractVersion: iso20022Operations[operationId].version,
  });
}
