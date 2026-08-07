import { describe, expect, it } from "vitest";
import { iso20022ObservationOperations } from "../generated/iso20022-observations.js";
import { createIso20022Client } from "./client.js";
import type { Iso20022Transport } from "./transport.js";

class RecordingTransport implements Iso20022Transport {
  readonly calls: { operationId: string; input: unknown; metadata: unknown }[] = [];

  invoke<Input, Result>(operationId: never, input: Input, metadata: unknown): Promise<Result> {
    this.calls.push({ operationId, input, metadata });
    return Promise.resolve({ operationId } as Result);
  }
}

describe("experimental ISO 20022 observation client", () => {
  it("projects every generated observation operation with its exact contract version", async () => {
    const transport = new RecordingTransport();
    const client = createIso20022Client(transport);
    const resource = { resource_id: "00000000-0000-4000-8000-000000000001" };

    await Promise.all([
      client.balances.explain(resource),
      client.balances.get(resource),
      client.balances.list({ currency: "EUR" }),
      client.entries.explain(resource),
      client.entries.get(resource),
      client.entries.list({ status_code: "BOOK" }),
      client.statements.explain(resource),
      client.statements.get(resource),
      client.statements.list({ page_size: 25 }),
      client.transactions.explain(resource),
      client.transactions.get(resource),
      client.transactions.list({ end_to_end_id: "synthetic-e2e" }),
      client.validations.explain(resource),
      client.validations.get(resource),
      client.validations.list({ run_kind: "validate" }),
    ]);

    expect(transport.calls).toHaveLength(15);
    expect(transport.calls.map((call) => call.operationId)).toEqual(Object.keys(iso20022ObservationOperations));
    for (const call of transport.calls) {
      const operation = iso20022ObservationOperations[call.operationId as keyof typeof iso20022ObservationOperations];
      expect(call.metadata).toEqual({ contractVersion: operation.version });
    }
  });

  it("does not add idempotency or replay behavior to repeated read calls", async () => {
    const transport = new RecordingTransport();
    const client = createIso20022Client(transport);
    const input = { resource_id: "00000000-0000-4000-8000-000000000001" };

    await client.statements.get(input);
    await client.statements.get(input);

    expect(transport.calls).toEqual([
      { operationId: "statements.get", input, metadata: { contractVersion: 1 } },
      { operationId: "statements.get", input, metadata: { contractVersion: 1 } },
    ]);
  });
});
