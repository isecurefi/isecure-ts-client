import { describe, expect, it, vi, type Mock } from "vitest";
import { createIso20022Client } from "./client.js";
import {
  Iso20022HttpError,
  Iso20022HttpTransport,
  Iso20022TransportError,
  ProcessingEntitlementDeniedError,
  type Iso20022HttpTransportOptions,
  type PaymentExportContentAuthority,
} from "./transport.js";

const API_KEY = "synthetic-api-key";
const ID_TOKEN = "synthetic-id-token";
const PROCESSING_TOKEN = "A".repeat(43);
const AUDIENCE = "isecure-processing-gpgtest-v1";
const RESOURCE_ID = "00000000-0000-4000-8000-000000000001";
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000002";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function sessionResponse(overrides: Record<string, unknown> = {}): Response {
  return jsonResponse({
    audience: AUDIENCE,
    expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
    processingSession: PROCESSING_TOKEN,
    schemaVersion: 1,
    tokenType: "Processing",
    ...overrides,
  });
}

function transport(
  operationFetch: typeof globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true })),
  options: Partial<Iso20022HttpTransportOptions> = {},
): { adapter: Iso20022HttpTransport; fetch: Mock<typeof globalThis.fetch> } {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (new URL(url).pathname.endsWith("/session")) return sessionResponse();
    return operationFetch(input, init);
  });
  return {
    adapter: new Iso20022HttpTransport({
      baseUrl: "https://api.example.test/processing/",
      bootstrapAuthentication: () => ({ apiKey: API_KEY, idToken: ID_TOKEN }),
      processingAudience: AUDIENCE,
      fetch,
      ...options,
    }),
    fetch,
  };
}

async function readyTransport(
  operationFetch?: typeof globalThis.fetch,
  options: Partial<Iso20022HttpTransportOptions> = {},
) {
  const result = transport(operationFetch, options);
  await result.adapter.exchangeProcessingSession();
  return result;
}

async function digest(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer));
  return `sha256:${Array.from(result, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

async function contentAuthority(bytes: Uint8Array): Promise<PaymentExportContentAuthority> {
  return {
    artifact_id: ARTIFACT_ID,
    artifact_digest: await digest(bytes),
    artifact_byte_length: String(bytes.byteLength),
    artifact_media_type: "application/xml",
  };
}

function xmlResponse(bytes: Uint8Array, authority: PaymentExportContentAuthority, overrides = {}): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": authority.artifact_media_type,
      "content-length": authority.artifact_byte_length,
      "ISECure-Artifact-Id": authority.artifact_id,
      "ISECure-Artifact-Sha256": authority.artifact_digest,
      ...overrides,
    },
  });
}

describe("ISO 20022 HTTP transport", () => {
  it("generates bounded verified XML through the read operation without export or approval authority", async () => {
    const bytes = new TextEncoder().encode("<Document>synthetic generated payment</Document>");
    const authority = await contentAuthority(bytes);
    const { adapter, fetch } = await readyTransport(async () =>
      xmlResponse(bytes, authority, { "cache-control": "private, no-store" }),
    );
    const input = {
      payment_order_id: RESOURCE_ID,
      order_revision_id: ARTIFACT_ID,
      payment_export_profile_id: RESOURCE_ID,
      profile_revision: "2",
    };
    const result = await createIso20022Client(adapter).paymentBatches.generateFile(input);
    expect(result).toEqual({ ...authority, bytes });
    const [url, request] = fetch.mock.calls[1] ?? [];
    expect(url).toEqual(new URL("https://api.example.test/processing/v1/payment-orders:generate-file"));
    expect(request?.method).toBe("POST");
    if (typeof request?.body !== "string") throw new Error("Expected a JSON request body");
    expect(JSON.parse(request.body)).toEqual(input);
    const headers = new Headers(request?.headers);
    expect(headers.get("ISECure-Contract-Version")).toBe("1");
    expect(headers.get("Authorization")).toBe(`Processing ${PROCESSING_TOKEN}`);
    expect(headers.has("Idempotency-Key")).toBe(false);
    expect(headers.has("If-Match")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { "ISECure-Artifact-Id": "invalid" },
    { "ISECure-Artifact-Sha256": `sha256:${"0".repeat(64)}` },
    { "content-length": "100000000" },
    { "content-length": "1" },
    { "content-type": "application/json" },
    { "cache-control": "private" },
  ])("refuses generated content with invalid integrity or cache metadata: %j", async (overrides) => {
    const bytes = new TextEncoder().encode("<Document/>");
    const authority = await contentAuthority(bytes);
    const { adapter } = await readyTransport(async () =>
      xmlResponse(bytes, authority, { "cache-control": "private, no-store", ...overrides }),
    );
    await expect(adapter.generatePaymentFile({}, { contractVersion: 1 })).rejects.toMatchObject({
      code: "integrity_check_failed",
    });
  });

  it("requires the current session and preserves approved-download authority checks", async () => {
    const first = transport();
    await expect(first.adapter.generatePaymentFile({}, { contractVersion: 1 })).rejects.toMatchObject({
      code: "invalid_session",
    });
    expect(first.fetch).not.toHaveBeenCalled();
    const { adapter, fetch } = await readyTransport();
    await expect(adapter.generatePaymentFile({}, { contractVersion: 2 })).rejects.toMatchObject({
      code: "serialization_failed",
    });
    await expect(adapter.downloadPaymentExport({}, { contractVersion: 1 }, undefined as never)).rejects.toMatchObject({
      code: "invalid_configuration",
    });
    await expect(adapter.invoke("payment_orders.generate_file", {}, { contractVersion: 1 })).rejects.toMatchObject({
      code: "unsupported_operation",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves generation entitlement denial without retrying or returning bytes", async () => {
    const { adapter, fetch } = await readyTransport(async () =>
      jsonResponse(
        {
          issues: [
            {
              issue_code: "processing_entitlement_denied",
              category: "authorization",
              severity: "error",
              safe_message: "The Processing request could not be completed safely.",
            },
          ],
        },
        { status: 403 },
      ),
    );
    await expect(adapter.generatePaymentFile({}, { contractVersion: 1 })).rejects.toBeInstanceOf(
      ProcessingEntitlementDeniedError,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["op-c2b-v9-finland-sepa-unstructured", "sepa_credit_transfer_unstructured"],
    ["op-c2b-v9-finland-sepa-creditor-reference", "sepa_credit_transfer_creditor_reference"],
    ["danske-c2b-v9-finland-sepa-unstructured", "sepa_credit_transfer_unstructured"],
    ["danske-c2b-v9-finland-sepa-creditor-reference", "sepa_credit_transfer_creditor_reference"],
  ])("discovers and configures the exact experimental bank profile %s", async (profileId, paymentType) => {
    const danske = profileId.startsWith("danske-");
    // Synthetic HTTP responses qualify SDK routing and metadata only. Platform profile tests own
    // financial behavior; this fixture is neither bank acceptance nor a production availability claim.
    const profile = {
      bank_profile_id: profileId,
      bank_id: danske ? "danske" : "op",
      bank_name: danske ? "Danske Bank Finland" : "OP",
      country_code: "FI",
      payment_type: paymentType,
      message_definition: "pain.001.001.09",
      profile_version: "1",
      qualification_status: "experimental",
      availability_status: "available",
    };
    const configuration = {
      bank_profile_id: profileId,
      debtor_account_identifier: danske ? "FI9780009900000117" : "FI3950000100000123",
      debtor_account_scheme: "iban" as const,
      debtor_account_currency: "EUR",
      initiating_party_name: "Synthetic initiating party",
      initiating_party_customer_id: danske ? "SYNDANSKE00001" : "SYNOP00001",
      debtor_name: "Synthetic debtor",
      debtor_bank_agreement_id: danske ? "SYNDANSKE00001" : "SYNOP00001",
      debtor_country_code: "FI",
      debtor_agent_bic: danske ? "DABAFIHH" : "OKOYFIHH",
    };
    const operationFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Processing ${PROCESSING_TOKEN}`);
      expect(headers.get("x-api-key")).toBe(API_KEY);
      expect(headers.get("Authorization")).not.toContain(ID_TOKEN);
      const url = input instanceof Request ? input.url : input.toString();
      if (new URL(url).pathname.endsWith("/payment-export-profile-catalog")) {
        expect(init?.method).toBe("GET");
        return jsonResponse({ profiles: [profile], catalog_digest: `sha256:${"1".repeat(64)}`, issues: [] });
      }
      expect(new URL(url).pathname).toBe("/processing/v1/payment-export-profiles:configure");
      expect(init?.method).toBe("POST");
      if (typeof init?.body !== "string") throw new Error("synthetic configuration body missing");
      expect(JSON.parse(init.body)).toEqual(configuration);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("synthetic-bank-profile-configuration");
      return jsonResponse({ issues: [] });
    });
    const { adapter } = await readyTransport(operationFetch);
    const client = createIso20022Client(adapter);
    const catalog = await client.paymentExportProfiles.list();
    const selected = catalog.profiles.find((entry) => entry.bank_profile_id === profileId);
    expect(selected).toEqual(profile);
    expect(selected?.qualification_status).toBe("experimental");
    expect(selected?.availability_status).toBe("available");
    if (selected === undefined) throw new Error("synthetic bank catalog entry missing");
    await client.paymentExportProfiles.configure(
      { ...configuration, bank_profile_id: selected.bank_profile_id },
      { idempotencyKey: "synthetic-bank-profile-configuration" },
    );
    expect(operationFetch).toHaveBeenCalledTimes(2);
  });

  it("forwards the explicit Danske submission-date option and preserves returned preparation context", async () => {
    const input = {
      capability: { account_capability_id: RESOURCE_ID, capability_revision: "1", connected_account_id: RESOURCE_ID },
      requested_execution_date: "2030-04-03",
      options: [{ option_type: "proposed_submission_date" as const, proposed_submission_date: "2030-04-02" }],
      transfers: [
        {
          money: { amount: "12.34", currency: "EUR" },
          creditor: { name: "Synthetic creditor", identifiers: [] },
          creditor_account: { account_type: "iban" as const, iban: "FI8080009900000229" },
          remittance: { remittance_type: "unstructured" as const, text_lines: ["Synthetic Danske invoice"] },
          options: [],
        },
      ],
    };
    const operationFetch = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = request instanceof Request ? request.url : request.toString();
      if (new URL(url).pathname.endsWith("payment-orders:create-draft")) {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("synthetic-danske-draft");
        if (typeof init?.body !== "string") throw new Error("synthetic draft body missing");
        expect(JSON.parse(init.body)).toEqual(input);
        return jsonResponse({ issues: [] });
      }
      expect(new URL(url).pathname).toBe(`/processing/v1/payment-exports/${RESOURCE_ID}`);
      expect(init?.method).toBe("GET");
      return jsonResponse({ payment_export: { proposed_submission_date: "2030-04-02" }, issues: [] });
    });
    const { adapter } = await readyTransport(operationFetch);
    const client = createIso20022Client(adapter);
    await client.paymentBatches.createDraft(input, { idempotencyKey: "synthetic-danske-draft" });
    const result = await client.paymentExports.get({ payment_export_id: RESOURCE_ID });
    expect(result.payment_export.proposed_submission_date).toBe("2030-04-02");
    expect(operationFetch).toHaveBeenCalledTimes(2);
  });

  it("exchanges an existing WSChannel identity for a separate Processing session", async () => {
    const { adapter, fetch } = transport();

    const metadata = await adapter.exchangeProcessingSession();

    expect(metadata).toMatchObject({ audience: AUDIENCE, schemaVersion: 1, tokenType: "Processing" });
    expect(typeof metadata.expiresAtEpochSeconds).toBe("number");
    expect(metadata).not.toHaveProperty("processingSession");
    expect(metadata).not.toHaveProperty("apiKey");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toEqual(new URL("https://api.example.test/processing/session"));
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { Accept: "application/json", Authorization: ID_TOKEN, "x-api-key": API_KEY },
    });
  });

  it("requires explicit exchange and uses only the audience-bound Processing token for operations", async () => {
    const { adapter, fetch } = transport();
    const client = createIso20022Client(adapter);

    await expect(client.validations.list({})).rejects.toMatchObject({ code: "invalid_session" });
    await adapter.exchangeProcessingSession();
    await client.validations.list({});

    const request = fetch.mock.calls[1];
    expect(request?.[1]).toMatchObject({
      headers: {
        Accept: "application/json",
        Authorization: `Processing ${PROCESSING_TOKEN}`,
        "ISECure-Contract-Version": "1",
        "x-api-key": API_KEY,
      },
    });
    expect(JSON.stringify(request)).not.toContain(ID_TOKEN);
    adapter.clearProcessingSession();
    expect(adapter.processingSessionMetadata).toBeUndefined();
    await expect(client.validations.list({})).rejects.toMatchObject({ code: "invalid_session" });
  });

  it("serializes generated path, query, JSON, idempotency, and version bindings", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const { adapter } = await readyTransport(operationFetch);
    const client = createIso20022Client(adapter);

    await client.statements.list({
      bank_account_id: RESOURCE_ID,
      observed_from: "2040-01-01T00:00:00Z",
      page_size: 25,
      cursor: "synthetic cursor",
    });
    await client.paymentOrders.reviseDraft({ payment_order_id: RESOURCE_ID, draft: { synthetic: true } } as never, {
      idempotencyKey: "synthetic-revise",
      expectedResourceVersion: '"7"',
    });

    expect(String(operationFetch.mock.calls[0]?.[0])).toBe(
      "https://api.example.test/processing/v1/statements?bank_account_id=00000000-0000-4000-8000-000000000001&observed_from=2040-01-01T00%3A00%3A00Z&page_size=25&cursor=synthetic+cursor",
    );
    expect(operationFetch.mock.calls[0]?.[1]).not.toHaveProperty("body");
    expect(operationFetch.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "synthetic-revise",
        "If-Match": '"7"',
      },
    });
  });

  it.each([
    { audience: "wrong-audience" },
    { processingSession: "not-a-token" },
    { expiresAtEpochSeconds: 1 },
    { expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 3_600 },
    { schemaVersion: 2 },
    { tokenType: "Bearer" },
    { extra: "rejected" },
  ])("fails closed on malformed or substituted Processing session fields: %o", async (override) => {
    const fetch = vi.fn(async () => sessionResponse(override));
    const adapter = new Iso20022HttpTransport({
      baseUrl: "https://api.example.test/processing/",
      bootstrapAuthentication: () => ({ apiKey: API_KEY, idToken: ID_TOKEN }),
      processingAudience: AUDIENCE,
      fetch,
    });

    await expect(adapter.exchangeProcessingSession()).rejects.toMatchObject({ code: "invalid_session" });
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it("does not expose bootstrap-provider failures or retain a previous session after exchange failure", async () => {
    const secret = "customer-secret-detail";
    const { adapter } = await readyTransport();
    Object.assign(adapter as object, {
      bootstrapAuthentication: vi.fn(async () => Promise.reject(new Error(secret))),
    });

    const error = await adapter.exchangeProcessingSession().catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      code: "request_failed",
      message: "The Processing bootstrap identity could not be resolved",
    });
    expect(String(error)).not.toContain(secret);
    expect(adapter.processingSessionMetadata).toBeUndefined();
  });

  it("surfaces generated refusal bodies without retrying or echoing them in the error message", async () => {
    const issue = { issues: [{ issue_code: "SYNTHETIC_DENIED", safe_message: "Denied" }] };
    const operationFetch = vi.fn(async () => jsonResponse(issue, { status: 403 }));
    const { adapter } = await readyTransport(operationFetch);
    const error = await createIso20022Client(adapter)
      .entries.get({ resource_id: RESOURCE_ID })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Iso20022HttpError);
    expect(error).toMatchObject({ status: 403, body: issue });
    expect((error as Error).message).not.toContain("Denied");
    expect(operationFetch).toHaveBeenCalledTimes(1);
  });

  it("exposes commercial entitlement denial as one typed Processing error", async () => {
    const issue = {
      issues: [
        {
          issue_code: "processing_entitlement_denied",
          category: "authorization",
          severity: "error",
          safe_message: "The Processing request could not be completed safely.",
        },
      ],
    };
    const operationFetch = vi.fn(async () => jsonResponse(issue, { status: 403 }));
    const { adapter } = await readyTransport(operationFetch);

    const error = await createIso20022Client(adapter)
      .paymentSubmissions.list({ page: {} })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ProcessingEntitlementDeniedError);
    expect(error).toMatchObject({ code: "processing_entitlement_denied", status: 403, body: issue });
    expect((error as Error).message).not.toContain(issue.issues[0]?.safe_message);
    expect(operationFetch).toHaveBeenCalledTimes(1);
  });

  it("refuses private-key, password, and detached-signature shaped submission input locally", async () => {
    const operationFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const { adapter } = await readyTransport(operationFetch);
    const client = createIso20022Client(adapter);
    const privateValue = "private-local-material";

    for (const forbidden of ["private_key", "keyPassword", "detached_signature"]) {
      const error = await client.paymentSubmissions
        .reportUpload(
          {
            execution_attempt_id: RESOURCE_ID,
            fulfillment_claim_id: ARTIFACT_ID,
            outcome: "submitted",
            [forbidden]: privateValue,
          } as never,
          { idempotencyKey: "synthetic-report" },
        )
        .catch((cause: unknown) => cause);

      expect(error).toMatchObject({
        code: "serialization_failed",
        message: "The operation input is not valid JSON",
      });
      expect(JSON.stringify(error)).not.toContain(privateValue);
    }
    expect(operationFetch).not.toHaveBeenCalled();
  });

  it("does not retry network failure or timeout", async () => {
    const networkFetch = vi.fn(async () => Promise.reject(new Error("network detail")));
    const network = await readyTransport(networkFetch);
    await expect(createIso20022Client(network.adapter).validations.list({})).rejects.toMatchObject({
      code: "request_failed",
      message: "The Processing API request failed",
    });
    expect(networkFetch).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const hangingFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(new Error("aborted"));
            },
            { once: true },
          );
        }),
    );
    const timed = await readyTransport(hangingFetch, { timeoutMs: 25 });
    try {
      const request = createIso20022Client(timed.adapter)
        .validations.list({})
        .catch((cause: unknown) => cause);
      await vi.advanceTimersByTimeAsync(25);
      await expect(request).resolves.toMatchObject({
        code: "request_failed",
        message: "The Processing API request timed out",
      });
      expect(hangingFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves an indeterminate submission without simplifying or retrying it", async () => {
    const response = {
      context: { operation_id: "payment_execution_attempts.get" },
      execution_attempt: {
        state: "indeterminate",
        fulfillment: { state: "indeterminate" },
        bank_outcome_state: "indeterminate",
      },
    };
    const operationFetch = vi.fn(async () => jsonResponse(response));
    const { adapter } = await readyTransport(operationFetch);

    const result = await createIso20022Client(adapter).paymentSubmissions.get({ execution_attempt_id: RESOURCE_ID });

    expect(result).toEqual(response);
    expect(result.execution_attempt.state).toBe("indeterminate");
    expect(result.execution_attempt.fulfillment.state).toBe("indeterminate");
    expect(result.execution_attempt.bank_outcome_state).toBe("indeterminate");
    expect(operationFetch).toHaveBeenCalledTimes(1);
  });

  it("downloads and returns only exact, bounded, integrity-verified XML bytes", async () => {
    const bytes = new TextEncoder().encode("<Document>synthetic</Document>");
    const authority = await contentAuthority(bytes);
    const operationFetch = vi.fn(async () => xmlResponse(bytes, authority));
    const { adapter } = await readyTransport(operationFetch);

    const result = await createIso20022Client(adapter).paymentSubmissions.download(
      { payment_export_id: RESOURCE_ID },
      authority,
      { idempotencyKey: "synthetic-download" },
    );

    expect(result).toEqual({ ...authority, bytes });
    const request = operationFetch.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/xml",
        "Content-Type": "application/json",
        "Idempotency-Key": "synthetic-download",
      },
    });
  });

  it("calls a sink exactly once and only after complete verification", async () => {
    const bytes = new TextEncoder().encode("<Document>verified</Document>");
    const authority = await contentAuthority(bytes);
    const operationFetch = vi.fn(async () => xmlResponse(bytes, authority));
    const { adapter } = await readyTransport(operationFetch);
    const sink = vi.fn(async () => undefined);

    const result = await createIso20022Client(adapter).paymentExports.downloadTo(
      { payment_export_id: RESOURCE_ID },
      authority,
      sink,
      { idempotencyKey: "synthetic-download" },
    );

    expect(result).toEqual(authority);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(bytes);
  });

  it.each([
    ["wrong artifact", { "ISECure-Artifact-Id": RESOURCE_ID }],
    ["wrong digest", { "ISECure-Artifact-Sha256": `sha256:${"0".repeat(64)}` }],
    ["wrong media", { "content-type": "text/plain" }],
    ["wrong length", { "content-length": "1" }],
  ])("rejects %s metadata before exposing bytes", async (_label, overrides) => {
    const bytes = new TextEncoder().encode("<Document/>");
    const authority = await contentAuthority(bytes);
    const operationFetch = vi.fn(async () => xmlResponse(bytes, authority, overrides));
    const { adapter } = await readyTransport(operationFetch);
    const sink = vi.fn();

    await expect(
      createIso20022Client(adapter).paymentExports.downloadTo({ payment_export_id: RESOURCE_ID }, authority, sink, {
        idempotencyKey: "synthetic-download",
      }),
    ).rejects.toMatchObject({ code: "integrity_check_failed" });
    expect(sink).not.toHaveBeenCalled();
  });

  it("rejects tampered and truncated bytes without exposing partial content", async () => {
    const bytes = new TextEncoder().encode("<Document>exact</Document>");
    const authority = await contentAuthority(bytes);
    for (const responseBytes of [
      new TextEncoder().encode("<Document>evil!</Document>"),
      bytes.slice(0, bytes.byteLength - 1),
    ]) {
      const operationFetch = vi.fn(async () => xmlResponse(responseBytes, authority));
      const { adapter } = await readyTransport(operationFetch);
      const sink = vi.fn();
      await expect(
        createIso20022Client(adapter).paymentExports.downloadTo({ payment_export_id: RESOURCE_ID }, authority, sink, {
          idempotencyKey: "synthetic-download",
        }),
      ).rejects.toMatchObject({ code: "integrity_check_failed" });
      expect(sink).not.toHaveBeenCalled();
    }
  });

  it("rejects authoritative or streamed bytes above the configured limit", async () => {
    const bytes = new Uint8Array(201).fill(65);
    const authority = await contentAuthority(bytes);
    const tooSmall = await readyTransport(
      vi.fn(async () => xmlResponse(bytes, authority)),
      { maxResponseBytes: 200 },
    );
    await expect(
      createIso20022Client(tooSmall.adapter).paymentExports.download({ payment_export_id: RESOURCE_ID }, authority, {
        idempotencyKey: "synthetic-download",
      }),
    ).rejects.toMatchObject({ code: "invalid_configuration" });

    const declared = { ...authority, artifact_byte_length: "200" };
    const streamed = await readyTransport(
      vi.fn(async () => xmlResponse(bytes, declared)),
      { maxResponseBytes: 200 },
    );
    await expect(
      createIso20022Client(streamed.adapter).paymentExports.download({ payment_export_id: RESOURCE_ID }, declared, {
        idempotencyKey: "synthetic-download",
      }),
    ).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("turns caller sink failure into a privacy-safe local error", async () => {
    const bytes = new TextEncoder().encode("<Document/>");
    const authority = await contentAuthority(bytes);
    const { adapter } = await readyTransport(vi.fn(async () => xmlResponse(bytes, authority)));

    const error = await createIso20022Client(adapter)
      .paymentExports.downloadTo(
        { payment_export_id: RESOURCE_ID },
        authority,
        async () => Promise.reject(new Error("private filesystem detail")),
        { idempotencyKey: "synthetic-download" },
      )
      .catch((cause: unknown) => cause);

    expect(error).toMatchObject({ code: "sink_failed", message: "The caller-owned payment-export sink failed" });
    expect(String(error)).not.toContain("filesystem detail");
  });

  it("streams bounded event, task, and heartbeat notifications without exposing the session", async () => {
    const firstCursor = `sse_${"1".repeat(32)}`;
    const secondCursor = `sse_${"2".repeat(32)}`;
    const operationFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Accept")).toBe("text/event-stream");
      expect(headers.get("Authorization")).toBe(`Processing ${PROCESSING_TOKEN}`);
      expect(headers.get("ISECure-Contract-Version")).toBe("1");
      expect(headers.get("x-api-key")).toBe(API_KEY);
      expect(headers.get("Last-Event-ID")).toBe(firstCursor);
      return new Response(
        `id: ${firstCursor}\nevent: event\ndata: {"event":"changed"}\n\n` +
          `id: ${secondCursor}\nevent: task\ndata: {"state":"running"}\n\n` +
          ": heartbeat\n\n",
        {
          headers: {
            "cache-control": "private, no-store, no-cache, must-revalidate",
            "content-type": "text/event-stream; charset=utf-8",
          },
        },
      );
    });
    const { adapter } = await readyTransport(operationFetch);

    const items = [];
    for await (const item of adapter.streamProcessingEvents({ lastEventId: firstCursor })) items.push(item);

    expect(items).toEqual([
      { kind: "event", id: firstCursor, data: { event: "changed" } },
      { kind: "task", id: secondCursor, data: { state: "running" } },
      { kind: "heartbeat" },
    ]);
    expect(JSON.stringify(items)).not.toContain(PROCESSING_TOKEN);
  });

  it("rejects invalid resume cursors before opening a stream", async () => {
    const { adapter, fetch } = await readyTransport();
    const callsBeforeStream = fetch.mock.calls.length;
    const stream = adapter.streamProcessingEvents({ lastEventId: "customer-selected-cursor" });

    await expect(stream.next()).rejects.toMatchObject({ code: "invalid_configuration" });
    expect(fetch).toHaveBeenCalledTimes(callsBeforeStream);
  });

  it("fails closed on malformed or oversized stream items", async () => {
    const malformed = await readyTransport(
      vi.fn(
        async () =>
          new Response("event: event\ndata: {}\n\n", {
            headers: {
              "cache-control": "private, no-store, no-cache, must-revalidate",
              "content-type": "text/event-stream; charset=utf-8",
            },
          }),
      ),
    );
    await expect(malformed.adapter.streamProcessingEvents().next()).rejects.toMatchObject({
      code: "malformed_response",
    });

    const duplicateField = await readyTransport(
      vi.fn(
        async () =>
          new Response(`id: sse_${"1".repeat(32)}\nevent: event\ndata: {}\ndata: {"substituted":true}\n\n`, {
            headers: {
              "cache-control": "private, no-store, no-cache, must-revalidate",
              "content-type": "text/event-stream; charset=utf-8",
            },
          }),
      ),
    );
    await expect(duplicateField.adapter.streamProcessingEvents().next()).rejects.toMatchObject({
      code: "malformed_response",
    });

    const oversized = await readyTransport(
      vi.fn(
        async () =>
          new Response(`id: sse_${"1".repeat(32)}\nevent: event\ndata: {"x":"${"a".repeat(65_536)}"}`, {
            headers: {
              "cache-control": "private, no-store, no-cache, must-revalidate",
              "content-type": "text/event-stream; charset=utf-8",
            },
          }),
      ),
    );
    await expect(oversized.adapter.streamProcessingEvents().next()).rejects.toMatchObject({
      code: "response_too_large",
    });
  });

  it.each([
    "http://api.example.test/processing",
    "https://user:password@api.example.test/processing",
    "https://api.example.test/processing?tenant=other",
  ])("rejects unsafe Processing base URLs: %s", (baseUrl) => {
    expect(
      () =>
        new Iso20022HttpTransport({
          baseUrl,
          bootstrapAuthentication: () => ({ apiKey: API_KEY, idToken: ID_TOKEN }),
          processingAudience: AUDIENCE,
        }),
    ).toThrow(Iso20022TransportError);
  });
});
