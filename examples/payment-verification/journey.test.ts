import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import {
  createIso20022Client,
  Iso20022HttpTransport,
  type PayeeVerificationCapabilityResult,
  type PayeeVerificationItemsResult,
  type PayeeVerificationObservationsResult,
  type PayeeVerificationResult,
  type PayeeVerificationReviewResult,
  type PayeeVerificationStartResult,
  type PayeeVerificationUsabilityEvaluation,
} from "../../src/iso20022/index.js";
import { prepareVerification, generateReviewedFile, readReviewSnapshot, recordHumanReview } from "./journey.js";

// These tests qualify client orchestration against a deterministic HTTP double, not the server.
const fixtures = JSON.parse(
  readFileSync(new URL("../../test-data/generated/iso20022-scenarios.json", import.meta.url), "utf8"),
) as {
  operations: { operationId: string; fixtures: { scenario: string; outcome: { body: unknown } }[] }[];
};
function fixture<T>(operation: string): T {
  const value = fixtures.operations
    .find((op) => op.operationId === operation)
    ?.fixtures.find((f) => f.scenario === "success");
  if (value === undefined) throw new Error("Missing generated fixture");
  return structuredClone(value.outcome.body) as T;
}
function data() {
  const template = fixture<PayeeVerificationResult>("payee_verifications.get");
  const current = {
    ...template,
    payee_verification: {
      ...template.payee_verification,
      target: template.usability.target,
      policy_binding: template.usability.policy_binding,
      task: { ...template.payee_verification.task, state: "succeeded" as const },
      coverage: {
        expected_items: 1,
        terminal_items: 1,
        pending_items: 0,
        failed_items: 0,
        indeterminate_items: 0,
        cancelled_items: 0,
      },
    },
  };
  const target = current.usability.target;
  const review = {
    ...fixture<PayeeVerificationReviewResult>("payee_verifications.review").review,
    payee_verification_id: current.payee_verification.payee_verification_id,
    usability: current.usability,
  };
  const items = fixture<PayeeVerificationItemsResult>("payee_verifications.items");
  const item = items.items[0];
  if (item === undefined || target.target.target_kind !== "payment_order_revision") throw new Error("Invalid fixture");
  const observations = fixture<PayeeVerificationObservationsResult>("payee_verifications.observations");
  return {
    current,
    target,
    review,
    items: {
      ...items,
      projection_revision: current.usability.projection_revision,
      items: [
        {
          ...item,
          state: "terminal" as const,
          match_outcome: "no_match" as const,
          target: {
            target_kind: "payment_order_revision" as const,
            payment_order_id: target.target.payment_order_id,
            revision_id: target.target.revision_id,
            payment_transfer_id: item.item_id,
            transfer_ordinal: 1,
          },
        },
      ],
    },
    observations: { ...observations, observation_set_reference: current.usability.observation_set_reference },
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function xml() {
  const bytes = new TextEncoder().encode("<Document>synthetic</Document>");
  return new Response(bytes, {
    headers: {
      "content-type": "application/xml",
      "cache-control": "private, no-store",
      "content-length": String(bytes.length),
      "ISECure-Artifact-Id": "00000000-0000-4000-8000-000000000001",
      "ISECure-Artifact-Sha256": `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    },
  });
}
async function harness(...responses: (Response | Error)[]) {
  const requests: { url: URL; init: RequestInit }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.endsWith("/session"))
      return json({
        audience: "synthetic",
        expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
        processingSession: "A".repeat(43),
        schemaVersion: 1,
        tokenType: "Processing",
      });
    requests.push({ url, init: init ?? {} });
    const response = responses.shift();
    if (response === undefined) throw new Error("Unexpected HTTP call");
    if (response instanceof Error) throw response;
    return response;
  });
  const transport = new Iso20022HttpTransport({
    baseUrl: "https://example.test/v1/",
    processingAudience: "synthetic",
    bootstrapAuthentication: () => ({ apiKey: "synthetic", idToken: "synthetic" }),
    fetch,
  });
  await transport.exchangeProcessingSession();
  return { client: createIso20022Client(transport), requests };
}

it("discovers without disclosure, then uses one exact persisted request and explicit human review", async () => {
  const d = data();
  const capability: PayeeVerificationCapabilityResult = {
    ...fixture<PayeeVerificationCapabilityResult>("payee_verifications.capability"),
    capability: {
      capability_id: d.current.payee_verification.capability_id,
      capability_revision: "1",
      legal_entity_id: d.current.payee_verification.legal_entity_id,
      bank_connection_id: d.target.payment_export_profile_id,
      connection_agreement_id: d.target.payment_export_profile_id,
      bank_service_id: "synthetic",
      bank_service_version: "1",
      payment_profile_id: "synthetic",
      payment_profile_version: "1",
      purpose: "payment_preparation",
      request_message_definition: "pain.001.001.09",
      response_message_definition: "pain.002.001.10",
      limits: {
        maximum_input_bytes: "10000",
        maximum_items: 10,
        maximum_concurrent_attempts: 1,
        minimum_poll_interval_seconds: 30,
        work_timeout_seconds: 300,
        maximum_attempts: 1,
        fan_out_permitted: false,
      },
      opt_out_permitted: false,
      policy_binding: d.current.usability.policy_binding,
    },
  };
  const start: PayeeVerificationStartResult = {
    context: d.current.context,
    payee_verification: d.current.payee_verification,
    task: d.current.payee_verification.task,
  };
  const { client, requests } = await harness(
    json(capability),
    json(start),
    json(d.current),
    json(d.items),
    json(d.observations),
    json({ context: d.current.context, review: d.review }),
    json(d.current),
    xml(),
    json(d.current),
  );
  const prepared = await prepareVerification(
    client,
    {
      legal_entity_id: d.current.payee_verification.legal_entity_id,
      bank_connection_id: d.target.payment_export_profile_id,
      target: d.target,
    },
    "7",
    "synthetic-request",
  );
  expect(requests).toHaveLength(1);
  if (prepared.kind !== "ready") throw new Error("Expected ready");
  expect(prepared.input).not.toHaveProperty("disclosure_authorization_reference");
  await client.payeeVerifications.request(prepared.input, prepared.options);
  const snapshot = await readReviewSnapshot(client, d.review.payee_verification_id, d.target);
  expect(snapshot.items[0]?.match_outcome).toBe("no_match");
  expect(snapshot.current.usability.usability).toBe("usable");
  const result = await recordHumanReview(
    client,
    snapshot,
    { decision: "reviewed", reason_code: "human_checked" },
    "synthetic-review",
  );
  const generated = await generateReviewedFile(client, result.review);
  expect(generated.kind).toBe("generated");
  expect(new Headers(requests[1]?.init.headers).get("If-Match")).toBe('"7"');
  expect(new Headers(requests[5]?.init.headers).get("Idempotency-Key")).toBe("synthetic-review");
  const generationBody = requests[7]?.init.body;
  if (typeof generationBody !== "string" || d.target.target.target_kind !== "payment_order_revision")
    throw new Error("Missing generation request");
  expect(JSON.parse(generationBody)).toEqual({
    payment_order_id: d.target.target.payment_order_id,
    order_revision_id: d.target.target.revision_id,
    payment_export_profile_id: d.target.payment_export_profile_id,
    profile_revision: d.target.profile_revision,
  });
  const query = requests[2]?.url.searchParams;
  expect(query?.get("target[target][revision_id]")).toBe(d.target.target.revision_id);
  expect(query?.get("target[target][exact_revision_digest]")).toBe(d.target.target.exact_revision_digest);
  expect(query?.get("target[submission_date]")).toBe(d.target.submission_date);
  expect(requests).toHaveLength(9);
});

it("encodes an imported target on get and explain without treating it as a generated order", async () => {
  const d = data();
  const target = {
    ...d.target,
    target: { target_kind: "imported_payment_artifact" as const, input_admission_id: d.review.payee_verification_id },
  };
  const { client, requests } = await harness(json(d.current), json({}));
  await client.payeeVerifications.get({ payee_verification_id: d.review.payee_verification_id, target });
  await client.payeeVerifications.explain({ payee_verification_id: d.review.payee_verification_id, target });
  expect(requests.map(({ url }) => url.searchParams.get("target[target][input_admission_id]"))).toEqual([
    target.target.input_admission_id,
    target.target.input_admission_id,
  ]);
  await expect(
    generateReviewedFile(client, { ...d.review, usability: { ...d.review.usability, target } }),
  ).rejects.toThrow("reviewed_order_required");
  expect(requests).toHaveLength(2);
});

it.each([null, [], { undeclared_field: "secret" }, { input_admission_id: { unexpected: "nested" } }])(
  "refuses unsupported nested query shapes before HTTP",
  async (nested) => {
    const d = data();
    const { client, requests } = await harness();
    await expect(
      client.payeeVerifications.get({
        payee_verification_id: d.review.payee_verification_id,
        target: { ...d.target, target: nested as never },
      }),
    ).rejects.toMatchObject({ code: "serialization_failed" });
    expect(requests).toHaveLength(0);
  },
);

it.each(["unavailable", "not_applicable", "unresolved"] as const)(
  "does not request an %s capability",
  async (availability) => {
    const d = data();
    const { client, requests } = await harness(
      json({ ...fixture<PayeeVerificationCapabilityResult>("payee_verifications.capability"), availability }),
    );
    expect(
      (
        await prepareVerification(
          client,
          {
            legal_entity_id: d.current.payee_verification.legal_entity_id,
            bank_connection_id: d.target.payment_export_profile_id,
            target: d.target,
          },
          "1",
          "key",
        )
      ).kind,
    ).toBe("unavailable");
    expect(requests).toHaveLength(1);
  },
);

it.each(["unusable", "indeterminate"] as const)(
  "does not generate for %s evidence even when the task succeeded",
  async (usability) => {
    const d = data();
    const { client, requests } = await harness(
      json({ ...d.current, usability: { ...d.current.usability, usability } }),
    );
    expect((await generateReviewedFile(client, d.review)).kind).toBe("review_required");
    expect(requests).toHaveLength(1);
  },
);

it.each(["target", "profile", "date", "observations", "projection", "policy"])(
  "withholds generated bytes when %s changes during download",
  async (change) => {
    const d = data();
    let usability: PayeeVerificationUsabilityEvaluation = d.current.usability;
    switch (change) {
      case "target":
        usability = {
          ...usability,
          target: {
            ...d.target,
            target: {
              target_kind: "payment_order_revision",
              payment_order_id: "changed",
              revision_id: "changed",
              exact_revision_digest: "changed",
            },
          },
        };
        break;
      case "profile":
        usability = { ...usability, target: { ...d.target, profile_revision: "2" } };
        break;
      case "date":
        usability = { ...usability, target: { ...d.target, submission_date: "2040-01-03" } };
        break;
      case "observations":
        usability = {
          ...usability,
          observation_set_reference: { ...usability.observation_set_reference, resource_id: "changed" },
        };
        break;
      case "projection":
        usability = { ...usability, projection_revision: "2" };
        break;
      case "policy":
        usability = { ...usability, policy_binding: { ...usability.policy_binding, policy_revision_id: "changed" } };
        break;
    }
    const { client, requests } = await harness(json(d.current), xml(), json({ ...d.current, usability }));
    const result = await generateReviewedFile(client, d.review);
    expect(result.kind).toBe("review_required");
    expect(result).not.toHaveProperty("content");
    expect(requests).toHaveLength(3);
  },
);

it("propagates revocation during generation without returning bytes or retrying", async () => {
  const d = data();
  const { client, requests } = await harness(json(d.current), xml(), json({ code: "processing_access_denied" }, 403));
  await expect(generateReviewedFile(client, d.review)).rejects.toMatchObject({ status: 403 });
  expect(requests).toHaveLength(3);
});

it("does not retry an uncertain human-review response", async () => {
  const d = data();
  const { client, requests } = await harness(new Error("connection lost"));
  await expect(
    recordHumanReview(
      client,
      { current: d.current, items: d.items.items, observations: d.observations.observations },
      { decision: "reviewed", reason_code: "human_checked" },
      "retained-key",
    ),
  ).rejects.toBeDefined();
  expect(requests).toHaveLength(1);
});

it("rejects repeated pagination cursors instead of showing a truncated review", async () => {
  const d = data();
  const page = { ...d.items, page: { ...d.items.page, next_cursor: "same" } };
  const { client, requests } = await harness(json(d.current), json(page), json(page));
  await expect(readReviewSnapshot(client, d.review.payee_verification_id, d.target)).rejects.toThrow(
    "verification_cursor_repeated",
  );
  expect(requests).toHaveLength(3);
});

it("refuses an incomplete item view", async () => {
  const d = data();
  const { client } = await harness(json(d.current), json({ ...d.items, items: [] }));
  await expect(readReviewSnapshot(client, d.review.payee_verification_id, d.target)).rejects.toThrow(
    "verification_item_coverage_incomplete",
  );
});
