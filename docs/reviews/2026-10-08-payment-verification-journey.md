# Payment verification SDK journey — 8 October 2026

Initial 8 October candidate. PAYMENTEXPORT-002 in bankfiles-platform owns completion. This receipt selects committed
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

## 10 October — combined OP deployment candidate

Merged SDK main `b4db932` into the existing integration branch and synchronized the 84 operations
from committed platform `97dac3be3c3479d4f5b02b322f210fcb09782342`, model 0.138.0. This supersedes
the earlier contract pin; the earlier journey evidence remains historical. Platform aggregate and
deployed SDK acceptance are still pending.

**Pass 1 — correctness.** The generated contract adds the eight explicit verification scenario
outcomes. Operation inventory and the existing payment/verification journey remain intact. The
initial package gate caught the old independent revision assertion; updating that assertion to the
selected committed source resolves it without changing any comparison or operation expectation.

**Pass 2 — evidence and security.** Contract source, generated client, synthetic scenarios and parity
assertion identify the same revision. The imported main changes retain File Exchange signing and
its VoP feedback qualification. No credentials, trust approval, automatic human review or hosted
availability claims are introduced.

**Pass 3 — simplicity and drift.** The existing synchronization command generates the changes; no
handwritten bank contract or new wrapper is added. Its read-only check passes. `yarn prepublishOnly`
passes formatting, ESLint, type checking, all 284 tests in 32 files with coverage, browser build,
package build and package dry-run. This qualifies the SDK candidate locally, not the deployed bank
journey or npm publication.

The source pair advances to platform `5769a16e18583e58d9e607e46638fcda6f32d950` after its
retained File Exchange tool/fixture pin correction. **Correctness:** API types and operation
inventory are unchanged; the SDK source pin and independent parity assertion advance together.
**Evidence/security:** this does not reuse a failed platform aggregate or claim deployment.
**Simplicity/drift:** synchronization and its read-only check pass, followed by the complete SDK
package gate (284 tests). No SDK behavior or permission changes were required.
