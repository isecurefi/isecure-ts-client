import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  Iso20022HttpError,
  type Iso20022Client,
  type ConfigurePaymentExportProfileInput,
  type PaymentOrderDraftInput,
  type PaymentExportProfileResource,
} from "../../src/iso20022/index.js";
import {
  generationQuery,
  requireVerifiedPain001,
  transferExternalId,
} from "../processing-generate-file/generate-file.js";

function required<T>(value: T | undefined): T {
  assert.ok(value !== undefined);
  return value;
}

type Check = (name: string, action: () => Promise<void> | void) => Promise<void>;

/** Uses only the caller's disposable synthetic tenant; no submission, approval or bank operations. */
export async function checkConcurrentProductionBatches(
  client: Iso20022Client,
  base: { draftInput: PaymentOrderDraftInput; profile: PaymentExportProfileResource },
  check: Check,
): Promise<void> {
  const run = `multi-${randomUUID().replaceAll("-", "")}`;
  const refuses = async (action: () => Promise<unknown>, statuses: readonly number[]) =>
    assert.rejects(action, (error: unknown) => error instanceof Iso20022HttpError && statuses.includes(error.status));
  const configureInput: ConfigurePaymentExportProfileInput = {
    bank_profile_id: "op-c2b-v9-finland-sepa-unstructured",
    debtor_account_identifier: "FI4516273000000856",
    initiating_party_name: "Synthetic Initiating Party Oy",
    debtor_name: "Synthetic Debtor Oy",
    debtor_bank_agreement_id: "00012345678",
  };
  const profiles = [base.profile];
  await check("op-minimal-inputs-and-independent-configurations", async () => {
    // Creation is parallel and identical except for independent logical-request keys.
    const results = await Promise.all(
      [0, 1].map((i) =>
        client.paymentExportProfiles.configure(configureInput, { idempotencyKey: `${run}-profile-${i}` }),
      ),
    );
    for (const result of results) {
      const p = result.payment_export_profile;
      assert.equal(p.initiating_party_customer_id, undefined);
      assert.equal(p.debtor_agent_bic, "OKOYFIHH");
      assert.equal(p.debtor_account_scheme, "iban");
      assert.equal(p.debtor_account_currency, "EUR");
      assert.equal(p.debtor_bank_agreement_id, "00012345678");
      profiles.push(p);
    }
    assert.equal(new Set(profiles.map((p) => p.payment_export_profile_id)).size, 3);
    const replay = await client.paymentExportProfiles.configure(configureInput, { idempotencyKey: `${run}-profile-0` });
    assert.equal(replay.payment_export_profile.payment_export_profile_id, profiles[1]?.payment_export_profile_id);
  });
  await check("profile-default-contradiction-refused", () =>
    refuses(
      () =>
        client.paymentExportProfiles.configure(
          { ...configureInput, debtor_agent_bic: "NDEAFIHH" },
          { idempotencyKey: `${run}-wrong-bic` },
        ),
      [400, 422],
    ),
  );
  await check("saved-configurations-keyset-pagination", async () => {
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await client.paymentExportProfiles.list({
        page_size: 1,
        ...(cursor ? { after_profile_id: cursor } : {}),
      });
      for (const profile of result.payment_export_profiles) {
        assert.ok(!seen.has(profile.payment_export_profile_id));
        seen.add(profile.payment_export_profile_id);
      }
      cursor = result.next_after_profile_id;
      if (!cursor) break;
    }
    assert.equal(cursor, undefined);
    for (const p of profiles) assert.ok(seen.has(p.payment_export_profile_id));
  });
  const template = base.draftInput.transfers[0];
  assert.ok(template);
  const inputs = profiles.flatMap((p, i) =>
    [0, 1].map((j) => {
      const marker = `synthetic-batch-${i}-${j}`;
      return {
        profile: p,
        marker,
        input: {
          ...base.draftInput,
          capability: p.capability,
          external_id: `${run}-${i}-${j}`,
          transfers: [
            {
              ...template,
              external_id: transferExternalId(`${run}-${i}-${j}`),
              remittance: { remittance_type: "unstructured" as const, text_lines: [marker] },
            },
          ],
        },
      };
    }),
  );
  const batches: {
    item: (typeof inputs)[number];
    mutation: Awaited<ReturnType<Iso20022Client["paymentBatches"]["createDraft"]>>;
  }[] = [];
  await check("six-concurrent-drafts-three-configurations-two-banks", async () => {
    const results = await Promise.all(
      inputs.map(async (item, i) => ({
        item,
        mutation: await client.paymentBatches.createDraft(item.input, { idempotencyKey: `${run}-draft-${i}` }),
      })),
    );
    batches.push(...results);
    assert.equal(new Set(results.map((x) => x.mutation.payment_order_reference.resource_id)).size, 6);
  });
  const first = batches[0];
  const peer = batches[1];
  assert.ok(first && peer);
  const orderId = first.mutation.payment_order_reference.resource_id;
  const opts = (name: string) => ({
    idempotencyKey: `${run}-${name}`,
    expectedResourceVersion: JSON.stringify(first.mutation.resource_version),
  });
  await check("draft-edits-and-cross-batch-transfer-refusal", async () => {
    const beforePeer = await client.paymentBatches.get({
      payment_order_id: peer.mutation.payment_order_reference.resource_id,
    });
    const foreignId = peer.mutation.payment_transfer_ids[0];
    assert.ok(foreignId);
    await refuses(
      () =>
        client.paymentBatches.removePayments(
          { payment_order_id: orderId, payment_transfer_ids: [foreignId] },
          opts("foreign-remove"),
        ),
      [400, 403, 404, 422],
    );
    await refuses(
      () =>
        client.paymentBatches.updatePayment(
          { payment_order_id: orderId, payment_transfer_id: foreignId, transfer: template },
          opts("foreign-edit"),
        ),
      [400, 403, 404, 422],
    );
    const originalVersion = first.mutation.resource_version;
    const extra = { ...template, external_id: transferExternalId(`${run}-extra`) };
    first.mutation = await client.paymentBatches.addPayments(
      { payment_order_id: orderId, transfers: [extra] },
      opts("append"),
    );
    await refuses(
      () =>
        client.paymentBatches.addPayments(
          { payment_order_id: orderId, transfers: [extra] },
          { idempotencyKey: `${run}-stale`, expectedResourceVersion: JSON.stringify(originalVersion) },
        ),
      [412],
    );
    const ownId = first.mutation.payment_transfer_ids[0];
    assert.ok(ownId);
    first.mutation = await client.paymentBatches.updatePayment(
      {
        payment_order_id: orderId,
        payment_transfer_id: ownId,
        transfer: { ...required(first.item.input.transfers[0]), money: { amount: "23.45", currency: "EUR" } },
      },
      opts("edit"),
    );
    const state = await client.paymentBatches.get({ payment_order_id: orderId });
    const addedId = state.payment_order.revision.transfers.find(
      (t) => t.transfer.external_id === extra.external_id,
    )?.payment_transfer_id;
    assert.ok(addedId);
    first.mutation = await client.paymentBatches.removePayments(
      { payment_order_id: orderId, payment_transfer_ids: [addedId] },
      opts("remove"),
    );
    const after = await client.paymentBatches.get({ payment_order_id: orderId });
    assert.equal(after.payment_order.revision.transfers.length, 1);
    assert.equal(after.payment_order.revision.transfers[0]?.transfer.money.amount, "23.45");
    const afterPeer = await client.paymentBatches.get({
      payment_order_id: peer.mutation.payment_order_reference.resource_id,
    });
    assert.deepEqual(afterPeer.payment_order.revision, beforePeer.payment_order.revision);
  });
  await check("draft-cannot-change-bound-bank", () =>
    refuses(
      () =>
        client.paymentBatches.replaceDraft(
          { payment_order_id: orderId, draft: { ...first.item.input, capability: required(profiles[1]).capability } },
          opts("switch-bank"),
        ),
      [400, 409, 422],
    ),
  );
  const queries: ReturnType<typeof generationQuery>[] = [];
  await check("finalize-six-independent-batches", async () => {
    // Bound concurrency stays below the production cell's eight runtime slots.
    for (const batch of batches) {
      const id = batch.mutation.payment_order_reference.resource_id;
      const valid = await client.paymentBatches.validate({
        payment_order_id: id,
        revision_id: batch.mutation.revision_id,
      });
      assert.equal(valid.validation.outcome, "valid");
      const finalized = await client.paymentBatches.finalize(
        { payment_order_id: id },
        {
          idempotencyKey: `${run}-final-${queries.length}`,
          expectedResourceVersion: JSON.stringify(batch.mutation.resource_version),
        },
      );
      queries.push(generationQuery(id, finalized, batch.item.profile));
      batch.mutation = finalized.mutation;
    }
  });
  await check("finalized-payment-edit-refused", () =>
    refuses(
      () =>
        client.paymentBatches.addPayments({ payment_order_id: orderId, transfers: [template] }, opts("after-finalize")),
      [409],
    ),
  );
  await check("concurrent-generation-exact-xml-and-repeat", async () => {
    const generated = await Promise.all(queries.map((query) => client.paymentBatches.generateFile(query)));
    const identifiers = new Set<string>();
    for (const [i, content] of generated.entries()) {
      requireVerifiedPain001(content);
      const xml = new TextDecoder().decode(content.bytes);
      const batch = batches[i];
      assert.ok(batch);
      assert.ok(xml.includes(batch.item.marker));
      assert.ok(xml.includes(batch.item.profile.debtor_account_identifier));
      assert.ok(xml.includes(batch.item.profile.debtor_bank_agreement_id));
      if (batch.item.profile.bank_profile_id.startsWith("op-")) {
        const initiatingParty = /<InitgPty>([\s\S]*?)<\/InitgPty>/u.exec(xml)?.[1];
        assert.ok(initiatingParty);
        assert.ok(!initiatingParty.includes("<Id>"));
      }
      for (const other of batches) if (other !== batch) assert.ok(!xml.includes(other.item.marker));
      const messageId = /<MsgId>([^<]+)<\/MsgId>/u.exec(xml)?.[1];
      assert.ok(messageId);
      assert.ok(!identifiers.has(messageId));
      identifiers.add(messageId);
      const repeated = await client.paymentBatches.generateFile(required(queries[i]));
      assert.deepEqual(repeated.bytes, content.bytes);
    }
  });
  await check("generation-refuses-profile-substitution", () =>
    refuses(
      () =>
        client.paymentBatches.generateFile({
          ...required(queries[0]),
          payment_export_profile_id: required(profiles[1]).payment_export_profile_id,
          profile_revision: required(profiles[1]).profile_revision,
        }),
      [412],
    ),
  );
  await check("configuration-revision-conflict-and-peer-isolation", async () => {
    const selected = required(profiles[1]);
    const update = {
      ...configureInput,
      payment_export_profile_id: selected.payment_export_profile_id,
      expected_resource_version: selected.resource_version,
      debtor_name: "Synthetic Updated Debtor Oy",
    };
    const changed = await client.paymentExportProfiles.configure(update, { idempotencyKey: `${run}-profile-update` });
    assert.notEqual(changed.payment_export_profile.profile_revision, selected.profile_revision);
    await refuses(
      () => client.paymentExportProfiles.configure(update, { idempotencyKey: `${run}-profile-conflict` }),
      [412],
    );
    await refuses(() => client.paymentBatches.generateFile(required(queries[2])), [412]);
    requireVerifiedPain001(await client.paymentBatches.generateFile(required(queries[4])));
    const unchanged = await client.paymentExportProfiles.get({
      payment_export_profile_id: required(profiles[2]).payment_export_profile_id,
    });
    assert.equal(unchanged.payment_export_profile.profile_revision, required(profiles[2]).profile_revision);
  });
}
