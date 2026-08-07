import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  iso20022ObservationOperations,
  type Iso20022ObservationOperationId,
} from "../generated/iso20022-observations.js";
import { createIso20022Client, type Iso20022Client } from "./client.js";
import { Iso20022HttpError, Iso20022HttpTransport } from "./transport.js";

interface MockFixture {
  scenario: string;
  input: Record<string, unknown>;
  outcome: {
    status: number;
    body: Record<string, unknown>;
  };
}

interface MockOperation {
  operationId: Iso20022ObservationOperationId;
  fixtures: MockFixture[];
}

describe("generated observation mock black box", () => {
  it("executes every generated success, page, refusal, and recovery fixture through the public client", async () => {
    const mock = await readMock();
    const expected = mock.reduce(
      (count, operation) =>
        count + operation.fixtures.filter((fixture) => fixture.scenario !== "invalid_request").length,
      0,
    );
    let executed = 0;

    for (const operation of mock) {
      for (const fixture of operation.fixtures) {
        // A malformed path identifier cannot be serialized into an HTTP request;
        // local serialization refusal is covered separately.
        if (fixture.scenario === "invalid_request") continue;
        const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          expect(input).toBeDefined();
          expect(init).toBeDefined();
          return new Response(JSON.stringify(fixture.outcome.body), {
            status: fixture.outcome.status,
            headers: { "content-type": "application/json" },
          });
        });
        const client = createIso20022Client(
          new Iso20022HttpTransport({
            baseUrl: "https://api.example.test/processing/",
            accessToken: "synthetic-token",
            fetch,
          }),
        );

        const outcome = await invoke(client, operation.operationId, fixture.input).catch((error: unknown) => error);

        if (fixture.outcome.status >= 200 && fixture.outcome.status < 300) {
          expect(outcome, `${operation.operationId}.${fixture.scenario}`).toEqual(fixture.outcome.body);
        } else {
          expect(outcome, `${operation.operationId}.${fixture.scenario}`).toBeInstanceOf(Iso20022HttpError);
          expect(outcome).toMatchObject({ status: fixture.outcome.status, body: fixture.outcome.body });
        }
        const request = fetch.mock.calls[0];
        if (request === undefined) throw new Error("public client did not call its transport");
        expect(request[1]?.method).toBe(iso20022ObservationOperations[operation.operationId].method);
        expect(new Headers(request[1]?.headers).get("ISECure-Contract-Version")).toBe(
          String(iso20022ObservationOperations[operation.operationId].version),
        );
        executed += 1;
      }
    }

    expect(executed).toBe(expected);
    expect(executed).toBeGreaterThan(0);
  });
});

async function readMock(): Promise<MockOperation[]> {
  const path = resolve(import.meta.dirname, "../../test-data/generated/iso20022-observation-scenarios.json");
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (value === null || typeof value !== "object" || !("operations" in value) || !Array.isArray(value.operations)) {
    throw new Error("generated observation mock is malformed");
  }
  return value.operations as MockOperation[];
}

function invoke(
  client: Iso20022Client,
  operationId: Iso20022ObservationOperationId,
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
