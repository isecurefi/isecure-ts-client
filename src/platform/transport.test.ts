import { describe, expect, it, vi } from "vitest";
import { PluginHttpTransport } from "./transport.js";

const authentication = () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" });
const metadata = { contractVersion: 1 } as const;
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("standalone Plugin HTTP transport", () => {
  it("uses the current WS identity directly without a Processing session exchange", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ entries: [] }));
    const transport = new PluginHttpTransport({ baseUrl: "https://plugins.example.test", authentication, fetch });
    await expect(transport.invoke("plugin_catalogue.list", {}, metadata)).resolves.toEqual({ entries: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
    const call = fetch.mock.calls[0];
    if (call === undefined) throw new Error("Missing request");
    const [url, request] = call;
    expect((url as URL).href).toBe("https://plugins.example.test/v1/plugin-catalogue");
    expect(request).toMatchObject({ method: "GET", redirect: "error", cache: "no-store", credentials: "omit" });
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer synthetic-token",
      "x-api-key": "synthetic-key",
      "ISECure-Contract-Version": "1",
    });
  });

  it("uses generated artifact path and query bindings and resolves identity for every request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => json({}));
    const current = vi.fn(authentication);
    const transport = new PluginHttpTransport({
      baseUrl: "https://plugins.example.test",
      authentication: current,
      fetch,
    });
    await transport.invoke(
      "plugin_artifact.get",
      { provider_id: "some/provider", package_id: "package", package_version: "1.0.0", artifact: "package" },
      metadata,
    );
    await transport.invoke("plugin_catalogue.list", {}, metadata);
    expect((fetch.mock.calls[0]?.[0] as URL).href).toContain("/v1/plugin-artifact/some%2Fprovider?");
    expect(current).toHaveBeenCalledTimes(2);
  });

  it("never retries refused or throttled requests", async () => {
    for (const status of [401, 403, 429, 503]) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ code: "denied" }, status));
      const transport = new PluginHttpTransport({ baseUrl: "https://plugins.example.test", authentication, fetch });
      await expect(transport.invoke("plugin_catalogue.list", {}, metadata)).rejects.toMatchObject({
        status,
        name: "PluginHttpError",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects unrelated operations, invalid metadata and credentials before network access", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const transport = new PluginHttpTransport({ baseUrl: "https://plugins.example.test", authentication, fetch });
    await expect(transport.invoke("integrations.list", {}, metadata)).rejects.toMatchObject({
      code: "unsupported_operation",
    });
    await expect(transport.invoke("plugin_catalogue.list", {}, { contractVersion: 2 })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    const invalid = new PluginHttpTransport({
      baseUrl: "https://plugins.example.test",
      authentication: () => ({ apiKey: "a\nb", idToken: "token" }),
      fetch,
    });
    await expect(invalid.invoke("plugin_catalogue.list", {}, metadata)).rejects.toMatchObject({
      code: "invalid_configuration",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds responses and refuses malformed bodies", async () => {
    for (const response of [
      new Response("not-json", { headers: { "Content-Type": "application/json" } }),
      json([]),
      json({ large: "x".repeat(100) }),
    ]) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
      const transport = new PluginHttpTransport({
        baseUrl: "https://plugins.example.test",
        authentication,
        fetch,
        maxResponseBytes: 50,
      });
      await expect(transport.invoke("plugin_catalogue.list", {}, metadata)).rejects.toMatchObject({
        name: "Iso20022TransportError",
      });
    }
  });

  it("cancels stalled network calls at the configured deadline", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
      (_url, request) =>
        new Promise((_resolve, reject) => {
          request?.signal?.addEventListener(
            "abort",
            () => {
              reject(new Error("private detail"));
            },
            { once: true },
          );
        }),
    );
    const transport = new PluginHttpTransport({
      baseUrl: "https://plugins.example.test",
      authentication,
      fetch,
      timeoutMs: 5,
    });
    await expect(transport.invoke("plugin_catalogue.list", {}, metadata)).rejects.toMatchObject({
      code: "request_failed",
    });
  });

  it("rejects unsafe endpoints and invalid limits", () => {
    for (const baseUrl of [
      "http://remote.example.test",
      "https://user:password@example.test",
      "https://example.test?token=x",
    ]) {
      expect(() => new PluginHttpTransport({ baseUrl, authentication })).toThrow();
    }
    expect(() => new PluginHttpTransport({ baseUrl: "https://example.test", authentication, timeoutMs: 0 })).toThrow();
    expect(
      () => new PluginHttpTransport({ baseUrl: "https://example.test", authentication, maxResponseBytes: 0 }),
    ).toThrow();
  });
});
