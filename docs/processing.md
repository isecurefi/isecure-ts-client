# Experimental Processing API

[Back to the README](../README.md)

These clients require a separately deployed Processing API and its own access permissions.
SDK methods and examples do not establish that a hosted service is available. The independent
[Simulator administration API](simulator-administration.md) uses a different transport and needs
no Processing deployment.

The separate `isecure-ts-client/iso20022` entry point exposes the platform's generated observation,
payment-batch, payment-submission and payment-outcome operations. It does not change the permanent
WS Channel/File Exchange client above.

```ts
import {
  createIso20022Client,
  Iso20022HttpTransport,
  ProcessingEntitlementDeniedError,
} from "isecure-ts-client/iso20022";

const transport = new Iso20022HttpTransport({
  baseUrl: "https://release-selected-processing-api.example/",
  processingAudience: "isecure-processing-example-v1",
  bootstrapAuthentication: async () => ({
    apiKey: await currentApiKey(),
    idToken: await currentIdToken(),
  }),
});
await transport.exchangeProcessingSession();
const iso20022 = createIso20022Client(transport);

try {
  const page = await iso20022.statements.list({
    bank_account_id: "00000000-0000-4000-8000-000000000001",
    page_size: 50,
  });
  console.log(page.statements);

  const capabilities = await iso20022.paymentCapabilities.list({
    connected_account_id: "00000000-0000-4000-8000-000000000002",
    page: { page_size: 50 },
  });
  console.log(capabilities.capabilities);
} catch (error) {
  if (error instanceof ProcessingEntitlementDeniedError) {
    // Authentication succeeded, but this tenant has no active entitlement for the operation.
  }
}
```

This surface is an experimental adapter over the digest-pinned platform contract, not an ISO
standard implementation or a support claim. Exact ISO syntax and validation remain upstream and
server-side. The SDK adds no bank profile, qualification, financial validation, policy, workflow,
retry, approval, execution, or authority semantics. Generated command methods require the exact
idempotency and expected-resource-version options declared by their operation; the client forwards
them and performs no local replay or state transition. Every call sends the operation's explicit
generated contract version; request URLs, JSON request/response bytes, and duration are bounded,
and responses must be JSON. The HTTP adapter never retries a request and rejects plaintext
non-loopback endpoints.

## Processing simulation operations

The same experimental entry point also exposes the generated Bank Simulation control plane under
plain-English namespaces: `simulationCapabilities`, `simulationWorkspaces`, `simulationScenarios`,
`simulationRuns`, `simulationClocks`, `simulationCheckpoints`, `simulationBranches`,
`simulationEvents`, and `simulationArtifacts`. These methods expose only the public Processing
operations. They do not expose the private simulator Module transition, checkpoint bytes, AWS
resources, or a second File Exchange client. Artifact results are exact references; callers use the
unchanged File Exchange surface for authorized bytes. The control API is qualified only for governed
synthetic testing in non-production `gpgtest`; no RC/production route or real-bank support is
implied. The generated operation metadata records the dedicated `manage_simulation` permission and
exact public audiences; the server remains the sole authority for authentication, permission
assignments, entitlement, and revocation.

```ts
const capabilities = await iso20022.simulationCapabilities.list({ page: { page_size: 25 } });

const page = await iso20022.simulationWorkspaces.list({
  state: "active",
  page: { page_size: 25 },
});

await iso20022.simulationClocks.control(
  {
    workspace_reference: {
      resource_type: "simulation_workspace",
      resource_id: workspaceId,
      resource_version: "7",
      revision_id: workspaceRevisionId,
    },
    expected_clock_revision: "11",
    control_kind: "step_event",
  },
  {
    idempotencyKey: "clock-step-11",
    expectedResourceVersion: '"7"',
  },
);
```

The client forwards exact resource references and snapshot cursors. It does not cache tenant state,
deduplicate commands, retry mutations, infer revisions, or execute simulator rules locally. Clear
the separate Processing session with `transport.clearProcessingSession()` when access is revoked or
the integration signs out.

The same transport can open one finite authenticated SSE lease without exposing its private
Processing token. Stream items are bounded `event` or `task` notification objects plus heartbeats.
The SDK deliberately does not interpret their payload, reconnect, or treat them as complete
evidence. Retain the last completely handled opaque cursor, reconnect explicitly, tolerate
duplicates, and reconcile through generated list/get operations after every gap, expired cursor, or
indeterminate command.

```ts
const controller = new AbortController();

for await (const item of transport.streamProcessingEvents({
  lastEventId: previousCursor,
  signal: controller.signal,
})) {
  if (item.kind === "heartbeat") continue;
  previousCursor = item.id;
  // Refresh the exact authorized Run, task, event, and Artifact resources.
}
```

Each server lease is intentionally finite. Cancel it on sign-out, permission/entitlement loss, or
when the consuming view is no longer active. A notification is not payment approval, bank
acceptance, settlement, or a replacement for the cursor-paged event resource.

The plain-English payment surface separates four concepts:

- `paymentBatches` builds, validates, finalizes, reviews and downloads a batch containing multiple
  payments;
- `paymentSubmissions` creates and observes one authorized attempt to send an exact approved file;
- `paymentOutcomes` exposes conclusions derived by the server from retained bank evidence; and
- the unchanged File Exchange client remains the separate channel upload boundary.

For generation without an approval workflow, use `paymentBatches.generateFile` with the exact
finalized order revision and configured profile revision:

```ts
const content = await iso20022.paymentBatches.generateFile({
  payment_order_id: paymentOrderId,
  order_revision_id: orderRevisionId,
  payment_export_profile_id: profileId,
  profile_revision: profileRevision,
});
// content.bytes contains integrity-checked XML; save it only in an authorized destination.
```

This experimental operation requires deployment availability, a Processing session and read
entitlement. The SDK checks response bounds, XML media type, artifact identity, byte length,
SHA-256 and `no-store` before returning bytes. Generation creates no approval, release, retained
export or bank submission. The existing approved-export download still requires its separate
artifact authority. Neither path retries or uploads automatically.

The experimental `payeeVerifications` namespace exposes the payment-bound VoP v2 contract:
`capability`, `importInput`, `request`, `list`, `get`, `explain`, `items`, `observations`, `evidence`
and `review`. This candidate has local contract tests; hosted VoP availability and bank-connected
qualification remain pending. A method being present does not establish connection eligibility.

Pass the exact order revision, revision digest, export-profile revision and submission date as the
verification target. `get` and `explain` return the server's usability evaluation for that target,
including its evaluation time, observation set and policy binding. Work state, match outcomes,
usability and the human decision remain separate facts. A succeeded task need not mean every
payee matched. Evidence and suggested names require authorized access.

`importInput` admits uploaded V9 bytes through Processing before a verification request; it does
not accept an arbitrary Artifact ID. `request` and `review` require explicit idempotency and expected
version metadata. Review requires a human-authenticated session and records a decision against the
exact target, observation set and policy. It does not approve a payment. Reads never request a new
verification, and the SDK does not poll, resubmit uncertain work or change payment details
automatically. Generate independently with `generateFile`; generation success makes no claim about
verification freshness. The complete hosted discover/request/read/review/generate journey remains
subject to the platform's combined-service acceptance.

The [payment verification example](../examples/payment-verification/README.md) shows explicit
request preparation, paged results, human review and exact-target re-evaluation around generation.
Capability discovery returns availability and reasons even when no capability is available.
The server owns disclosure authorization; the request accepts no caller-supplied authorization
or consent reference. The example's local HTTP-double tests do not qualify a hosted bank connection.

For compatibility, `paymentOrders` retains aliases over the same generated operations. In
particular, its older `execute` name creates an attempt only; it does not sign, upload or contact a
bank. The clearer equivalent is `paymentSubmissions.createAttempt`.

A local Connector uses `paymentSubmissions.claim`, downloads the exact attempt-bound file through
`paymentSubmissions.download`, signs those unchanged bytes inside its protected local key boundary,
uploads through its separately qualified channel client, and calls
`paymentSubmissions.reportUpload`. The Processing client accepts no private key, password or
detached-signature field and performs no automatic retry or upload orchestration. An upload report
never proves bank acceptance.

There is deliberately no `paymentFeedbacks` client namespace yet. The current Processing contract
exposes evidence references and derived `paymentOutcomes`, but no independently addressable bank-
feedback resource. The SDK does not rename an outcome as feedback or invent a client-only contract.

The runnable [manual Processing-to-ISECure upload example](../examples/processing-manual-upload/README.md)
shows the currently available bridge: two separately authenticated users create and approve a
Processing payment export, the SDK integrity-verifies the generated `pain.001.001.09`, and the
example detached-OpenPGP-signs and uploads those exact in-memory bytes through the unchanged
`WSChannel`. This is an explicit, non-retried manual upload—not `paymentOrders.execute`, automatic
bank orchestration, feedback reconciliation, bank acceptance, or production qualification.

The local experimental contract includes Danske Finland's ordinary V9 SEPA payment profiles.
Discover the current deployment's availability with `paymentExportProfiles.list()`; the SDK
contains no bank catalog or bank rules. Danske's account capability requires a
`{ option_type: "proposed_submission_date", proposed_submission_date: "YYYY-MM-DD" }`
order option, separate from `requested_execution_date`. Processing seals it in the order revision
and returns it in export metadata. The SDK forwards the authored date without deriving it from
its clock. Feedback, statements and notifications retain the same generated observation interfaces;
financial interpretation, service selection and qualification remain platform responsibilities.
This local adoption does not assert deployment, bank agreement or production acceptance.

The source pin and artifact hashes are recorded in `platform-contracts.lock.json`. With a compatible
`bankfiles-platform` checkout next to this repository, maintainers update and verify the generated
surface using:

```sh
npm run sync:platform-contracts
npm run check:platform-contracts
```

For a release candidate, pin the exact platform commit explicitly so a concurrent platform `HEAD`
change cannot alter the generated bytes:

```sh
npm run sync:platform-contracts -- --revision <full-platform-commit>
```
