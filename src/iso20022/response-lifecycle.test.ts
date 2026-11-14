import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { successFixture } from "../../test-data/processing-fixtures.js";
import { createIso20022Client } from "./client.js";
import { Iso20022HttpError, Iso20022HttpTransport, type Iso20022HttpTransportOptions } from "./transport.js";

const id = "00000000-0000-4000-8000-000000000001";
const bytes = new TextEncoder().encode("<Document>synthetic</Document>");
const authority = {
  artifact_id: id,
  artifact_digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  artifact_byte_length: String(bytes.byteLength),
  artifact_media_type: "application/xml",
};
const query = { payment_order_id: id, order_revision_id: id, payment_export_profile_id: id, profile_revision: "1" };

function session() {
  return Response.json({
    audience: "isecure-processing-production-v1",
    expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
    processingSession: "A".repeat(43),
    schemaVersion: 1,
    tokenType: "Processing",
  });
}
function xml() {
  return new Response(bytes, {
    headers: {
      "content-type": "application/xml",
      "content-length": String(bytes.byteLength),
      "cache-control": "private, no-store",
      "ISECure-Artifact-Id": id,
      "ISECure-Artifact-Sha256": authority.artifact_digest,
    },
  });
}
function events() {
  return new Response(`id: sse_${"1".repeat(32)}\nevent: event\ndata: {}\n\n`.repeat(2), {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "private, no-store, no-cache" },
  });
}
async function connected(operation: typeof fetch, options: Partial<Iso20022HttpTransportOptions> = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>((input, init) => {
    return new URL(input instanceof Request ? input.url : input.toString()).pathname === "/session"
      ? Promise.resolve(session())
      : operation(input, init);
  });
  const transport = new Iso20022HttpTransport({
    baseUrl: "https://processing-api.isecure.fi",
    bootstrapAuthentication: () => ({ apiKey: "synthetic", idToken: "synthetic" }),
    fetch,
    ...options,
  });
  await transport.exchangeProcessingSession();
  return { transport, client: createIso20022Client(transport), fetch };
}

describe("Processing response contracts", () => {
  it("accepts an empty catalogue and preserves exact valid data", async () => {
    const body = { ...successFixture("payment_export_profile_catalog.list").body, profiles: [] };
    const { client } = await connected(async () => Response.json(body));
    await expect(client.paymentExportProfileCatalog.list()).resolves.toEqual(body);
  });

  it.each(["numeric string", "invalid enum", "array bound", "UUID", "nested missing field"])(
    "rejects the %s boundary without coercion",
    async (kind) => {
      const body = successFixture("payment_export_profile_catalog.list").body;
      const profiles = body.profiles as Record<string, unknown>[];
      const profile = profiles[0];
      if (!profile) throw new Error("Missing fixture profile");
      const context = body.context as Record<string, unknown>;
      if (kind === "numeric string") profile.profile_version = "1";
      else if (kind === "invalid enum") profile.availability_status = "invented-status";
      else if (kind === "array bound") body.profiles = Array.from({ length: 201 }, () => profile);
      else if (kind === "UUID") context.request_id = "not-a-uuid";
      else delete profile.bank_profile_id;
      const { client } = await connected(async () => Response.json(body));
      await expect(client.paymentExportProfileCatalog.list()).rejects.toMatchObject({ code: "malformed_response" });
    },
  );
  it.each([
    ["missing fields", {}],
    ["wrong list type", { ...successFixture("payment_export_profile_catalog.list").body, profiles: "wrong" }],
    ["invalid nested entry", { ...successFixture("payment_export_profile_catalog.list").body, profiles: [{}] }],
    [
      "unknown field in a closed result",
      { ...successFixture("payment_export_profile_catalog.list").body, extra: true },
    ],
    [
      "invalid timestamp",
      {
        ...successFixture("payment_export_profile_catalog.list").body,
        context: {
          ...(successFixture("payment_export_profile_catalog.list").body.context as object),
          accepted_at: "not-a-date",
        },
      },
    ],
  ])("rejects %s without exposing the body", async (_name, body) => {
    const { client } = await connected(async () => Response.json(body));
    await expect(client.paymentExportProfileCatalog.list()).rejects.toMatchObject({ code: "malformed_response" });
  });

  it("rejects an unexpected success status even with a valid result", async () => {
    const { client } = await connected(async () =>
      Response.json(successFixture("payment_export_profile_catalog.list").body, { status: 202 }),
    );
    await expect(client.paymentExportProfileCatalog.list()).rejects.toMatchObject({ code: "malformed_response" });
  });
});

describe("Processing session lifecycle", () => {
  it("rejects a late mutation result without retrying or claiming server rollback", async () => {
    let finish!: (response: Response) => void;
    let accepted = false;
    const { transport, client, fetch } = await connected(() => {
      accepted = true;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const pending = client.paymentBatches.cancelDraft(
      { payment_order_id: id },
      {
        idempotencyKey: "cancel-once",
        expectedResourceVersion: '"1"',
      },
    );
    transport.clearProcessingSession();
    finish(Response.json(successFixture("payment_orders.cancel_draft").body));
    await expect(pending).rejects.toMatchObject({ code: "invalid_session" });
    expect(accepted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2); // One exchange and one command.
  });

  it("rejects JSON if the session is cleared while its response body is still arriving", async () => {
    let finish!: () => void;
    let bodyStarted!: () => void;
    const reading = new Promise<void>((resolve) => {
      bodyStarted = resolve;
    });
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        bodyStarted();
        return new Promise<void>((resolve) => {
          finish = () => {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(successFixture("payment_export_profile_catalog.list").body)),
            );
            controller.close();
            resolve();
          };
        });
      },
    });
    const { transport, client } = await connected(
      async () => new Response(body, { headers: { "content-type": "application/json" } }),
    );
    const pending = client.paymentExportProfileCatalog.list();
    await reading;
    transport.clearProcessingSession();
    finish();
    await expect(pending).rejects.toMatchObject({ code: "invalid_session" });
  });
  it.each(["json", "generate", "download", "sink", "stream"] as const)(
    "aborts pending %s work and rejects late results even if fetch ignores abort",
    async (mode) => {
      let finish!: (response: Response) => void;
      let signal: AbortSignal | null | undefined;
      const { transport, client } = await connected((_url, init) => {
        signal = init?.signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      const sink = vi.fn(async () => undefined);
      const pending =
        mode === "json"
          ? client.paymentExportProfileCatalog.list()
          : mode === "generate"
            ? client.paymentBatches.generateFile(query)
            : mode === "download"
              ? client.paymentExports.download({ payment_export_id: id }, authority, { idempotencyKey: "download" })
              : mode === "sink"
                ? client.paymentExports.downloadTo({ payment_export_id: id }, authority, sink, {
                    idempotencyKey: "download",
                  })
                : transport.streamProcessingEvents().next();
      transport.clearProcessingSession();
      expect(signal?.aborted).toBe(true);
      finish(
        mode === "json"
          ? Response.json(successFixture("payment_export_profile_catalog.list").body)
          : mode === "stream"
            ? events()
            : xml(),
      );
      await expect(pending).rejects.toMatchObject({ code: "invalid_session" });
      expect(sink).not.toHaveBeenCalled();
    },
  );

  it("rejects old-account JSON after a new session replaces it", async () => {
    let finish!: (response: Response) => void;
    const { transport, client } = await connected(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = client.paymentExportProfileCatalog.list();
    await transport.exchangeProcessingSession();
    finish(Response.json(successFixture("payment_export_profile_catalog.list").body));
    await expect(pending).rejects.toMatchObject({ code: "invalid_session" });
    expect(transport.processingSessionMetadata).toBeDefined();
  });

  it("does not yield buffered stream events after sign-out", async () => {
    const { transport } = await connected(async () => events());
    const stream = transport.streamProcessingEvents();
    expect((await stream.next()).done).toBe(false);
    transport.clearProcessingSession();
    await expect(stream.next()).rejects.toMatchObject({ code: "invalid_session" });
  });

  it("rejects a response that arrives after session expiry", async () => {
    vi.useFakeTimers();
    try {
      let finish!: (response: Response) => void;
      const { client } = await connected(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const pending = client.paymentExportProfileCatalog.list();
      vi.setSystemTime(Date.now() + 601_000);
      finish(Response.json(successFixture("payment_export_profile_catalog.list").body));
      await expect(pending).rejects.toMatchObject({ code: "invalid_session" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Processing HTTP failures", () => {
  it.each([401, 403, 409, 413, 429, 500, 502, 503])(
    "retains HTTP %s without parsing an invalid error body",
    async (status) => {
      const { client } = await connected(async () => new Response("<html>private details</html>", { status }));
      await expect(client.paymentExportProfileCatalog.list()).rejects.toMatchObject({ status, body: undefined });
    },
  );

  it("preserves a canonical HTTP-date retry hint", async () => {
    const retryAfter = "Sun, 06 Nov 2039 08:49:37 GMT";
    const canonical = new Date(retryAfter).toUTCString();
    const { client } = await connected(
      async () => new Response("", { status: 429, headers: { "retry-after": canonical } }),
    );
    await expect(client.paymentExportProfileCatalog.list()).rejects.toMatchObject({
      status: 429,
      retryAfter: canonical,
    });
  });
  it.each(["session", "json", "binary", "stream"] as const)(
    "preserves non-JSON HTTP failure diagnostics on %s",
    async (mode) => {
      const failure = () =>
        new Response("secret upstream error", {
          status: 503,
          headers: {
            "content-type": "text/plain",
            "retry-after": "30",
            "x-amzn-requestid": "synthetic-request-id",
          },
        });
      const { transport, client, fetch } = await connected(async () => failure());
      if (mode === "session") fetch.mockImplementationOnce(async () => failure());
      const pending =
        mode === "session"
          ? transport.exchangeProcessingSession()
          : mode === "json"
            ? client.paymentExportProfileCatalog.list()
            : mode === "binary"
              ? client.paymentBatches.generateFile(query)
              : transport.streamProcessingEvents().next();
      const error = await pending.catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(Iso20022HttpError);
      expect(error).toMatchObject({
        status: 503,
        retryAfter: "30",
        requestId: "synthetic-request-id",
        bodyError: "malformed_response",
        body: undefined,
      });
      expect(JSON.stringify(error)).not.toContain("secret upstream error");
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    [
      "broken JSON",
      () => new Response("{", { status: 502, headers: { "content-type": "application/json" } }),
      "malformed_response",
    ],
    [
      "oversized body",
      () =>
        new Response("x".repeat(2048), {
          status: 502,
          headers: { "content-type": "application/json", "content-length": "2048" },
        }),
      "response_too_large",
    ],
    [
      "broken stream",
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("secret"));
            },
          }),
          { status: 502, headers: { "content-type": "application/json" } },
        ),
      "request_failed",
    ],
  ] as const)("retains status for %s", async (_name, failure, bodyError) => {
    const { client } = await connected(async () => failure(), { maxResponseBytes: 1024 });
    await expect(client.paymentExportProfileCatalog.list()).rejects.toMatchObject({
      status: 502,
      bodyError,
      body: undefined,
    });
  });

  it("discards invalid diagnostic headers", async () => {
    const { client } = await connected(
      async () =>
        new Response("", {
          status: 429,
          headers: {
            "retry-after": "Invalid Date",
            "x-request-id": "secret with spaces",
          },
        }),
    );
    await expect(client.paymentExportProfileCatalog.list()).rejects.toMatchObject({
      status: 429,
      retryAfter: undefined,
      requestId: undefined,
    });
  });
});
