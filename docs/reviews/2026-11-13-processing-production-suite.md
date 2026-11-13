# Processing production suite review — 13 November 2026

The owner authorized updating the existing live suite and exercising production with a
temporary account. The new explicit production mode uses the existing SDK, generation
example and authentication helper. It does not deploy a service or send files to banks.

## Review 1: compatibility and correctness

The previous test-only CLI and its simulator checks retain their endpoint restrictions.
Production selects the current standard generation path rather than attempting the old
approval/release/upload workflow. The generation helper is split at finalization; its
existing exported generation function still returns the same integrity-checked bytes.
The suite checks replay identity, repeatable XML, exact synthetic fields, stale revisions,
readback and cancellation, and stops on the first failure. It does not claim all-bank or
all-operation coverage. Current deployment metadata is recorded separately from source tests.

## Review 2: security, privacy and retained evidence

An explicit hostname/method/route allowlist rejects bank submission, execution, approval
and redirects before sending requests. Calls have a hard count and timeout, with no
automatic replay. Private fixture files require restrictive permissions. Reports project
only allowed release fields, fixed check names, HTTP statuses and safe request IDs; no
tokens, XML or response bodies are copied. Review added progress persistence before each
check so an interruption leaves a visible running stage and cleanup obligation.
Production grants are temporary, teardown preserves independent audit history, and
successful checks alone never mean cleanup is complete.

## Review 3: architecture and simplicity

Reuse the existing live-suite CLI, generated operation paths, transport integrity checks,
payment-generation implementation and account/tenant operator commands. No new test
framework, business endpoint, persistence layer, simulator dependency or hosted generated
test loop is introduced. The README explicitly marks the old test deployment as retired.
The general generation example's misleading claim that no data is stored was corrected:
Processing retains drafts/revisions, while generation submits nothing to a bank.

## Evidence

Final local checks: 720 SDK tests passed, including 11 production-boundary tests; full lint
and example compilation passed. A failure-path test caught a missing allowlist entry for
the read-only Gateway probe; the entry was corrected before any hosted suite request.
Additional final checks and hosted outcomes are recorded in the private run directory:
`/Volumes/Development/processing-production-suite-evidence-20261113/`.
Hosted acceptance completed on 13 November, 22:59:34–23:00:05 Finnish time: all 13
checks passed over 20 Processing HTTP requests. The tested API source was
`f20c19c529185efb6fb88b7f108d411ee9afeece`, Gateway deployment `07625h`; the suite
implementation was `33c3f4b`. Final readback confirmed both API release identities
unchanged. No service deployment, publication or bank submission occurred.

The first attempt passed generation and revision checks, then exposed a wrong test
expectation: an unknown order returns 403 from the tenant/ownership resolver, not 404.
Verified against `resolve_operation_legal_entity` and `one_uuid` at the exact deployed
source; corrected the test rather than changing the service. The final run additionally
passed finalized-state readback and cancellation of a separate draft. This confirms
one Nordea unstructured profile, not all bank profiles or all 27 published operations.

The initial operator onboarding call returned 503 after approximately five seconds;
RDS recorded resume initiation at the same time. Onboarding then succeeded. After a
later idle interval, the ordinary Processing session completed successfully in
23.768 seconds to response headers; all other requests in the passing run were below
one second. The short operator connection window is an observed follow-up concern,
not a payment-generation failure or a reason to retry mutations automatically.

The owner subsequently authorized autonomous administrative fixture authentication.
The existing bootstrap pattern briefly disabled this synthetic account's SMS factor
to associate and verify TOTP, then enabled both SMS and TOTP before ordinary SDK login.
No pool-wide setting or customer identity changed. The final login required and passed
TOTP. Raw Cognito tokens stayed in memory; local password/TOTP files were removed after
cleanup. This is fixture preparation, not evidence that MFA can be administratively
approved through the public API.

Cleanup was verified: entitlement suspended, Processing sessions revoked, Processing
usage-plan association removed, and a fresh session exchange refused with 403. Since
the fixture was a root owner, its customer API intentionally forbids self-deletion.
Owner-authorized operator teardown removed the exact Cognito identity, API key and
private usage plan; the disabled users-table tombstone retains the normal 30-day TTL.
Independent audit history and the inaccessible synthetic Processing database remain.
The final combined receipt is `qualification-summary.json` in the private evidence
directory. No successful all-route, cross-tenant or real-bank qualification is implied.
