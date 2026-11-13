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
At this review point the temporary account is registered and awaiting contact confirmation;
no successful hosted generation result is claimed. No service deployment or publication occurred.
