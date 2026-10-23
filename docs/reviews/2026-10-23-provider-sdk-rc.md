# Unpublished provider SDK candidate — 23 October 2026

Source baseline: SDK 6b3ab3d (the separate 4.5.2 release). Candidate: 4.6.0-rc.0,
not published. Backend companion SHA-256:
`a662369342cdc0e36cf1c959123c0bfdabc5d7774953117786781ac415170a80`.

## Review 1: functional correctness

Traced both native handlers and their compatibility enrollment decoder through generated
schemas, SDK methods and the maintained qualification harness. Fixed the source Maventa
environment enum and omitted readiness fields before generation. Connection methods keep
Bank unchanged, use exact request bodies and revision/idempotency headers, and disable
all automatic mutation retries. Existing enrollment/list/download methods remain intact.
Tests exercise both providers through SDK authentication and transport, certificate-free
discovery, complete downloads, revision replacement/replay/conflicts and disable. Empty
Maventa mailboxes fail qualification. MobilePay requires both funds and fees and a complete
terminal page. Source/synthetic review passes; real-provider RC acceptance is pending.

## Review 2: security, privacy and evidence

Short provider credentials now redact by field name. RED reproduced raw exception-message
leakage in LoggingTransport; GREEN verifies a fixed logged message while typed errors remain
available to the caller. The private live harness admits exact test/RC targets, selected
account authentication and provider routes only, rejects redirects, uses owner-only files,
and prints aggregate results instead of customer identifiers, secrets or reports. Read and
credential-mutation modes are separate. Lifecycle requires an unused isolated fixture,
different authenticated tenant and subscription-denied account. Cleanup disables only a
revision owned by that invocation; a concurrent change is preserved. HTTP 401/network errors
do not count as authenticated denial. No real account, credential or subscription was changed
by these source tests. No privileged-access exception appears in public docs/contracts.

## Review 3: simplicity, generated drift and scope

The backend config/template remain the contract authority. One exported companion and its
byte digest drive generated SDK types; existing File Exchange contracts/methods are reused.
The MobilePay type narrows explicit fixed/all-ledger alternatives without choosing authority.
The harness reuses SDK authentication and methods, with no AWS access, account provisioning,
provider simulator, provider credential store, financial conversion or automatic fallback.
Generated files are regenerated, not edited. Backend formatting owns the vendored JSON,
matching the existing wsapi contract convention; digest tests and source comparison enforce
it. Candidate work is isolated from the concurrent 4.5.2 release. Review passes.

## Evidence and limits

Initial API/method/redaction and harness-boundary tests failed before implementation.
`yarn prepublishOnly` passes formatting, type-aware lint, strict source/example types,
398 tests and coverage (94.78% statements, 91.36% branches, 96.27% functions, 95.29% lines),
browser build and package checks. Source contract comparison passes. `yarn audit --summary`
reports zero vulnerabilities across 276 packages. Private logs are retained in the candidate
worktree's `.private/provider-sdk-rc-20261023/`.

Production RC qualification still requires explicitly authorized account/credential files,
a Maventa received invoice and real MobilePay funds/fees results. The test doubles establish
SDK/harness behavior, not server tenancy or upstream success. SDK publication, live promotion
and Production app publication remain on hold. The owning backend task stays unchecked.

Follow-up security review: subscription denial must use a third tenant, because product
grants belong to tenants rather than users. A regression first reproduced acceptance of
a same-tenant denial fixture; the harness now rejects it before enrollment. Foreign-file
isolation requires 404 from a distinct tenant with an active provider read grant, so an
earlier missing-subscription 403 cannot masquerade as tenant-isolation evidence. Operator
grant readbacks remain required before the real run. Updated release checks pass all
399 tests; runtime package bytes are unchanged because this correction is confined to the
maintained qualification example and its documentation/tests.

Actual MobilePay test read evidence: the maintained read CLI passed against the already
authorized retained gpgtest connection using SDK authentication and methods. Functional
review verifies readiness, direct discovery with an empty certificate array, both canonical
file-type listings and two complete downloads with two terminal pages. This does not assert
nonempty transactions or exhaustive history. It does not qualify Maventa or production RC.

Security/privacy/evidence review confirms the test subscription began suspended, was enabled
through the guarded operator writer with its expected revision and a ten-minute expiry,
then was suspended again at revision 19. Exact account/connection readback is unchanged;
no provider credential was enrolled, replaced or disabled. Reports remain in memory and
receipts contain only statuses and aggregate counts. Initial private-wrapper attempts were
refused by the writer's strict JSON input parser before any grant change or SDK read; compact
serialization has explicit refused/accepted evidence, and the unchanged baseline was verified
before the successful attempt. Authentication and session cleanup also passed independently.

Simplicity/scope review reuses the maintained SDK read CLI, existing stored connection and
guarded subscription writer. No SDK code, fixture account, simulator, production grant or
API deployment changed. All three reviews pass for this test read evidence. The existing
connection is unsuitable for the never-enrolled lifecycle harness; lifecycle and RC acceptance
remain separate. Sanitized evidence: `.private/provider-sdk-rc-20261023/` in this checkout,
especially `mobilepay-gpgtest-sdk-read-result.json`. The SDK remains unpublished.

## MobilePay production RC enrollment and read evidence

Functional review: the owner-selected Admin profile authenticated through the unpublished
SDK with owner-attended MFA. Fresh Admin/Data tenant equality and never-enrolled metadata
were checked before one conditional enrollment. Metadata readback matched the command
revision. The maintained SDK read qualifier passed readiness, direct discovery with
`Certificates: []`, funds/fees listing and two complete downloads (two terminal pages,
275 aggregate bytes). An independent fresh Data session repeated discovery and both
downloads successfully, then logged out. This proves the bounded RC enrollment/read
workflow; it does not establish nonempty transactions or exhaustive historical coverage.

Security/privacy/evidence review: only the already-authorized MobilePay credentials were
enrolled into the selected production account through the exact RC endpoint. Profiles and
provider secrets remain in owner-only private files; the MFA code was submitted from the
hidden native dialog. The one-time enrollment command is retained privately for reconciliation
and prevents blind replay. SDK output contains statuses and aggregate counts, with report
contents held in memory. Both enrollment sessions and the independent read session completed
cleanup. No live API deployment, subscription widening or credential rotation was performed.

Simplicity/scope review: the private adapter reuses SDK authentication, enrollment, metadata
and the maintained read qualifier. Only the selected Admin profile path and use of its own
saved Admin password required adaptation; six synthetic execution checks pass after the
selected-path regression failed first. No SDK runtime, generated contract or application
change was necessary. All three reviews pass for enrollment/read evidence. Real isolated
lifecycle and cross-tenant qualification, owner RC app acceptance and live promotion remain
separate and incomplete. The enrolled connection is retained for owner app testing.

The owner has no production Maventa credentials. Maventa remains unenrolled and its latest
readiness response is subscription denial (403); no Stage credentials were used. It is not
production-qualified. The SDK stays unpublished. Sanitized receipts are retained in the
SDK candidate's `.private/provider-sdk-rc-20261023/enroll-mobilepay-result.json` and
`profile-probe-result.json`; secret-bearing command/profile files must not enter Git.
