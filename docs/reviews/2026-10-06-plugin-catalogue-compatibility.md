# Versioned plugin catalogue SDK integration

The SDK consumes generated Platform API contracts from platform commit
`2a68f543d13d0f537af54d06b59aaff8cf57c396`, including the banking contracts already on main.
Catalogue format selection is optional. Existing callers retain their default request and response;
format 2 exposes per-entry discovery issues. Plugin admission remains the host's responsibility.

Functional review: 233 tests pass in the complete `yarn prepublishOnly` gate, including real HTTP
transport serialization for default, explicit-1 and explicit-2 catalogue requests. The retained
released SDK 4.0.0 and candidate build pass six synthetic old/new server combinations through
`scripts/qualify-plugin-catalogue-compatibility.mjs`. The legacy server refusal is a typed HTTP error;
fallback is an explicit caller decision. Contract synchronization checks all 73 selected operations.

Security and evidence review: authentication still uses the existing transport. Diagnostics are
generated contract data, not permission or package verification. Tests use synthetic responses and
credentials; this evidence establishes neither production deployment nor packaged app acceptance.
The SDK does not add expiry periods, signing exceptions or cached authorization.

Simplicity and drift review: the existing generator produces the new types and source lock; no second
catalogue transport or compatibility engine was added. Formatting, lint, type checks, coverage,
browser compilation and package dry-run all pass. The app still needs the eventual published SDK
successor for its normal dependency installation; its current candidate uses a private local overlay.

Publication is deferred by user instruction. Package metadata stays at the existing released 4.0.0;
this source candidate is not a replacement publication of that version. Release Please owns the next
version and changelog. The repository's existing GitHub Actions workflow performs verification and
trusted npm publishing on a published release or an explicit manual run. No local npm login, release,
tag or publication was performed.
