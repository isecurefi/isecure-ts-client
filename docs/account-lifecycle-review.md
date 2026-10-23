# Account lifecycle contract review — 23 October 2026

Functional review: generated account and deletion responses expose Lifecycle, DeletedAt,
DeletedBy and PurgeAfter from the pinned API export. Existing SDK methods and HTTP requests
are unchanged. The new contract regression failed against the previous export and passes
against the new candidate. Documentation separates retirement and deletion into distinct MFA
sessions and labels the backend update unreleased.

Security/privacy review: the backend owns authorization, per-action MFA consumption, account
retention and license exclusion. The SDK neither accepts privilege flags nor performs deletion
itself. No privileged operator exception appears in public documentation. All test data is
synthetic. The source metadata identifies the exact unpushed API candidate and its SHA-256.

Simplicity/drift review: regenerate types using the existing generator, retain one SDK transport
and keep backward-compatible optional response fields. No additional endpoint or client-side
license calculation is introduced. Full prepublication validation passes: formatting, lint,
typechecks, all 400 tests, coverage, browser bundling and package dry run. Nothing was published.
