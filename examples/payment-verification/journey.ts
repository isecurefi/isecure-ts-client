import type {
  Iso20022Client,
  PageRequest,
  PageResult,
  PayeeVerificationCapabilityInput,
  PayeeVerificationItem,
  PayeeVerificationObservation,
  PayeeVerificationResult,
  PayeeVerificationReview,
  PayeeVerificationTargetContext,
  PayeeVerificationUsabilityEvaluation,
  ReviewPayeeVerificationInput,
} from "../../src/iso20022/index.js";

/** Application workflow example; the SDK and server still expose generation independently. */
export async function prepareVerification(
  client: Iso20022Client,
  input: PayeeVerificationCapabilityInput,
  expectedResourceVersion: string,
  idempotencyKey: string,
) {
  const discovery = await client.payeeVerifications.capability(input);
  if (discovery.availability !== "available" || discovery.capability === undefined) {
    return { kind: "unavailable", discovery } as const;
  }
  // Persist this exact command before explicitly calling request. Discovery itself has no effect.
  return {
    kind: "ready",
    discovery,
    input: {
      target: input.target,
      expected_resource_version: expectedResourceVersion,
      capability_id: discovery.capability.capability_id,
      capability_revision: discovery.capability.capability_revision,
      purpose: discovery.capability.purpose,
    },
    options: { idempotencyKey, expectedResourceVersion: JSON.stringify(expectedResourceVersion) },
  } as const;
}

export interface ReviewSnapshot {
  readonly current: PayeeVerificationResult;
  readonly items: readonly PayeeVerificationItem[];
  readonly observations: readonly PayeeVerificationObservation[];
}

/** Read once; a UI may refresh according to task.poll_after_seconds. Reads do not poll a bank. */
export async function readReviewSnapshot(
  client: Iso20022Client,
  payeeVerificationId: string,
  target: PayeeVerificationTargetContext,
): Promise<ReviewSnapshot> {
  const current = await client.payeeVerifications.get({ payee_verification_id: payeeVerificationId, target });
  if (!sameTarget(current.usability.target, target)) throw new Error("verification_target_changed");
  const items = await pages(async (page) => {
    const result = await client.payeeVerifications.items({
      payee_verification_id: payeeVerificationId,
      projection_revision: current.usability.projection_revision,
      page,
    });
    if (result.projection_revision !== current.usability.projection_revision) {
      throw new Error("verification_projection_changed");
    }
    return { values: result.items, page: result.page };
  });
  if (
    items.length !== current.payee_verification.coverage.expected_items ||
    new Set(items.map((item) => item.item_id)).size !== items.length
  ) {
    throw new Error("verification_item_coverage_incomplete");
  }
  const observations = await pages(async (page) => {
    const result = await client.payeeVerifications.observations({
      payee_verification_id: payeeVerificationId,
      observation_set_id: current.usability.observation_set_reference.resource_id,
      page,
    });
    if (result.observation_set_reference.resource_id !== current.usability.observation_set_reference.resource_id) {
      throw new Error("verification_observations_changed");
    }
    return { values: result.observations, page: result.page };
  });
  return { current, items, observations };
}

/** Call only after the human has chosen, using that human's authenticated client. */
export function recordHumanReview(
  humanClient: Iso20022Client,
  snapshot: ReviewSnapshot,
  choice: Pick<ReviewPayeeVerificationInput, "decision" | "reason_code">,
  idempotencyKey: string,
) {
  const { payee_verification: verification, usability } = snapshot.current;
  return humanClient.payeeVerifications.review(
    {
      payee_verification_id: verification.payee_verification_id,
      expected_resource_version: verification.resource_version,
      target: usability.target,
      observation_set_id: usability.observation_set_reference.resource_id,
      policy_binding: usability.policy_binding,
      ...choice,
    },
    { idempotencyKey, expectedResourceVersion: JSON.stringify(verification.resource_version) },
  );
}

/** Returns usable *evidence*, never an all-payees-matched, payment-approved or submitted claim. */
export async function generateReviewedFile(client: Iso20022Client, review: PayeeVerificationReview) {
  const target = review.usability.target;
  if (review.decision !== "reviewed" || target.target.target_kind !== "payment_order_revision") {
    throw new Error("reviewed_order_required");
  }
  const query = { payee_verification_id: review.payee_verification_id, target };
  const before = await client.payeeVerifications.get(query);
  if (!sameUsableEvidence(review.usability, before.usability)) {
    return { kind: "review_required", current: before } as const;
  }
  // The immutable order revision owns creditor details and any proposed-submission-date option.
  // The server evaluates its relationship to the explicit verification submission_date above.
  const content = await client.paymentBatches.generateFile({
    payment_order_id: target.target.payment_order_id,
    order_revision_id: target.target.revision_id,
    payment_export_profile_id: target.payment_export_profile_id,
    profile_revision: target.profile_revision,
  });
  // Evidence or authority can change while the download is in flight. Do not hand bytes to the UI
  // if a fresh read refuses access or reports a changed observation set, policy or target.
  const after = await client.payeeVerifications.get(query);
  if (!sameUsableEvidence(review.usability, after.usability)) {
    return { kind: "review_required", current: after } as const;
  }
  return { kind: "generated", content, review, evaluation: after.usability } as const;
}

function sameTarget(a: PayeeVerificationTargetContext, b: PayeeVerificationTargetContext): boolean {
  if (
    a.payment_export_profile_id !== b.payment_export_profile_id ||
    a.profile_revision !== b.profile_revision ||
    a.submission_date !== b.submission_date
  )
    return false;
  if (a.target.target_kind === "payment_order_revision" && b.target.target_kind === "payment_order_revision") {
    return (
      a.target.payment_order_id === b.target.payment_order_id &&
      a.target.revision_id === b.target.revision_id &&
      a.target.exact_revision_digest === b.target.exact_revision_digest
    );
  }
  return (
    a.target.target_kind === "imported_payment_artifact" &&
    b.target.target_kind === "imported_payment_artifact" &&
    a.target.input_admission_id === b.target.input_admission_id
  );
}

function sameUsableEvidence(a: PayeeVerificationUsabilityEvaluation, b: PayeeVerificationUsabilityEvaluation): boolean {
  return (
    a.usability === "usable" &&
    b.usability === "usable" &&
    sameTarget(a.target, b.target) &&
    a.projection_revision === b.projection_revision &&
    a.observation_set_reference.resource_id === b.observation_set_reference.resource_id &&
    a.policy_binding.policy_id === b.policy_binding.policy_id &&
    a.policy_binding.policy_version === b.policy_binding.policy_version &&
    a.policy_binding.policy_revision_id === b.policy_binding.policy_revision_id
  );
}

/** Bound the complete view as well as each HTTP response; never present truncated pages as complete. */
async function pages<T>(
  read: (page: PageRequest) => Promise<{ values: readonly T[]; page: PageResult }>,
): Promise<T[]> {
  const values: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let snapshot: string | undefined;
  for (let count = 0; count < 100; count += 1) {
    const result = await read({ page_size: 100, ...(cursor === undefined ? {} : { cursor }) });
    if (result.values.length > 100 || (snapshot !== undefined && snapshot !== result.page.snapshot_reference)) {
      throw new Error("verification_page_mismatch");
    }
    snapshot = result.page.snapshot_reference;
    values.push(...result.values);
    cursor = result.page.next_cursor;
    if (cursor === undefined) return values;
    if (cursors.has(cursor)) throw new Error("verification_cursor_repeated");
    cursors.add(cursor);
  }
  throw new Error("verification_view_limit_exceeded");
}
