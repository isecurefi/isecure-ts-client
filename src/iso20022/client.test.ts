import { describe, expect, it } from "vitest";
import { iso20022Operations, type Iso20022OperationId } from "../generated/iso20022-contracts.js";
import { createIso20022Client } from "./client.js";
import type {
  Iso20022Transport,
  PaymentExportContentAuthority,
  PaymentExportContentSink,
  VerifiedPaymentExportContent,
  VerifiedPaymentExportContentMetadata,
} from "./transport.js";

class RecordingTransport implements Iso20022Transport {
  readonly calls: { operationId: string; input: unknown; metadata: unknown }[] = [];

  invoke<Input, Result>(operationId: Iso20022OperationId, input: Input, metadata: unknown): Promise<Result> {
    this.calls.push({ operationId, input, metadata });
    return Promise.resolve({ operationId } as Result);
  }

  downloadPaymentExport(
    input: unknown,
    metadata: unknown,
    authority: PaymentExportContentAuthority,
  ): Promise<VerifiedPaymentExportContent> {
    this.calls.push({ operationId: "payment_exports.download_content", input, metadata });
    return Promise.resolve({ ...authority, bytes: new Uint8Array() });
  }

  downloadPaymentExportTo(
    input: unknown,
    metadata: unknown,
    authority: PaymentExportContentAuthority,
    sink: PaymentExportContentSink,
  ): Promise<VerifiedPaymentExportContentMetadata> {
    void sink;
    this.calls.push({ operationId: "payment_exports.download_content", input, metadata });
    return Promise.resolve(authority);
  }
}

describe("experimental ISO 20022 client", () => {
  it("projects every selected generated operation with its exact request metadata", async () => {
    const transport = new RecordingTransport();
    const client = createIso20022Client(transport);
    const resource = { resource_id: "00000000-0000-4000-8000-000000000001" };
    const paymentExportId = "00000000-0000-4000-8000-000000000002";
    const profileId = "00000000-0000-4000-8000-000000000003";
    const contentAuthority = {
      artifact_id: "00000000-0000-4000-8000-000000000004",
      artifact_digest: `sha256:${"0".repeat(64)}`,
      artifact_byte_length: "1",
      artifact_media_type: "application/xml",
    } as const;

    await Promise.all([
      client.balances.explain(resource),
      client.balances.get(resource),
      client.balances.list({ currency: "EUR" }),
      client.entries.explain(resource),
      client.entries.get(resource),
      client.entries.list({ status_code: "BOOK" }),
      client.paymentCapabilities.explain({ account_capability_id: resource.resource_id }),
      client.paymentCapabilities.get({ account_capability_id: resource.resource_id }),
      client.paymentCapabilities.list({ page: {} }),
      client.paymentCapabilities.resolve({
        connected_account_id: resource.resource_id,
        business_type: "credit_transfer",
        required_option_kinds: [],
      }),
      client.paymentExportProfiles.list(),
      client.paymentExportProfiles.configure({} as never, { idempotencyKey: "synthetic-profile" }),
      client.paymentExportProfiles.get(),
      client.paymentExportProfiles.revoke(
        { payment_export_profile_id: profileId, profile_revision: "1" },
        { idempotencyKey: "synthetic-revoke", expectedResourceVersion: '"1"' },
      ),
      client.paymentExports.download({ payment_export_id: paymentExportId }, contentAuthority, {
        idempotencyKey: "synthetic-download",
      }),
      client.paymentExports.get({ payment_export_id: paymentExportId }),
      client.paymentExports.release(
        { payment_export_id: paymentExportId, exact_approval_subject_digest: `sha256:${"1".repeat(64)}` },
        { idempotencyKey: "synthetic-release", expectedResourceVersion: '"1"' },
      ),
      client.paymentOrders.cancelDraft(
        { payment_order_id: resource.resource_id },
        { idempotencyKey: "synthetic-cancel", expectedResourceVersion: '"1"' },
      ),
      client.paymentOrders.createDraft({} as never, { idempotencyKey: "synthetic-create" }),
      client.paymentOrders.execute(
        { payment_order_id: resource.resource_id },
        { idempotencyKey: "synthetic-execute", expectedResourceVersion: '"1"' },
      ),
      client.paymentOrders.explain({ payment_order_id: resource.resource_id }),
      client.paymentOrders.get({ payment_order_id: resource.resource_id }),
      client.paymentOrders.list({ page: {} }),
      client.paymentOrders.reviseDraft({} as never, {
        idempotencyKey: "synthetic-revise",
        expectedResourceVersion: '"1"',
      }),
      client.paymentOrders.simulate({ payment_order_id: resource.resource_id, revision_id: resource.resource_id }),
      client.paymentOrders.submitForReview(
        { payment_order_id: resource.resource_id },
        { idempotencyKey: "synthetic-submit", expectedResourceVersion: '"1"' },
      ),
      client.paymentOrders.validate({ payment_order_id: resource.resource_id, revision_id: resource.resource_id }),
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

    expect(transport.calls).toHaveLength(36);
    expect(transport.calls.map((call) => call.operationId)).toEqual(Object.keys(iso20022Operations));
    for (const call of transport.calls) {
      const operation = iso20022Operations[call.operationId as keyof typeof iso20022Operations];
      expect(call.metadata).toMatchObject({ contractVersion: operation.version });
      expect("idempotencyKey" in (call.metadata as object)).toBe(operation.idempotency === "required");
      expect("expectedResourceVersion" in (call.metadata as object)).toBe(operation.expectedVersion === "required");
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

  it("passes replay keys through without adding local deduplication or retry", async () => {
    const transport = new RecordingTransport();
    const client = createIso20022Client(transport);
    const input = {} as never;
    const options = { idempotencyKey: "synthetic-replay" };

    await client.paymentOrders.createDraft(input, options);
    await client.paymentOrders.createDraft(input, options);

    expect(transport.calls).toEqual([
      { operationId: "payment_orders.create_draft", input, metadata: { contractVersion: 1, ...options } },
      { operationId: "payment_orders.create_draft", input, metadata: { contractVersion: 1, ...options } },
    ]);
  });
});
