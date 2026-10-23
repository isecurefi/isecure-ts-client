# Account lifecycle contract review — 23 October 2026

Functional review: generated account and deletion responses expose Lifecycle, DeletedAt,
DeletedBy, PurgeAfter and optional original CreatedAt from the pinned API export. The SDK method
signature stays unchanged; deletion now sends ConfirmSoftDelete to fail safely against an
immediate-deletion backend. The contract regression failed against the previous export and passes
against the new candidate. Documentation separates retirement and deletion into distinct MFA
sessions and labels the backend update unreleased.

Security/privacy review: the backend owns authorization, per-action MFA consumption, account
retention and license exclusion. The SDK neither accepts privilege flags nor performs deletion
itself. All test data is synthetic. The source metadata identifies the exact unpushed API
candidate and its SHA-256.

Simplicity/drift review: regenerate types using the existing generator, retain one SDK transport
and keep backward-compatible optional response fields. No additional endpoint or client-side
license calculation is introduced. Full prepublication validation passes: formatting, lint,
typechecks, all 401 tests, coverage, browser bundling and package dry run. Live gpgtest qualification
passes 23 isolated lifecycle checks and 13 public-key checks, including cleanup. Provider checks
cover metadata, conditional writes and deleted-session denial without upstream credentials.
Nothing was published.
