import { describe, expect, it } from "vitest";
import { iso20022Operations } from "../generated/iso20022-contracts.js";
import { Iso20022HttpTransport } from "../iso20022/transport.js";
import { createPlatformClient, platformOperationIds, type PlatformTransport } from "./client.js";

class RecordingTransport implements PlatformTransport {
  readonly calls: { operationId: string; input: unknown; metadata: unknown }[] = [];

  invoke<Input, Result>(operationId: string, input: Input, metadata: unknown): Promise<Result> {
    this.calls.push({ operationId, input, metadata });
    return Promise.resolve({ operationId } as Result);
  }
}

describe("Platform API client", () => {
  it("lists the catalogue and links artifacts through generated routes", async () => {
    const transport = new RecordingTransport();
    const client = createPlatformClient(transport);
    await client.pluginCatalogue.list({ search_text: "bank" });
    await client.pluginArtifact.get({
      provider_id: "isecure.provider.synthetic",
      package_id: "isecure.connector.synthetic",
      package_version: "1.0.0",
      artifact: "package",
    });
    expect(transport.calls).toEqual([
      { operationId: "plugin_catalogue.list", input: { search_text: "bank" }, metadata: { contractVersion: 1 } },
      {
        operationId: "plugin_artifact.get",
        input: {
          provider_id: "isecure.provider.synthetic",
          package_id: "isecure.connector.synthetic",
          package_version: "1.0.0",
          artifact: "package",
        },
        metadata: { contractVersion: 1 },
      },
    ]);
    expect(iso20022Operations["plugin_catalogue.list"]).toMatchObject({ method: "GET", path: "/v1/plugin-catalogue" });
    expect(iso20022Operations["plugin_artifact.get"]).toMatchObject({ method: "GET" });
  });

  it("never links the whole listing: the Platform API is the only listing authority", () => {
    expect(platformOperationIds).toEqual(["plugin_artifact.get", "plugin_catalogue.list"]);
    expect(Object.keys(iso20022Operations)).not.toContain("plugin_registry_index.get");
    const client = createPlatformClient(new RecordingTransport());
    expect("pluginRegistryIndex" in client).toBe(false);
  });

  it("runs over the authenticated Processing transport", () => {
    const transport: PlatformTransport = new Iso20022HttpTransport({
      baseUrl: "https://processing.invalid",
      bootstrapAuthentication: () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" }),
      processingAudience: "isecure-processing-gpgtest-v1",
      fetch: () => Promise.reject(new Error("offline")),
    });
    expect(createPlatformClient(transport).pluginCatalogue.list).toBeTypeOf("function");
  });
});
