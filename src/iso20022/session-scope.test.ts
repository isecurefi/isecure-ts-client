import { describe, expect, it, vi } from "vitest";
import { Iso20022HttpTransport } from "./transport.js";

const audience = "isecure-processing-gpgtest-v1";
const scope = {
  tenantId: "00000000-0000-4000-8000-000000000811",
  legalEntityId: "00000000-0000-4000-8000-000000000812",
  actorId: "00000000-0000-4000-8000-000000000813",
};
function response(schemaVersion = 2, overrides: Record<string, unknown> = {}) {
  return Response.json({
    audience,
    expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
    processingSession: "A".repeat(43),
    schemaVersion,
    tokenType: "Processing",
    ...(schemaVersion === 2 ? { scope } : {}),
    ...overrides,
  });
}
function transport(reply: () => Response) {
  const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(reply()));
  const adapter = new Iso20022HttpTransport({
    baseUrl: "https://processing.example.test/",
    bootstrapAuthentication: () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" }),
    processingAudience: audience,
    fetch,
  });
  return { adapter, fetch };
}

describe("opt-in authenticated Processing account scope", () => {
  it("requests schema 2 explicitly and exposes only server-bound scope, without the credential", async () => {
    const { adapter, fetch } = transport(() => response());
    const metadata = await adapter.exchangeProcessingSession({ schemaVersion: 2 });
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("ISECure-Session-Schema-Version")).toBe("2");
    expect(metadata).toEqual({
      audience,
      expiresAtEpochSeconds: metadata.expiresAtEpochSeconds,
      schemaVersion: 2,
      tokenType: "Processing",
      scope,
    });
    expect(metadata.expiresAtEpochSeconds).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(adapter.processingSessionMetadata).toEqual(metadata);
    expect(metadata).not.toHaveProperty("processingSession");
  });

  it("preserves schema 1 exchange and headers for existing callers", async () => {
    const { adapter, fetch } = transport(() => response(1));
    const metadata = await adapter.exchangeProcessingSession();
    expect(metadata.schemaVersion).toBe(1);
    expect(metadata).not.toHaveProperty("scope");
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has("ISECure-Session-Schema-Version")).toBe(false);
  });

  it("rejects a silent downgrade from an older server without inferring account IDs or retrying", async () => {
    const { adapter, fetch } = transport(() => response(1));
    await expect(adapter.exchangeProcessingSession({ schemaVersion: 2 })).rejects.toMatchObject({
      code: "invalid_session",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(adapter.processingSessionMetadata).toBeUndefined();
    await expect(
      adapter.invoke("integrations.setup_read", { setup_session_id: scope.actorId }, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "invalid_session" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    undefined,
    null,
    [],
    {},
    { ...scope, tenantId: "not-an-id" },
    { ...scope, tenantId: "00000000-0000-0000-0000-000000000000" },
    { ...scope, legalEntityId: "" },
    { ...scope, legalEntityId: 12 },
    { ...scope, actorId: "A".repeat(43) },
  ])("rejects invalid scope %j and retains no credential", async (invalidScope) => {
    const { adapter, fetch } = transport(() => response(2, { scope: invalidScope }));
    await expect(adapter.exchangeProcessingSession({ schemaVersion: 2 })).rejects.toMatchObject({
      code: "invalid_session",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it.each([
    { schemaVersion: 3 },
    { schemaVersion: "2" },
    { audience: "isecure-processing-production-v1" },
    { processingSession: "invalid" },
    { expiresAtEpochSeconds: 1 },
    { tokenType: "Bearer" },
  ])("keeps current session checks for schema 2: %j", async (overrides) => {
    const { adapter } = transport(() => response(2, overrides));
    await expect(adapter.exchangeProcessingSession({ schemaVersion: 2 })).rejects.toMatchObject({
      code: "invalid_session",
    });
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it("accepts additive metadata while projecting only known scope fields into the application", async () => {
    const { adapter } = transport(() =>
      response(2, {
        futureMetadata: "synthetic-ignored-value",
        scope: { ...scope, futureScopeMetadata: "synthetic-ignored-scope" },
      }),
    );
    const metadata = await adapter.exchangeProcessingSession({ schemaVersion: 2 });
    expect(metadata.scope).toEqual(scope);
    expect(metadata).not.toHaveProperty("futureMetadata");
    Object.assign(metadata.scope, { legalEntityId: scope.actorId });
    expect(adapter.processingSessionMetadata).toMatchObject({ scope });
    adapter.clearProcessingSession();
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it("discards the old account scope when the next session exchange fails", async () => {
    let succeeding = true;
    const { adapter } = transport(() => (succeeding ? response() : Response.json({ issues: [] }, { status: 401 })));
    await adapter.exchangeProcessingSession({ schemaVersion: 2 });
    succeeding = false;
    await expect(adapter.exchangeProcessingSession({ schemaVersion: 2 })).rejects.toMatchObject({ status: 401 });
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it("uses the admitted scoped session for normal operations without sending scope as request authority", async () => {
    const { adapter, fetch } = transport(() => response());
    await adapter.exchangeProcessingSession({ schemaVersion: 2 });
    await adapter.invoke("plugin_catalogue.list", {}, { contractVersion: 1 });
    const request = fetch.mock.calls[1];
    expect(request?.[0]).toEqual(new URL("https://processing.example.test/v1/plugin-catalogue"));
    const headers = new Headers(request?.[1]?.headers);
    expect(headers.get("Authorization")).toBe(`Processing ${"A".repeat(43)}`);
    expect(headers.get("x-api-key")).toBe("synthetic-key");
    expect(headers.has("ISECure-Session-Schema-Version")).toBe(false);
    expect(request?.[1]?.body).toBeUndefined();
  });

  it("does not restore account scope after sign-out while a session exchange is in flight", async () => {
    let finish: (value: Response) => void = () => {
      throw new Error("Exchange not started");
    };
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const adapter = new Iso20022HttpTransport({
      baseUrl: "https://processing.example.test/",
      bootstrapAuthentication: () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" }),
      processingAudience: audience,
      fetch,
    });
    const exchange = adapter.exchangeProcessingSession({ schemaVersion: 2 });
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    adapter.clearProcessingSession();
    finish(response());
    await expect(exchange).rejects.toMatchObject({ code: "invalid_session" });
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it("does not let an older reply overwrite a newer authenticated scope", async () => {
    const replies: ((value: Response) => void)[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise<Response>((resolve) => {
          replies.push(resolve);
        }),
    );
    const adapter = new Iso20022HttpTransport({
      baseUrl: "https://processing.example.test/",
      bootstrapAuthentication: () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" }),
      processingAudience: audience,
      fetch,
    });
    const older = adapter.exchangeProcessingSession({ schemaVersion: 2 });
    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });
    const newer = adapter.exchangeProcessingSession({ schemaVersion: 2 });
    await vi.waitFor(() => {
      expect(replies).toHaveLength(2);
    });
    const updated = { ...scope, legalEntityId: "00000000-0000-4000-8000-000000000814" };
    replies[1]?.(response(2, { scope: updated }));
    await expect(newer).resolves.toMatchObject({ scope: updated });
    replies[0]?.(response());
    await expect(older).rejects.toMatchObject({ code: "invalid_session" });
    expect(adapter.processingSessionMetadata).toMatchObject({ scope: updated });
  });

  it("does not dispatch after sign-out while bootstrap authentication is being resolved", async () => {
    const authentication = { apiKey: "synthetic-key", idToken: "synthetic-token" };
    let finish: (value: typeof authentication) => void = () => {
      throw new Error("Authentication not requested");
    };
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(response()));
    const adapter = new Iso20022HttpTransport({
      baseUrl: "https://processing.example.test/",
      bootstrapAuthentication: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      processingAudience: audience,
      fetch,
    });
    const exchange = adapter.exchangeProcessingSession({ schemaVersion: 2 });
    adapter.clearProcessingSession();
    finish(authentication);
    await expect(exchange).rejects.toMatchObject({ code: "invalid_session" });
    expect(fetch).not.toHaveBeenCalled();
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it("refuses an unsupported runtime selector before sending credentials", async () => {
    const { adapter, fetch } = transport(() => response());
    await expect(adapter.exchangeProcessingSession({ schemaVersion: 3 } as never)).rejects.toMatchObject({
      code: "invalid_configuration",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
