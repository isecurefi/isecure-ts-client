import { describe, expect, it, vi } from "vitest";
import { createIso20022Client } from "./client.js";
import {
  Iso20022HttpError,
  Iso20022HttpTransport,
  Iso20022TransportError,
  type Iso20022HttpTransportOptions,
} from "./transport.js";

const RESOURCE_ID = "00000000-0000-4000-8000-000000000001";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function transport(options: Partial<Iso20022HttpTransportOptions> = {}): Iso20022HttpTransport {
  return new Iso20022HttpTransport({
    baseUrl: "https://api.example.test/processing",
    accessToken: "synthetic-token",
    fetch: vi.fn(async () => jsonResponse({ ok: true })),
    ...options,
  });
}

describe("ISO 20022 HTTP transport", () => {
  it("serializes generated path/query/version/auth bindings and returns a JSON result", async () => {
    const fetch = vi.fn(async () => jsonResponse({ statements: [], page: { has_more: false } }));
    const accessToken = vi.fn(async () => "rotated-synthetic-token");
    const client = createIso20022Client(transport({ fetch, accessToken }));

    const result = await client.statements.list({
      bank_account_id: RESOURCE_ID,
      observed_from: "2040-01-01T00:00:00Z",
      page_size: 25,
      cursor: "synthetic cursor",
    });

    expect(result).toEqual({ statements: [], page: { has_more: false } });
    expect(accessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://api.example.test/processing/v1/statements?bank_account_id=00000000-0000-4000-8000-000000000001&observed_from=2040-01-01T00%3A00%3A00Z&page_size=25&cursor=synthetic+cursor",
    );
    expect(init).toMatchObject({
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer rotated-synthetic-token",
        "ISECure-Contract-Version": "1",
      },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init).not.toHaveProperty("body");
  });

  it("serializes generated JSON, idempotency, and expected-version bindings", async () => {
    const fetch = vi.fn(async () => jsonResponse({ accepted: true }));
    const client = createIso20022Client(transport({ fetch }));
    const input = { payment_order_id: RESOURCE_ID, draft: { synthetic: true } } as never;

    await client.paymentOrders.reviseDraft(input, {
      idempotencyKey: "synthetic-revise-key",
      expectedResourceVersion: '"7"',
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example.test/processing/v1/payment-orders:revise-draft");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer synthetic-token",
        "Content-Type": "application/json",
        "Idempotency-Key": "synthetic-revise-key",
        "If-Match": '"7"',
        "ISECure-Contract-Version": "1",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it("serializes generated OpenAPI deep-object query parameters", async () => {
    const fetch = vi.fn(async () => jsonResponse({ capabilities: [], page: {} }));
    const client = createIso20022Client(transport({ fetch }));

    await client.paymentCapabilities.list({ page: { page_size: 25, cursor: "synthetic cursor" } });

    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://api.example.test/processing/v1/payment-capabilities?page%5Bpage_size%5D=25&page%5Bcursor%5D=synthetic+cursor",
    );
  });

  it("uses the runtime fetch implementation and preserves an already normalized base path", async () => {
    const runtimeFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
    const adapter = new Iso20022HttpTransport({
      baseUrl: new URL("https://api.example.test/processing/"),
      accessToken: "synthetic-token",
    });

    await adapter.invoke("balances.list", {}, { contractVersion: 2 });

    const request = runtimeFetch.mock.calls[0]?.[0];
    expect(request instanceof Request ? request.url : request?.toString()).toBe(
      "https://api.example.test/processing/v1/balances",
    );
    runtimeFetch.mockRestore();
  });

  it.each(["http://localhost:8080/api", "http://127.0.0.1:8080/api", "http://[::1]:8080/api"])(
    "permits plaintext HTTP only for loopback development at %s",
    async (baseUrl) => {
      const fetch = vi.fn(async () => jsonResponse({ ok: true }));
      const adapter = transport({ baseUrl, fetch });

      await adapter.invoke("balances.list", {}, { contractVersion: 2 });

      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("encodes generated path parameters without changing the base path", async () => {
    const fetch = vi.fn(async () => jsonResponse({ statement: {} }));
    const client = createIso20022Client(transport({ fetch }));

    await client.statements.get({ resource_id: "synthetic/id" });

    expect(String(fetch.mock.calls[0]?.[0])).toBe("https://api.example.test/processing/v1/statements/synthetic%2Fid");
  });

  it("surfaces generated refusal bodies without retrying or echoing them in the message", async () => {
    const issue = { issues: [{ issue_code: "SYNTHETIC_DENIED", safe_message: "Denied" }] };
    const fetch = vi.fn(async () => jsonResponse(issue, { status: 403 }));
    const client = createIso20022Client(transport({ fetch }));

    const error = await client.entries.get({ resource_id: RESOURCE_ID }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Iso20022HttpError);
    expect(error).toMatchObject({ status: 403, body: issue });
    expect((error as Error).message).not.toContain("Denied");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("performs concurrent reads independently with no shared request state", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      jsonResponse({ url: input instanceof Request ? input.url : input.toString() }),
    );
    const client = createIso20022Client(transport({ fetch }));

    const results = await Promise.all(
      Array.from({ length: 32 }, async (_, index) =>
        client.transactions.list({ end_to_end_id: `synthetic-${String(index)}` }),
      ),
    );

    expect(fetch).toHaveBeenCalledTimes(32);
    expect(new Set(results.map((result) => (result as unknown as { url: string }).url)).size).toBe(32);
  });

  it("performs concurrent payment commands without sharing idempotency metadata", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBeDefined();
      expect(init).toBeDefined();
      return jsonResponse({ accepted: true });
    });
    const client = createIso20022Client(transport({ fetch }));

    await Promise.all(
      Array.from({ length: 16 }, async (_, index) =>
        client.paymentOrders.createDraft({ synthetic_index: index } as never, {
          idempotencyKey: `synthetic-${String(index)}`,
        }),
      ),
    );

    expect(fetch).toHaveBeenCalledTimes(16);
    expect(new Set(fetch.mock.calls.map((call) => new Headers(call[1]?.headers).get("Idempotency-Key"))).size).toBe(16);
  });

  it("does not retry a network failure", async () => {
    const failure = new Error("synthetic network failure");
    const fetch = vi.fn(async () => Promise.reject(failure));
    const client = createIso20022Client(transport({ fetch }));

    const error = await client.validations.list({}).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      name: "Iso20022TransportError",
      code: "request_failed",
      message: "The Processing API request failed",
    });
    expect(error).not.toHaveProperty("cause");
    expect((error as Error).message).not.toContain(failure.message);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not expose access-token provider failures", async () => {
    const client = createIso20022Client(
      transport({
        accessToken: vi.fn(async () => Promise.reject(new Error("synthetic credential detail"))),
      }),
    );

    const error = await client.validations.list({}).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      name: "Iso20022TransportError",
      code: "request_failed",
      message: "The bearer credential could not be resolved",
    });
    expect(error).not.toHaveProperty("cause");
    expect((error as Error).message).not.toContain("credential detail");
  });

  it("aborts a request at the configured timeout without retrying", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBeDefined();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const reason: unknown = init.signal?.reason;
            reject(reason instanceof Error ? reason : new Error("request aborted"));
          },
          { once: true },
        );
      });
    });
    const client = createIso20022Client(transport({ fetch, timeoutMs: 25 }));

    try {
      const request = client.validations.list({}).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(25);

      await expect(request).resolves.toMatchObject({
        name: "Iso20022TransportError",
        code: "request_failed",
        message: "The Processing API request timed out",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the timeout active while consuming the response body", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            "abort",
            () => {
              const reason: unknown = init.signal?.reason;
              controller.error(reason instanceof Error ? reason : new Error("request aborted"));
            },
            { once: true },
          );
        },
      });
      return new Response(body, { headers: { "content-type": "application/json" } });
    });
    const client = createIso20022Client(transport({ fetch, timeoutMs: 25 }));

    try {
      const request = client.validations.list({}).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(25);

      await expect(request).resolves.toMatchObject({
        name: "Iso20022TransportError",
        code: "request_failed",
        message: "The Processing API request timed out",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["wrong media type", new Response("{}", { headers: { "content-type": "text/plain" } })],
    ["invalid JSON", new Response("{", { headers: { "content-type": "application/json" } })],
    ["non-object JSON", new Response("[]", { headers: { "content-type": "application/json" } })],
    [
      "invalid UTF-8",
      new Response(new Uint8Array([0xff]), { headers: { "content-type": "application/problem+json" } }),
    ],
    ["empty body", new Response(null, { headers: { "content-type": "application/json" } })],
  ])("rejects a malformed %s response", async (_label, response) => {
    const client = createIso20022Client(transport({ fetch: vi.fn(async () => response) }));

    const error = await client.balances.list({}).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      name: "Iso20022TransportError",
      code: "malformed_response",
    });
    expect(error).not.toHaveProperty("cause");
    expect((error as Error).message).not.toContain("{");
  });

  it("accepts registered +json response media types", async () => {
    const response = new Response('{"ok":true}', { headers: { "content-type": "application/problem+json" } });
    const client = createIso20022Client(transport({ fetch: vi.fn(async () => response) }));

    await expect(client.balances.list({})).resolves.toEqual({ ok: true });
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    const response = new Response("{}", {
      headers: { "content-type": "application/json", "content-length": "100" },
    });
    const client = createIso20022Client(transport({ fetch: vi.fn(async () => response), maxResponseBytes: 2 }));

    await expect(client.balances.list({})).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("cancels a streaming response as soon as its actual bytes exceed the limit", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"a":'));
        controller.enqueue(new TextEncoder().encode('"too large"}'));
      },
      cancel,
    });
    const response = new Response(body, {
      headers: { "content-type": "application/json", "content-length": "unknown" },
    });
    const client = createIso20022Client(transport({ fetch: vi.fn(async () => response), maxResponseBytes: 8 }));

    await expect(client.balances.list({})).rejects.toMatchObject({ code: "response_too_large" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("combines bounded streaming chunks deterministically", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":'));
        controller.enqueue(new TextEncoder().encode("true}"));
        controller.close();
      },
    });
    const response = new Response(body, { headers: { "content-type": "application/json" } });
    const client = createIso20022Client(transport({ fetch: vi.fn(async () => response), maxResponseBytes: 32 }));

    await expect(client.balances.list({})).resolves.toEqual({ ok: true });
  });

  it.each([
    ["invalid URL", { baseUrl: "not a URL" }],
    ["non-HTTP URL", { baseUrl: "file:///tmp/api" }],
    ["remote plaintext URL", { baseUrl: "http://api.example.test/" }],
    ["URL credentials", { baseUrl: "https://user@example.test/api" }],
    ["URL query", { baseUrl: "https://example.test/api?tenant=x" }],
    ["zero response limit", { maxResponseBytes: 0 }],
    ["fractional response limit", { maxResponseBytes: 1.5 }],
    ["excessive response limit", { maxResponseBytes: 16 * 1024 * 1024 + 1 }],
    ["zero request limit", { maxRequestBytes: 0 }],
    ["fractional request limit", { maxRequestBytes: 1.5 }],
    ["excessive request limit", { maxRequestBytes: 16 * 1024 * 1024 + 1 }],
    ["invalid fetch", { fetch: 1 as never }],
    ["zero timeout", { timeoutMs: 0 }],
    ["fractional timeout", { timeoutMs: 1.5 }],
    ["excessive timeout", { timeoutMs: 5 * 60_000 + 1 }],
  ])("rejects %s configuration", (_label, overrides) => {
    expect(() => transport(overrides)).toThrow(Iso20022TransportError);
  });

  it.each(["", " leading", "trailing ", "line\nbreak", "x".repeat(16 * 1024 + 1)])(
    "rejects an invalid bearer credential without making a request",
    async (accessToken) => {
      const fetch = vi.fn(async () => jsonResponse({}));
      const client = createIso20022Client(transport({ accessToken, fetch }));

      await expect(client.balances.list({})).rejects.toMatchObject({ code: "invalid_configuration" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects runtime inputs that cannot be serialized by the generated REST binding", async () => {
    const adapter = transport();

    await expect(adapter.invoke("balances.list", null as never, { contractVersion: 2 })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    await expect(adapter.invoke("balances.get", {} as never, { contractVersion: 1 })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    await expect(
      adapter.invoke("balances.get", { resource_id: 4 } as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("balances.list", { page_size: {} } as never, { contractVersion: 2 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("balances.list", { page_size: Number.NaN } as never, { contractVersion: 2 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(adapter.invoke("balances.list", {}, { contractVersion: 1 })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    await expect(adapter.invoke("payments.execute" as never, {}, { contractVersion: 1 })).rejects.toMatchObject({
      code: "unsupported_operation",
    });
    await expect(
      adapter.invoke("payment_capabilities.list", {} as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("payment_capabilities.list", { page: { unknown: true } } as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("payment_capabilities.list", { page: [] } as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
  });

  it("enforces generated idempotency and expected-version header contracts", async () => {
    const adapter = transport();
    const revisionInput = { payment_order_id: RESOURCE_ID };

    await expect(adapter.invoke("payment_orders.create_draft", {}, { contractVersion: 1 })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    for (const idempotencyKey of [" leading", "space key", "line\nfeed", "trailing\n", "ümlaut", "x".repeat(257)]) {
      await expect(
        adapter.invoke("payment_orders.create_draft", {}, { contractVersion: 1, idempotencyKey }),
      ).rejects.toMatchObject({ code: "serialization_failed" });
    }
    await expect(
      adapter.invoke("payment_orders.create_draft", {}, { contractVersion: 1, idempotencyKey: "x".repeat(256) }),
    ).resolves.toEqual({ ok: true });
    await expect(
      adapter.invoke("payment_orders.execute", revisionInput, {
        contractVersion: 1,
        idempotencyKey: "synthetic",
      }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("payment_orders.execute", revisionInput, {
        contractVersion: 1,
        idempotencyKey: "synthetic",
        expectedResourceVersion: "1",
      }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("balances.list", {}, { contractVersion: 2, idempotencyKey: "unexpected" }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("balances.list", {}, { contractVersion: 2, expectedResourceVersion: '"1"' }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
  });

  it("rejects non-JSON and oversized request bodies before fetching", async () => {
    const fetch = vi.fn(async () => jsonResponse({}));
    const adapter = transport({ fetch, maxRequestBytes: 32 });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    await expect(
      adapter.invoke("payment_capabilities.resolve", { value: 1n } as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("payment_capabilities.resolve", { value: Number.NaN } as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("payment_capabilities.resolve", cyclic as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("payment_capabilities.resolve", { toJSON: () => "not-an-object" } as never, {
        contractVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    await expect(
      adapter.invoke("payment_capabilities.resolve", { value: "x".repeat(64) } as never, { contractVersion: 1 }),
    ).rejects.toMatchObject({ code: "request_too_large" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("serializes every supported query scalar without applying business validation", async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }));
    const adapter = transport({ fetch });

    await adapter.invoke(
      "balances.list",
      { currency: true, page_size: 0, unknown_customer_field: "ignored" } as never,
      { contractVersion: 2 },
    );

    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://api.example.test/processing/v1/balances?currency=true&page_size=0",
    );
  });

  it("rejects an oversized generated request URL before fetching", async () => {
    const fetch = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createIso20022Client(transport({ fetch }));

    await expect(client.balances.list({ cursor: "x".repeat(17 * 1024) })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
