# Processing SDK documentation review — 13 November 2026

## Scope and evidence

Documentation only, based on SDK release 5.0.2 (`ebe9a60`). The production deployment inspection
from 12 November is retained privately in
`/Volumes/Development/ws-solis-processing-check-20261112/production-deployment.json`.
It records API deployment `07625h`, including the payment-generation routes and excluding
observation, VoP, Processing simulation, hosted Integration and SSE routes. No customer identifiers
or credentials are copied into these documents.

The platform ledger owns historical deployment evidence: `PROCESSING-RETIRE-GPGTEST-001`
records test retirement on 17 October; `PROCESSING-CFN-001` records production generation
qualification and the absent production approval configuration on 27 October. Documentation
separates those dated facts from current tenant acceptance; no new live business test was run.

## Review 1: compatibility and correctness

Checked the quick start and generation call against the published package, and checked session,
error, timeout, size and integrity behavior against the owning transport. Replaced the unavailable
statement-listing quick start with the deployed profile catalogue operation. Corrected the
Processing timeout to 30 seconds, distinct from WS Channel's 70 seconds. Added explicit tenant
onboarding requirements and labelled undeployed interfaces. Historical upload examples no longer
direct readers to the retired test endpoint. Removed the expired example execution date and
replaced invalid free-text Nordea identifiers with the generation fixture's numeric examples.

## Review 2: security, privacy and evidence

Kept ID-token bootstrap and Processing session cleanup explicit. Removed raw result logging from
the quick start. Clarified that generation creates server records, even without an upload, and that
a production trial needs an approved synthetic tenant. Historical upload examples must not be
redirected to production. Kept required signatures, exact revisions, integrity checks, uncertain
command reconciliation and separate bank-upload retry rules visible. Retained the experimental
status and avoided claiming new live qualification from local checks.

## Review 3: structure, reuse and plain English

Reordered the guide around service availability, onboarding, connection, generation and errors.
Replaced the long mixed feature narrative with a short interface table and links to focused
examples. Kept one availability section as the reference for the README, Plugin setup and VoP
example. Kept the independent Simulator and Plugin services distinct from retired Processing test
infrastructure. No runtime, generated contract or example implementation changed.

## Validation

- Both TypeScript snippets in the main guide compile against the downloaded npm 5.0.2 declarations
  with TypeScript strict checking and no emit (dependency declarations use `skipLibCheck`).
- Relative links in every changed guide resolve.
- Prettier checks and `git diff --check` pass.
- No AWS mutation, hosted example, bank operation, deployment or publication was performed.

Local validation artifacts are in `/Volumes/Development/processing-sdk-docs-validation-20261113/`.
