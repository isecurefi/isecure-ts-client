# Explicit authenticated session scope

The application keeps local storage identities separate from server authorization. Hosted draft
creation needs the actual server account scope, which schema-1 Processing sessions do not expose.
This candidate adds explicit schema-2 exchange; server delivery and app adoption remain pending.

## Functional review

The no-argument exchange retains its old headers, response checks and schema-1 return type.
Schema 2 requires the explicit selector header and a matching response with tenant, entity and
actor UUIDs. An older server's schema-1 reply is rejected without guessing scope or retrying.
Both versions keep audience, lifetime, token shape and token-type checks. The metadata getter is
a discriminated union, documented on the experimental transport surface. Existing generated
operation contracts and catalogue formats are unchanged.

The initial new-feature test failed on the old parser. Real transport tests cover legacy exchange,
invalid/missing scope, substituted audience and version, additive metadata and unchanged ordinary
operation authentication. All IDs and responses are synthetic.

## Security, privacy and evidence review

The metadata exposes known routing fields only. It never exposes the Processing token or API key,
never treats IDs as permission and never derives server IDs from the desktop workspace. Additive
response metadata is ignored; scope objects are copied so consumer mutation cannot change internal
session state. Failed exchange and sign-out discard the scope with the credential.

Review reproduced a genuine pre-existing race: a pending exchange could restore a signed-out
session. The RED test resolved unexpectedly after clearProcessingSession. A per-exchange marker
now rejects obsolete work before HTTP dispatch and before credential publication. Tests also prove
that a late old reply cannot overwrite newer scope and that sign-out during bootstrap resolution
sends no HTTP request. This guard is shared by legacy and scoped exchanges. It does not claim to
roll back a server exchange already in progress or retry any operation.

## Simplicity, compatibility and drift review

The existing transport and credential lifetime remain the only owners. One bounded scope parser,
a response-version overload and one in-flight identity marker add no credential store, workflow,
provider SDK, dependency or authorization rule. Explicit version negotiation preserves old callers.
The server candidate uses the same header and response fields, deriving scope from authenticated
admission and the retained session's actor, rather than caller-supplied identifiers.

Test lint findings were corrected without changing rules. Final `yarn prepublishOnly` passes all
321 tests, type checks, formatting, lint, browser bundling and package validation. Coverage is
93.73% statements, 89.44% branches, 97.15% functions and 94.41% lines. Private evidence is retained
under `Connector-ux-20261010/mobilepay/session-scope-sdk-*`, including the sign-out RED/GREEN logs.
This is an unpublished SDK candidate; native endpoint and installed application acceptance are
separate outstanding gates. No production or npm publication is claimed.
