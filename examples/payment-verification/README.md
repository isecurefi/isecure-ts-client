# Verification, human review and payment-file generation

This candidate example uses the public SDK against an already configured Processing API. It is
not a payment uploader. Local HTTP-double tests cover client behavior; acceptance against the
actual API, generated database permissions and bank integrations remains pending in the platform's
PAYMENTEXPORT-002 task. Presence of these methods does not establish deployed availability.

Use separately authenticated clients where the requester, human reviewer and file reader differ.
The server checks current permissions on every operation. A service token cannot perform human
review. Complete the existing payment draft/finalization flow before starting this example.

```ts
import { prepareVerification, readReviewSnapshot, recordHumanReview, generateReviewedFile } from "./journey.js";

// target comes from the finalized order's exact revision/digest, selected profile revision,
// and explicit intended submission date. Do not replace these with mutable display values.
const prepared = await prepareVerification(
  requester,
  { legal_entity_id: legalEntityId, bank_connection_id: connectionId, target },
  orderResourceVersion,
  requestIdempotencyKey,
);
if (prepared.kind === "unavailable") {
  // Show prepared.discovery.availability and reason_codes; do not infer an opt-out.
  return;
}
// Retain prepared.input and prepared.options in authorized application storage before sending.
const started = await requester.payeeVerifications.request(prepared.input, prepared.options);
const verificationId = started.payee_verification.payee_verification_id;

// Persist the returned ID. Refresh this read according to task.poll_after_seconds while active.
// Refreshes never submit a new verification or directly poll the bank.
const snapshot = await readReviewSnapshot(human, verificationId, target);
// Display task state, every item/result, observations, usability and evaluation time separately.
// Pause here until the human chooses. Do not derive a decision from task.state === "succeeded".
const reviewed = await recordHumanReview(human, snapshot, humanChoice, reviewIdempotencyKey);

const result = await generateReviewedFile(fileReader, reviewed.review);
if (result.kind === "review_required") {
  // Show result.current and obtain a new review when appropriate; never silently reuse it.
  return;
}
// result.content.bytes is bounded, integrity-checked XML. Save only to an authorized destination.
// Display result.evaluation.evaluated_at and its exact target/policy/evidence binding alongside it.
```

This example does not run polling timers, retry commands, choose a human decision or send bank
messages automatically. A timeout may mean a command succeeded: preserve its input and idempotency
key and reconcile using the resource/read/list operations. Do not rediscover a capability and send
a changed request under the same key, or invent a new key to bypass an uncertain outcome. An expired
idempotency window requires reconciliation. Unusable or indeterminate evidence stops this reviewed
file journey; bank `no_match` remains visible even when evidence itself is usable.

The example pins item and observation pages and refuses incomplete or excessive views (100 pages
of at most 100 rows per collection). Large reviews need a paged UI; never truncate them silently.
Raw evidence and suggested names are fetched only through an explicit, authorized
`payeeVerifications.evidence` call. Do not log response bodies, target identifiers or generated XML.

`generateReviewedFile` re-evaluates the exact reviewed target before and after the download. Changed
evidence, policy, profile, date or revoked read access prevents returning bytes from this journey.
The immutable order revision owns creditor details and any proposed submission-date option; the
server checks its relationship to the explicit verification date. These reads are point-in-time
evaluations, not a lock on future eligibility or proof of payment approval. Corrections require a
new revision and a fresh server evaluation/review. No bank validity date is invented.

Generation remains independently available through `paymentBatches.generateFile`; the server adds
no review or verification prerequisite to that read. Processing-owned financial effects enforce
their configured evidence policy separately. The unchanged File Exchange transport cannot ensure
that a customer-uploaded file still contains the reviewed payment details.

## Imported V9 input

For an existing file, use `payeeVerifications.importInput` with bounded `pain001_base64`, the entity,
connection, profile revision and submission date. Persist its idempotency key first. Construct the
verification target using the returned `admission.input_admission_id` and the returned profile/date
binding, with `target_kind: "imported_payment_artifact"`; use `admission.resource_version` in
`prepareVerification`. Continue through request, reads and human review as above.

This route accepts neither an arbitrary Artifact ID nor automatic File Exchange retrieval. It does
not create a PaymentOrder. Consequently `generateReviewedFile` refuses an imported target; generation
requires a separately finalized exact order target and its own server evidence evaluation. Never
pretend the imported file or VoP request bytes are the generated payment file.

Run `yarn build:examples` to type-check/build the example and
`yarn vitest run examples/payment-verification/journey.test.ts` for its client-only tests.
