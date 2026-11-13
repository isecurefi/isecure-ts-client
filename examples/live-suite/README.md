# Live payment and simulator suite

## Current production qualification

The former Processing test deployment was retired on 17 October 2026. The test-mode
suite described below is retained for historical evidence; it cannot qualify today's
production release.

Use the explicit production mode with an operator-created **temporary synthetic
account**, its own API key, and a temporary Processing entitlement/database placement:

```sh
yarn test:live production /absolute/private/fixture.json /absolute/private/new-report.json
```

The fixture file must have mode `0600`. It contains `account` (the ordinary WS SDK
configuration), `release` (`sourceRevision`, `codeSha256`, `gatewayDeploymentId`,
`sdkRevision`), and `acknowledgement` set to
`temporary-production-fixture-no-bank-submission`. The account must use the production
WS URL and company label `ISECure Synthetic Processing Qualification`. Record release
metadata from AWS immediately before running, then confirm it is unchanged afterwards;
the suite does not independently attest operator-supplied release metadata.

The operator first registers and verifies the temporary account through the WS API,
then uses the platform's existing `run-processing-onboard-tenant` command to admit its
payment-only entitlement, usage-plan key and tenant placement. Give the entitlement a
bounded expiry. Never reuse a customer's account. MFA is prompted through the existing
SDK authentication helper. For an unattended run, an operator may provision TOTP on
the exact synthetic identity using the existing fixture-bootstrap pattern, then supply
a fresh `ISECURE_ADMIN_MFA_CODE`; the SDK must still complete the ordinary MFA login.
Do not change pool policy or a customer identity. Credentials stay in private
files/memory, outside Git.

Production checks cover Gateway denials, real Processing session exchange, Nordea
unstructured payment preparation, profile readback, duplicate draft creation, repeated
integrity-checked XML generation, stale revisions, unknown orders, preserved finalized
state and cancellation of a separate draft. This is **one bank-profile journey**, not
all 27 operations, all bank profiles, cross-tenant qualification or bank acceptance.
The traffic boundary allows only these operations, refuses redirects and limits the
run to 100 Processing requests. It never approves, releases, executes or uploads a
payment. A failed request is not automatically retried.

The report includes check outcomes, safe HTTP/request-ID metadata and the supplied
release identity. It never contains credentials, response bodies or generated XML.
`cleanup: required` means the checks are finished but lifecycle qualification is not:
revoke the temporary Processing tenant access, suspend its entitlement, remove its
Processing usage-plan association, and retire the temporary WS account. A customer
fixture uses the supported deletion API with fresh MFA. A newly registered tenant's
root owner is deliberately not deletable through that API: its owner-authorized
operator teardown must verify the exact fixture identity, creation time and API key,
refuse linked accounts or PGP material, remove its Cognito identity/key/private usage
plan, and retain a disabled account tombstone with the established 30-day TTL. Detach
the fixture's API-stage association before removing its private usage plan; do not
delete the API stage. Preserve independent audit history and record the cleanup
result. Retained synthetic database records are not customer data, but
must be disclosed in the run receipt; do not drop a database through an ad-hoc command.
If interrupted, inspect the private receipt and complete cleanup before another run.

## Historical test and simulator mode

`yarn test:live` performs **one run**. It does not repeat a run or retry a payment upload.
It reuses the Processing-to-simulator journey, including its exact-byte integrity checks,
feedback correlation, exact decimal statement assertions and upload checkpoint.

Run it against an operator-admitted synthetic fixture in gpgtest. After that one-time setup,
the suite logs in without prompts, checks access, enrolls its simulator connection if needed,
executes the workflows and suspends its File Exchange simulator entitlement afterward. Missing
or deleted fixture identities fail closed; replacing them requires the guarded backend release
workflow. The suite never substitutes a new identity into old approval history.

## Scope

The worker authenticates separate submitter and approver identities and the Admin-paired Data
uploader through the File Exchange API, requiring an actual TOTP challenge. It exchanges
Processing sessions, discovers the Bank Simulator API's synthetic capability and verifies that
the approver lacks simulator control permission. The existing payment journey then creates,
validates, finalizes, independently approves and releases a payment; downloads and integrity-checks
its XML; signs and uploads it once; and checks `pain.002`, `camt.054` and the exact `camt.053`
balance transition. Before and after the payment, it also checks that file creation timestamps remain
stable across repeated listings separated by a clock tick and downloads. Existing files must retain
their timestamps when new payment outputs arrive. These checks are suite code, not SDK behavior.

Before the payment, a separate signed File Exchange VoP upload uses `pain.001.001.09 VOP`
and downloads only `pain.002.001.10 VOP`. It covers six transactions across three payment
blocks, repeated identifiers, absent instruction IDs, retained UETRs, pending then all six final
Nordea-style outcomes, close-match name placement, exact repeated downloads and wrong-service
download denial. Report creation times differ by 30 virtual seconds. Existing payment and cash
files must be unchanged, with no new ordinary outputs. File timestamps remain immutable real
recording times. This is synthetic simulator evidence, not Nordea transport qualification.

File listings run one at a time, and empty feedback folders may contain `FileDescriptors: null`.
The retained fixture's statements are linked by their exact opening and closing balances to find
one current balance, because simulator listing timestamps can tie. Disconnected or cyclic histories
stop the run before upload. The suite reads at most 256 descriptors per file type; rotate the admitted
fixture when that bound is reached, preserving its audit history.

The suite also reuses the platform's existing 21-operation Bank Simulator qualification: workspace
and scenario management, synthetic runs, clocks, checkpoints, branches, feedback artifact references,
revision and replay checks, cross-tenant denial, and authenticated event streaming. Each invocation
has independent idempotency keys. The backend checks absent/suspended entitlement denial before
activation and confirms denial after cleanup, allowing the 60-second cache to expire. A separate
unentitled tenant stays denied. The initial fixture run covers missing-item denial; subsequent runs
cover suspended-item denial. Local/mock coverage is separate from live evidence.

All business calls use `https://ws-api.test.isecure.fi/v2` and
`https://processing-api.test.isecure.fi`. The worker refuses other endpoints and never prompts for
input. AWS operations stay in `ws-channel-api/scripts/live-suite-fixture.mjs`; the public SDK gains
no simulator-specific behavior or AWS administration dependency.

## Configuration and invocation

Use Node.js 24 and the test AWS profile `dforsber`. Build/install dependencies as for the existing
examples. Store this operator configuration in an absolute-path, mode-`0600` file outside Git:

```json
{
  "version": 1,
  "lambdaVersion": "<deployed-version>",
  "platformRoot": "/absolute/path/to/qualified-platform-checkout",
  "sdkRoot": "/absolute/path/to/isecure-ts-client",
  "clientRevision": "<full-sdk-source-commit>",
  "receipt": "/private/path/to/deploy-receipt.json",
  "adversaryCheckpoint": "/private/path/to/adversary-checkpoint.json",
  "manifest": "/private/path/to/processing-release-manifest.json",
  "authenticationCheckpoint": "/private/path/to/retained-auth-checkpoint.json",
  "uploaderCheckpoint": "/private/path/to/paired-uploader-checkpoint.json",
  "publicKeyFile": "/private/path/to/test-rsa-public.pem",
  "pgpPublicKeyFile": "/private/path/to/authorize-public.asc",
  "pgpPrivateKeyFile": "/private/path/to/authorize-private.asc"
}
```

The version, receipt and manifest must identify the deployed release. The platform checkout must
include the repeatable qualification runner and have its infrastructure TypeScript compiled. Credential checkpoints use the existing backend qualification format:
`admin` and `data` contain `username`, `password`, and `apiKey`; `admin` also contains `totpSecret`.
The paired uploader checkpoint contains `username`, `password`, and `apiKey`. These files and
private signing keys must remain private. The fixture is pinned to synthetic `@example.invalid`
identities, AWS account `589434896614`, region `eu-west-1`, and the test user pool.

```sh
yarn test:live /absolute/path/to/ws-channel-api /private/path/to/fixture-config.json
```

The backend checks the deployed admission and credential ownership before enabling anything.
Missing/deleted identities or unavailable AWS connectivity block the run. An already-active
fixture is refused. Successful preparation acquires an exclusive tenant lease and changes access
only through the guarded entitlement operator, including its conditional write and read-back.

Each invocation creates a new private `.isecure-live-suite/run-<uuid>/` directory. A completed
journey cannot be silently reused as a new run. To verify repeatability, invoke the command again
as a separate action after reviewing the first result; there is no default repetition count.

Exit codes: `0` means the workflow and cleanup passed; `1` means failure; `2` means a prerequisite
blocked execution. `report.json` contains only fixed stage names, outcomes and timestamps. It
contains no credentials, customer identifiers, payloads or raw exception text. A blocked run is
not end-to-end evidence. Exact downloaded files and the existing reconciliation checkpoint stay
in private subdirectories and must not be published as CI artifacts.

## Cleanup and interrupted runs

Once preparation starts, the runner attempts cleanup even if a later stage fails. Cleanup suspends
the exact retained synthetic tenant's simulator entitlement and removes the temporary credential
copy. It retains the fixture identities, private recovery state and synthetic workflow/file records
under their existing retention rules. Cleanup waits 62 seconds for the bounded entitlement cache and proves that file listing is denied.

Cleanup never calls a CloudWatch Logs deletion API, deletes an account audit stream or changes its
3,653-day retention. It does not delete shared bank-file infrastructure. A cleanup error makes the
run fail even when the payment assertions passed.

After process termination or an interrupted cleanup, use the separate recovery command:

```sh
yarn test:live cleanup /absolute/path/to/ws-channel-api /private/path/to/fixture-config.json \
  /absolute/path/to/.isecure-live-suite/run-<uuid>
```

Recovery performs cleanup only. It never resubmits a payment. Inspect any `upload_started` or
`upload_uncertain` journey checkpoint before starting another payment run. Enable a schedule only after fixture admission and live acceptance have passed. Do not run two
invocations concurrently against the same fixture; the exclusive lease prevents that.

## Optional retained-history guard

Use `yarn test:live scheduled <backend-root> <private-config>` to add a retained-history guard.
The `scheduled` argument is only the command name; it does not install or enable a schedule. It performs
exactly one run and adds a preflight guard: every prior `run-*` directory must have a complete,
successful report with successful cleanup. Interrupted, failed, malformed or missing reports stop
execution before fixture preparation. Review and reconcile the exact payment checkpoint, perform
cleanup recovery if needed, then move the reviewed run directory to a private retained archive
outside `.isecure-live-suite`. Never delete audit evidence or clear a failure just to restart.

Keep the working directory and private run history on durable storage across invocations. Use one
execution concurrency group per fixture, with cancellation disabled. Protect credentials and signing
keys outside the checkout; run only reviewed, pinned source with the config's `clientRevision`
updated to that exact commit. Export only the sanitized `report.json`, never the run directory.
An ephemeral runner without restored durable history is not suitable for this guard.

Run the suite on demand from the existing configured operator environment. No recurring execution
is configured or planned; a GitHub runner is not required for local invocation.

## Recorded gpgtest acceptance

Two separate invocations passed on 20 September 2026 against Processing version 233 and simulator
control version 56. Both used SDK code revision `0ddbc6c`, exercised all five suite stages and the
21-operation simulator qualification, completed the payment/feedback/statement journey, and passed
cleanup. The [sanitized acceptance record](acceptance.json) records the exact versions and outcomes.
This is synthetic test-environment evidence; it does not qualify a production or real-bank connection.

## Optional on-demand GitHub execution

`.github/workflows/live-gpgtest.yml` supports manual dispatch only. It has no scheduled trigger.
Its job is disabled unless repository variable `ISECURE_LIVE_SUITE_ENABLED` is exactly `true`.
No runner or credential is provisioned by this workflow. It requires a dedicated trusted runner
labelled `isecure-gpgtest`, Node.js 24 and a protected `gpgtest` environment. Do not expose that
runner to pull-request jobs or unreviewed workflow changes.

Configure the six path/revision variables listed in the workflow. `ISECURE_WSAPI_ROOT` identifies
the `ws-channel-api` subdirectory of the pinned AWS repository; `ISECURE_SDK_ROOT` identifies the
pinned SDK checkout. Install dependencies and compile SDK/examples before credentialed execution.
Keep the fixture config's `sdkRoot` and `clientRevision` aligned with that checkout. The private AWS
profile remains `dforsber`, and the backend verifies the test account independently.

`ISECURE_LIVE_WORK_DIR` must be a durable private directory outside disposable checkout/runner
workspaces. Retain its `.isecure-live-suite` history across jobs and updates. Repository concurrency
queues runs without cancelling an active payment; the fixture operator also acquires its tenant
lease. An interrupted run leaves history that blocks future guarded runs until operator recovery.
Do not automatically clear leases, archive failures, resubmit uploads or delete audit evidence.

Before enabling the variable, admit the fixture and run the guarded command manually from that
same working directory with the exact pinned revisions. Review a passing report and cleanup, then
enable manual dispatch. The workflow uploads no private artifacts. GitHub shows failed jobs;
notification delivery follows the repository's configured Actions notification settings.
