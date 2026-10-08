# Payment verification SDK journey — 8 October 2026

Candidate only. PAYMENTEXPORT-002 in bankfiles-platform owns completion. The SDK selects committed
platform `180f5d089e346de330053a1a995012cffff1b2b0` (model 0.137.0), using its existing sync owner.
The platform's later uncommitted runtime work is not covered by this source pin or this receipt.

## Functional review

The new example separates capability discovery and durable request preparation from explicit
submission, bounded snapshot reads, a human's explicit choice, and file generation. It exposes
work state, item matches, observation evidence and server usability separately. It passes the same
immutable order/profile references to generation and re-evaluates the complete target, including
revision digest and submission date, before and after the download. Changed observations, policy,
target, or unusable/indeterminate evidence require another review; download success alone grants
no verification claim. Generation remains independently available without review.

The first actual HTTP-transport journey test found a pre-existing defect: the SDK's deep-object
encoder rejected `target.target` on verification get/explain. Wrapper and generic generated-fixture
tests had omitted that optional target. The sync owner now derives nested scalar paths from closed
OpenAPI objects/tagged choices; the existing encoder recursively emits bracketed query parameters.
Order and imported targets both have public-transport regression coverage. The server remains the
tagged-choice/financial contract validator. No handwritten bank schema was added.

## Evidence, privacy and security review

The updated request removes caller-supplied authorization and consent references, matching the
committed platform contract. Discovery can return unavailable reasons without a fabricated
capability. The example makes no automatic review decision, command retry, provider poll or payment
submission. Authorization refusal propagates even after file download; no bytes are returned then.
Exact requests/idempotency keys must be retained before explicit sends, and uncertain outcomes
require reconciliation. Only a separately authenticated human may review; the server enforces this.
Raw evidence reads remain explicit. Pagination is snapshot-bound and bounded across the entire
collection, and incomplete or repeated-cursor views fail instead of becoming a review surface.
Fixtures are synthetic and no credentials or bank connection are used.

## Simplicity and generated consistency review

The implementation extends the existing sync owner and transport serializer. It does not add a
bank policy engine, grant framework, package export, workflow runtime or generated-file override.
The application example lives with the other examples and consumes generated contracts through the
public SDK. The decoder's current URL/HTTP size bounds and the independent generation integrity
checks remain intact. The lockfile and parity test identify the same committed platform source.

Validation: `yarn prepublishOnly` passes formatting, ESLint, TypeScript (including examples),
263 tests in 31 files, coverage, browser build, package build and package dry-run. Coverage is
93.42% statements, 88.57% branches, 96.97% functions and 94.21% lines. The 21 new journey cases
exercise the real SDK HTTP transport against a deterministic response double, including changed
evidence, revocation, uncertain review, malformed nested parameters and incomplete pages.
They do **not** prove server authorization, database behavior, bank integration or hosted readiness.
The next acceptance gate is this journey through the actual API and generated database permissions,
followed by the final platform/SDK source-pair qualification. No package publication is claimed.
