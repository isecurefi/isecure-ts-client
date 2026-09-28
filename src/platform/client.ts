import type {
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
export const platformOperationIds = ["plugin_artifact.get", "plugin_catalogue.list"] as const;

/**
 * The Platform API: the per-tenant, per-role plugin catalogue, the only listing authority, and
 * short-lived links to a listed release's signed package or resource bundle. Each listed entry
 * carries its complete canonical release entry; the whole listing is never linked. Links are bearer
 * capabilities: fetch them promptly and verify the bytes against their signatures.
 */
export function createPlatformClient(transport: PlatformTransport) {
  return {
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
