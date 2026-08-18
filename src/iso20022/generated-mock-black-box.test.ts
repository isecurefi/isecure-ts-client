import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { iso20022Operations, type Iso20022OperationId } from "../generated/iso20022-contracts.js";
import { createIso20022Client, type Iso20022Client } from "./client.js";
import {
  Iso20022HttpError,
  Iso20022HttpTransport,
  Iso20022TransportError,
  type PaymentExportContentAuthority,
} from "./transport.js";

const PROCESSING_TOKEN = "A".repeat(43);
const AUDIENCE = "isecure-processing-gpgtest-v1";
const CONTENT_AUTHORITY: PaymentExportContentAuthority = {
  artifact_id: "00000000-0000-4000-8000-000000000001",
  artifact_digest: `sha256:${"0".repeat(64)}`,
  artifact_byte_length: "1",
  artifact_media_type: "application/xml",
};

interface MockFixture {
  scenario: string;
  input: Record<string, unknown>;
  outcome: {
    status: number;
    body: Record<string, unknown>;
  };
}

interface MockOperation {
  operationId: Iso20022OperationId;
  fixtures: MockFixture[];
}

describe("generated ISO client mock black box", () => {
  it("executes every generated success, refusal, malformed, replay, and stale-version fixture", async () => {
    const mock = await readMock();
    const expected = mock.reduce((count, operation) => count + operation.fixtures.length, 0);
    let executed = 0;

    for (const operation of mock) {
      for (const fixture of operation.fixtures) {
        if (
          operation.operationId === "payment_exports.download_content" &&
          fixture.outcome.status >= 200 &&
          fixture.outcome.status < 300
        ) {
          expect(typeof fixture.outcome.body.artifact_id).toBe("string");
          expect(typeof fixture.outcome.body.artifact_digest).toBe("string");
          expect(typeof fixture.outcome.body.artifact_byte_length).toBe("string");
          expect(typeof fixture.outcome.body.artifact_media_type).toBe("string");
          executed += 1;
          continue;
        }
        const operationFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          expect(input).toBeDefined();
          expect(init).toBeDefined();
          return new Response(JSON.stringify(fixture.outcome.body), {
            status: fixture.outcome.status,
            headers: { "content-type": "application/json" },
          });
        });
        const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : input.toString();
          if (new URL(url).pathname.endsWith("/session")) {
            return new Response(
              JSON.stringify({
                audience: AUDIENCE,
                expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
                processingSession: PROCESSING_TOKEN,
                schemaVersion: 1,
                tokenType: "Processing",
              }),
              { headers: { "content-type": "application/json" } },
            );
          }
          return operationFetch(input, init);
        });
        const transport = new Iso20022HttpTransport({
          baseUrl: "https://api.example.test/processing/",
          bootstrapAuthentication: () => ({ apiKey: "synthetic-api-key", idToken: "synthetic-id-token" }),
          processingAudience: AUDIENCE,
          fetch,
        });
        await transport.exchangeProcessingSession();
        const client = createIso20022Client(transport);

        const outcome = await invoke(client, operation.operationId, fixture.input).catch((error: unknown) => error);

        const request = operationFetch.mock.calls[0];
        if (request === undefined) {
          expect(fixture.scenario).toBe("invalid_request");
          expect(outcome).toBeInstanceOf(Iso20022TransportError);
          expect(outcome).toMatchObject({ code: "serialization_failed" });
          executed += 1;
          continue;
        }
        if (fixture.outcome.status >= 200 && fixture.outcome.status < 300) {
          expect(outcome, `${operation.operationId}.${fixture.scenario}`).toEqual(fixture.outcome.body);
        } else {
          expect(outcome, `${operation.operationId}.${fixture.scenario}`).toBeInstanceOf(Iso20022HttpError);
          expect(outcome).toMatchObject({ status: fixture.outcome.status, body: fixture.outcome.body });
        }
        const contract = iso20022Operations[operation.operationId];
        expect(request[1]?.method).toBe(contract.method);
        expect(new Headers(request[1]?.headers).get("ISECure-Contract-Version")).toBe(String(contract.version));
        expect(new Headers(request[1]?.headers).has("Idempotency-Key")).toBe(contract.idempotency === "required");
        expect(new Headers(request[1]?.headers).has("If-Match")).toBe(contract.expectedVersion === "required");
        if (contract.requestBody) {
          const requestBody = request[1]?.body;
          if (typeof requestBody !== "string") throw new Error("generated JSON request body is missing");
          expect(JSON.parse(requestBody)).toEqual(fixture.input);
        } else {
          expect(request[1]).not.toHaveProperty("body");
        }
        executed += 1;
      }
    }

    expect(executed).toBe(expected);
    expect(executed).toBeGreaterThan(0);
  });
});

async function readMock(): Promise<MockOperation[]> {
  const path = resolve(import.meta.dirname, "../../test-data/generated/iso20022-scenarios.json");
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (value === null || typeof value !== "object" || !("operations" in value) || !Array.isArray(value.operations)) {
    throw new Error("generated observation mock is malformed");
  }
  return value.operations as MockOperation[];
}

function invoke(
  client: Iso20022Client,
  operationId: Iso20022OperationId,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (operationId) {
    case "balances.explain":
      return client.balances.explain(input as never);
    case "balances.get":
      return client.balances.get(input as never);
    case "balances.list":
      return client.balances.list(input);
    case "entries.explain":
      return client.entries.explain(input as never);
    case "entries.get":
      return client.entries.get(input as never);
    case "entries.list":
      return client.entries.list(input);
    case "payment_capabilities.explain":
      return client.paymentCapabilities.explain(input as never);
    case "payment_capabilities.get":
      return client.paymentCapabilities.get(input as never);
    case "payment_capabilities.list":
      return client.paymentCapabilities.list(input as never);
    case "payment_capabilities.resolve":
      return client.paymentCapabilities.resolve(input as never);
    case "payment_export_profile_catalog.list":
      return client.paymentExportProfiles.list(input);
    case "payment_export_profiles.configure":
      return client.paymentExportProfiles.configure(input as never, commandOptions(operationId));
    case "payment_export_profiles.get":
      return client.paymentExportProfiles.get(input);
    case "payment_export_profiles.revoke":
      return client.paymentExportProfiles.revoke(input as never, revisionOptions(operationId));
    case "payment_exports.download_content":
      return client.paymentExports.download(input as never, CONTENT_AUTHORITY, commandOptions(operationId));
    case "payment_exports.get":
      return client.paymentExports.get(input as never);
    case "payment_exports.release":
      return client.paymentExports.release(input as never, revisionOptions(operationId));
    case "payment_orders.cancel_draft":
      return client.paymentOrders.cancelDraft(input as never, revisionOptions(operationId));
    case "payment_orders.create_draft":
      return client.paymentOrders.createDraft(input as never, commandOptions(operationId));
    case "payment_orders.execute":
      return client.paymentOrders.execute(input as never, revisionOptions(operationId));
    case "payment_orders.explain":
      return client.paymentOrders.explain(input as never);
    case "payment_orders.get":
      return client.paymentOrders.get(input as never);
    case "payment_orders.list":
      return client.paymentOrders.list(input as never);
    case "payment_orders.revise_draft":
      return client.paymentOrders.reviseDraft(input as never, revisionOptions(operationId));
    case "payment_orders.simulate":
      return client.paymentOrders.simulate(input as never);
    case "payment_orders.submit_for_review":
      return client.paymentOrders.submitForReview(input as never, revisionOptions(operationId));
    case "payment_orders.validate":
      return client.paymentOrders.validate(input as never);
    case "statements.explain":
      return client.statements.explain(input as never);
    case "statements.get":
      return client.statements.get(input as never);
    case "statements.list":
      return client.statements.list(input);
    case "transactions.explain":
      return client.transactions.explain(input as never);
    case "transactions.get":
      return client.transactions.get(input as never);
    case "transactions.list":
      return client.transactions.list(input);
    case "validations.explain":
      return client.validations.explain(input as never);
    case "validations.get":
      return client.validations.get(input as never);
    case "validations.list":
      return client.validations.list(input);
  }
}

function commandOptions(operationId: Iso20022OperationId) {
  return { idempotencyKey: `synthetic-${operationId}` };
}

function revisionOptions(operationId: Iso20022OperationId) {
  return { ...commandOptions(operationId), expectedResourceVersion: '"1"' };
}
