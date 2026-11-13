# Processing API

[Back to the README](../README.md)

Use Processing to prepare and validate payments, then generate the payment XML. Uploading that
file to a bank is a separate step through the WS Channel/File Exchange API.

The published SDK includes Processing through `isecure-ts-client/iso20022`. This part of the SDK
is **experimental**: its generated types can change with the platform contract. See
[API stability](../STABILITY.md). SDK method availability does not mean every method is deployed.

## Service availability

Deployment checked on **12 November 2026**:

| Setting             | Production value                    |
| ------------------- | ----------------------------------- |
| Processing URL      | `https://processing-api.isecure.fi` |
| Processing audience | `isecure-processing-production-v1`  |
| WS login URL        | `https://ws-api.isecure.fi/v2`      |

Processing currently runs only in production. Its former gpgtest deployment was retired on
17 October 2026; do not use `processing-api.test.isecure.fi`. The independent Bank Simulator,
[Simulator administration](simulator-administration.md) and [Plugin API](plugins.md) are separate
services. Their test environments do not provide a Processing test endpoint.

The deployed Processing API contains payment profile, capability, draft, validation, finalization
and file-generation routes. The standard generation flow passed a synthetic production check on
27 October 2026. This is historical qualification, not proof that a newly onboarded tenant or every
later SDK release has been tested end to end.

Statement/transaction observations, submission tracking, outcomes, Verification of Payee (VoP),
Processing simulation, hosted Integration setup and event streaming have SDK interfaces but are
not part of the deployed payment-generation route set checked above. Approval/export routes are
present, but the current production workflow has no configured Processing approval policy. Start
with generation; do not assume the older approval examples are ready to run in production.

## Before you connect

Ask ISECure to provision your production Processing access. You need:

- A registered production WS account and its API key.
- An active Processing subscription with the capabilities you will use.
- A provisioned Processing tenant database, account permissions and API Gateway usage-plan access.

Registration alone does not enable Processing. A test account cannot authenticate to production,
and Plugin catalogue access does not grant Processing access.

## Connect and list payment profiles

First complete the normal WS login, including any requested MFA. In this example, `channel` is
that authenticated `WSChannel` instance. Processing uses its **ID token**, not its access token.
The exchange creates a separate Processing session.

```ts
import { createIso20022Client, Iso20022HttpTransport } from "isecure-ts-client/iso20022";

const transport = new Iso20022HttpTransport({
  baseUrl: "https://processing-api.isecure.fi",
  processingAudience: "isecure-processing-production-v1",
  bootstrapAuthentication: () => {
    const { apiKey, idToken } = channel.session;
    if (!apiKey || !idToken || channel.isSessionExpired()) {
      throw new Error("Sign in to ISECure before opening Processing.");
    }
    return { apiKey, idToken };
  },
});
await transport.exchangeProcessingSession();
const processing = createIso20022Client(transport);
const profiles = await processing.paymentExportProfiles.list();
// Display the profiles to the signed-in user; do not log account data or tokens.
```

Use the server's profile catalogue and account capabilities to choose a supported format.
The SDK contains no bank rules and cannot determine which services your bank agreement allows.
Clear the Processing session with `transport.clearProcessingSession()` on sign-out, account
changes or revoked access. After expiry, sign in again as needed and explicitly exchange a new
Processing session. The transport does not refresh it automatically.

## Prepare and generate a payment file

The standard path is:

1. Select and configure an export profile for your bank agreement.
2. Create a payment draft and add the transfer details.
3. Validate it, resolve any issues and finalize the draft.
4. Generate XML for that exact finalized order and profile revision.
5. Separately authorize, sign and upload the unchanged bytes through File Exchange when intended.

The [generation example](../examples/processing-generate-file/README.md) implements steps 1–4.
It creates Processing records but sends nothing to a bank. For an already finalized order:

```ts
const content = await processing.paymentBatches.generateFile({
  payment_order_id: paymentOrderId,
  order_revision_id: orderRevisionId,
  payment_export_profile_id: profileId,
  profile_revision: profileRevision,
});
// content.bytes contains the verified XML. Save only to an authorized destination.
```

The SDK checks the XML media type, file identity, length, SHA-256 digest, response size and
`no-store` instruction before returning bytes. Generation does not approve a payment, upload it,
or prove bank acceptance. File Exchange enforces the account's required PGP signatures at upload.
An approved-export download is a separate operation with its own authorization requirements.

Supply the dates required by the chosen profile. For example, Danske Finland V9 profiles use an
order option `{ option_type: "proposed_submission_date", proposed_submission_date: "YYYY-MM-DD" }`
in addition to `requested_execution_date`. The SDK forwards the dates you provide; it does not
choose them from its clock. Discover profile availability on the server before using it.

## Errors, timeouts and retries

- `ProcessingEntitlementDeniedError` means the service refused Processing entitlement. Check the
  tenant's subscription, validity and required capabilities; successful WS login is not enough.
- `Iso20022HttpError` reports an HTTP failure. A missing route may mean the operation is not
  deployed. Inspect the status and safe diagnostic fields without logging the raw response body.
- `Iso20022TransportError` reports a transport or response-validation failure. Do not assume a
  timed-out command failed before changing server state.

Processing's default timeout is **30 seconds**, configured by `Iso20022HttpTransport.timeoutMs`
(1–300,000 milliseconds). The WS Channel client's 70-second default does not change this setting.
Increasing a client timeout does not increase the server's timeout.

Request and response limits default to 1 MiB each. Set `maxRequestBytes` or `maxResponseBytes`
explicitly when needed, up to 16 MiB each. These SDK limits do not increase the deployed service's
payload limits.

The Processing transport never retries automatically. Commands require the idempotency key and,
where specified, the expected resource version declared by their types. Preserve the original input
and key for an explicit retry of the same command. After an uncertain result, read the current
resource before deciding what to do; do not create a new key just to bypass uncertainty. For a stale
revision, read the latest state before preparing a new command. A File Exchange upload has separate
retry rules: a Processing idempotency key does not make a bank upload safe to repeat.

Keep passwords, tokens, MFA codes, private keys, signed links and payment contents out of logs.
Retain only safe error metadata needed for support.

## Other SDK interfaces

These interfaces are available in the package, but require a separately qualified server release
and permissions. They are not additional promises about the current production deployment.

| Interface                                 | Purpose                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `paymentBatches`                          | Create, validate and finalize payments; generate files. Its approval methods need a configured approval workflow.            |
| `paymentSubmissions`                      | Track an authorized attempt to submit a particular file. The SDK does not sign or upload it automatically.                   |
| `paymentOutcomes`                         | Read server conclusions from bank evidence. An upload report alone does not prove acceptance.                                |
| Observation methods, such as `statements` | Read structured observations where the service provides them. Use WS Channel for current bank file exchange.                 |
| `payeeVerifications`                      | Request and review VoP results for an exact payment target. Hosted bank qualification remains separate.                      |
| `simulation*`                             | Control the historical Processing simulation workflow. These are distinct from the independent Simulator administration API. |

`paymentOrders` keeps compatibility aliases. In particular, its older `execute` method means
`paymentSubmissions.createAttempt`; it does not contact a bank. A Connector using the submission
workflow claims an attempt, downloads its exact file, signs/uploads through its own File Exchange
client, and reports the result. Processing accepts no private signing key through these methods.
There is no separate `paymentFeedbacks` namespace.

The [VoP example](../examples/payment-verification/README.md) explains exact revision binding,
paged results, human review and rechecking evidence. A completed verification task does not mean
every payee matched, and a human VoP review is not payment approval. Imported V9 verification input
is separate from a finalized order; it cannot be passed off as a generated payment file.

`streamProcessingEvents` supports a finite SSE connection where deployed. It does not reconnect
automatically. Keep the last handled cursor, tolerate duplicates and refresh authoritative resources
after a gap. Stop the stream on sign-out or lost permissions. Notifications do not replace resource
reads or prove payment acceptance. No event-stream route was present in the deployment checked above.

The [manual approval/upload](../examples/processing-manual-upload/README.md) and
[Processing-to-Simulator](../examples/processing-simulator-journey/README.md) examples document
historical qualification flows. Neither is a current production quick start. Do not change their
URLs to production and run them: they perform uploads and require separately configured authority.

## Maintaining the generated contract

`platform-contracts.lock.json` records the platform revision and artifact hashes. With a compatible
`bankfiles-platform` checkout beside this repository, maintainers can synchronize and check it:

```sh
npm run sync:platform-contracts -- --revision <full-platform-commit>
npm run check:platform-contracts
```

Pin the exact revision so a concurrent platform change cannot alter the generated files.
Contract checks and local tests do not replace qualification against the intended deployed release.
