# Provider SDK qualification

This maintained harness exercises the SDK on the test API or the explicitly admitted
production RC endpoint. It refuses live production URLs, bank file operations, provider
uploads, account registration, redirects and unrelated account login paths. Requests use
zero automatic retries. Nothing is enrolled merely by running the read command.

```sh
yarn test:providers:read /absolute/private/config.json
yarn test:providers:lifecycle /absolute/private/config.json
```

Configuration and credential files must be owner-only regular files (0600), outside Git.
Only file paths belong on the command line. Never put credentials, identifiers or responses
in test fixtures, shell commands, output logs or source. stdout contains only provider,
mode, result and aggregate byte/page/download counts. Errors are fixed text; report bytes
stay in memory. Authentication uses the shared MFA prompt adapter; accounts must already
be registered and verified. No account or subscription is created by the harness.

The private configuration has schemaVersion 1, provider (`maventa` or `mobilepay`),
baseUrl, and `data`. Each account object contains Company, Name, Password, Email, Phone
and PublicKey as required by WSChannel. The harness supplies Bank, Mode and BaseUrl.
The admitted URLs are the branded test API, its direct gpgtest URL and the exact direct
production RC URL in `policy.ts`. An operator must select the intended target explicitly.

Read mode verifies readiness, certificate-free direct discovery, listing and at least
one actual download of every required type. Maventa needs a received invoice; an empty
mailbox fails qualification. MobilePay requires funds and fees, canonical Base64, valid
JSON, matching ledger dates and a complete terminal page. It selects from seven completed
ledger dates. This is bounded workflow evidence, not exhaustive historical reconciliation.

Lifecycle mode additionally requires `allowFixtureMutation: true`, `admin` for the same
account as data, `foreignData` in a different tenant with an active provider read subscription and no enrolled connection,
and `deniedData` in a third tenant without the provider subscription. Confirm both grants
through guarded operator readback before running; denial fixtures are tenant-scoped.
Foreign-file isolation requires 404 after subscription access, not an earlier 403 denial. Use separately authorized synthetic
accounts, never a customer's existing connection. Both initial and replacement credentials
must be authorized for the selected fixture. Supply `credentialsFile` and
`rotatedCredentialsFile`, each containing the typed connection request documented in
[providers.md](../../docs/providers.md). A same-credential replacement verifies the API
rotation/version workflow; it does not prove provider-side secret rotation.

The initial connection must never have been enrolled (zero version). The test covers
compatible enrollment, readiness, discovery, download, authenticated foreign-reference
and subscription denial, credential replacement, exact replay, stale-revision conflict
and disable. It tries to disable only revisions created by that invocation, including
after an intermediate failure. It refuses cleanup if another operator changed the version.
Failures require protected operator inspection before retrying. Disabling retains a
revision, so a later lifecycle run needs a fresh explicitly authorized fixture; do not
reset retained evidence. Suspend fixture entitlements through the guarded operator tool
after qualification. That subscription cleanup is separate from this SDK harness.

All real-provider runs require prior account and credential authorization. Passing
synthetic unit tests does not mark real RC qualification complete, publish the SDK,
promote production or authorize a wider credential scope.
