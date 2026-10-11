# Hosted Integration client review — 2026-10-11

Candidate extends SDK main `96e6b77` using generated Platform contracts from
`a573303c21befb39dd87414d5ebb2156b5228860`. This is unpublished source; neither hosted
provider qualification nor application adoption is established by these tests.

## Functional correctness

Compared the 15 exposed operations with the native HTTP delivery dispatch and the generated
client signatures, routes and version requirements. Draft creation uses command metadata;
revision commands use retry plus quoted concurrency metadata; reads carry neither. All five
setup calls preserve the saved session/revision/challenge inputs without creating an implicit
draft. The real transport regression failed before the namespace existed. Focused tests now
cover expiry before dispatch, five HTTP refusal statuses without replay, and explicit
reauthentication retaining the same command identity. The generated fixture suite exercises
all newly selected operations alongside the unchanged ISO client.

Review found the README example omitted the required Processing session exchange. Corrected
it and documented retained-state reconciliation and explicit retry. The example does not claim
automatic login recovery or an application workflow already implemented.

## Security, privacy and evidence

No credentials, logs, deployment calls or provider-specific HTTP were added. Synthetic fixtures
use reserved example hosts and generated test identifiers. Existing Processing transport owns
session admission, bounded serialization, redirect refusal and safe HTTP errors. Generated
contract versions override runtime extra option properties; callers cannot select a different
version through command metadata. Expired sessions send no setup request. Authorization,
conflict and service failures trigger no automatic mutation retries. Publisher credentials
remain outside these request types; the client introduces no authority or credential service.
Response contracts are TypeScript types, not newly claimed runtime schema verification.

## Simplicity, generated drift and compatibility

One existing client namespace and a small version-selection helper reuse the current transport.
There is no second routing table, workflow engine or authentication implementation. The owning
contract generator selects supported operations and their type closure. Existing generated
TypeScript declarations and operations are unchanged; the generated diff adds Integration types
and metadata plus provenance. Catalogue formats remain legacy/1/2, and existing ISO calls remain
covered. SDK public exports include input/output and setup union types. Custom transports must
handle the expanded operation-ID union; STABILITY.md records that adoption requirement.

The first aggregate found test lint errors (an unnecessary assertion, unsafe stringification and
escaped quotes); corrected them without weakening rules. `yarn prepublishOnly` then passed
formatting, lint, typecheck, all 296 tests, coverage, browser bundling and package dry run.
Coverage: 93.51% statements, 88.59% branches, 97.13% functions and 94.30% lines. Generated contract
drift checks pass against the pinned source. Private RED, focused and aggregate receipts use
`Connector-ux-20261010/mobilepay/client-sdk-*`. No npm publication was performed.
