# Combined payment and VoP SDK contract candidate — 7 October 2026

Status: local candidate, not published or qualified against a hosted VoP service. The platform
TASKS.md PAYMENTEXPORT-002 owns completion; its complete journey depends on VOP-004 and final
release admission. This file is review evidence, not another task ledger.

Source: bankfiles-platform `9748dd868b91dca96f2f7584ecedb747c0f94e21`, model 0.132.0.
Retained payment-generation implementation `f4f2428c0f859d61f131b433abb082f937138065` was integrated
onto SDK main `9b88571`, preserving the versioned plugin-catalogue contracts and permanent File
Exchange surface. Generated ISO contracts and fixtures were refreshed by their owning sync command
from committed platform bytes; historical qualification is not inherited by this candidate.

## Functional review

The SDK selects 84 generated operations, including the ten payment-bound VoP v2 operations and
pure generation. Request/review require expected-version and idempotency options; import requires
idempotency only; reads have neither. Typed target/observation/policy bindings and optional bank
validity pass through unchanged. Generated mocks exercise each selected operation's success,
refusal, malformed, replay and stale-version cases through the public HTTP transport. Fifty-three
focused client, transport, parity and generated-mock tests pass. Complete package checks remain
pending; this proves no provider, worker or server policy implementation.

## Evidence, privacy and security review

The wrappers add no bank rules, polling, automatic retries, name corrections, approval, credential
handling or financial authority. Existing bounded XML integrity/no-store checks apply to generation;
protected verification evidence stays behind an explicit operation. Human-only review and fresh
capability/disclosure/evidence authorization are server responsibilities. Documentation distinguishes
candidate contract availability from hosted qualification. Fixtures are synthetic; no bank call or
message is sent. Method success does not synthesize a verified/approved flag.

## Simplicity and generated consistency review

The new methods use the existing typed invocation and metadata helpers. No provider SDK, alternate
payment model, directory assumption or response decoder is introduced. Exact source digests and the
selected-operation inventory remain in the existing lockfile; generated files were not hand-edited.
The merge preserves current catalogue-format stability wording and changes only the obsolete
Processing snapshot pin. Final acceptance must bind to the ultimately qualified platform/SDK pair.

The complete `yarn prepublishOnly` gate now passes on the generated model 0.132.0 snapshot:
formatting, ESLint, TypeScript, 242 tests across 30 files with coverage, browser/package builds and
package dry-run. The first attempt identified a real integration gap: the older platform candidate
omitted the catalogue types already consumed by SDK main. The platform candidate now includes that
existing contract and matching runtime source; no SDK catalogue exports were removed to pass.
The sync owner selects 84 operations from the exact platform revision above. These checks qualify
local SDK packaging only; VOP-004 hosted behavior and bank-connected acceptance remain pending.

After the platform's legacy-result version correction and runtime-evidence refresh, the sync owner
repinned this SDK to `5e865abdfb5d2b15983b4196fcf8a1344562afd3`. The complete package gate passed
again: 242 tests across 30 files, formatting, lint, types, builds and package dry-run. The changed
snapshot contains provenance updates only for this selected operation set; no handwritten wrapper
or generated type was bypassed. Platform aggregate and hosted qualification remain pending.

The current candidate is repinned by the sync owner to platform
`9748dd868b91dca96f2f7584ecedb747c0f94e21`, which closes catalogue record, API-pack and Shared
Authority version obligations. Functional review finds the same 84 selected operations and unchanged
SDK type/operation semantics; this selected snapshot changes only provenance. Security review finds
no permission, disclosure or retry change. Simplicity review retains generated ownership and the
existing wrappers without compatibility shims. The complete package gate passes on this new pin: formatting, lint, TypeScript, 242 tests
across 30 files, browser/package builds and package dry-run. The platform aggregate is running;
these local package checks do not qualify hosted VoP or bank integrations.
