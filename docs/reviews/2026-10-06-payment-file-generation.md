# Payment-file generation client review — 6 October 2026

Platform contract: `0b36f0e050162f6827bf5fa251177fd61a73aeaa`. This review covers local SDK
adoption; it does not establish hosted availability or bank acceptance.

## Pass 1: functional contract

The owner generator supplies operation 74, its exact route, four identifiers and binary response
contract. Both payment names reach the same method; the operation uses the authenticated Processing
session and contract version without mutation/idempotency metadata. The finalized order owns the
explicit submission date. The client neither invents a date nor performs approval or upload.
Focused tests exercise the real HTTP adapter and all generated operation bindings. Review corrected
the inventory count/order and the test's pinned source revision.

## Pass 2: evidence, privacy and security

Generation verifies bounded XML, identity, declared/actual length, SHA-256 and no-store before
returning any bytes. Invalid digest, identifier, length, media type and cache metadata are refused.
The previous approved-download path still rejects missing caller artifact authority before fetch;
its existing substitution and streaming tests remain applicable. Session/contract and entitlement
refusals neither return content nor retry. Review corrected the denial fixture to the generated
issues envelope without weakening the error parser. No credentials, payment values or payloads are
logged or retained by this change.

## Pass 3: simplicity, generated drift and compatibility

One closed two-operation binary reader preserves shared bounds/digest behavior. Generated files
come only from the pinned owner generator, and parity tests check their digests. No client bank
catalog, XML parser, workflow engine or publication step is added. The experimental custom
transport interface gains a required method; STABILITY and the unreleased changelog disclose it.
The permanent File Exchange interface is unchanged. Final package acceptance is recorded below
only after formatting, lint, types, all tests, browser bundling and package dry-run pass.

## Final local package acceptance

`yarn prepublishOnly` passes: formatting, type-aware ESLint, library/example types, all 238 tests
in 30 suites with coverage, browser bundling, package build and npm pack dry-run. The final run also
executes the generated fixture matrix for the new operation. Generated binary success fixtures
remain metadata-only; the HTTP transport cases independently exercise actual bounded XML bytes.
Review corrected the mock operation dispatch, retained URL-typed assertions and fully typed fetch
spies. No lint rule or coverage gate was weakened. Private logs retain earlier failed attempts and
the successful `sdk-generation-package-accepted.log`; no package was published.
