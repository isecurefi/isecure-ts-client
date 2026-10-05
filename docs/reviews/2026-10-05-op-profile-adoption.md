# OP Processing profile contract adoption — 5 October 2026

The experimental ISO 20022 client now consumes 73 operations from platform
`aa51ebf5dfccaecdc75f4a41894f460c7b3ce9d4`. The generated contract lock records the exact client,
OpenAPI and scenario bytes. The permanent File Exchange client is unchanged.

Functional review: both OP ordinary Finland V9 profile IDs pass catalog discovery followed by exact
profile configuration through the public SDK and HTTP transport. Synthetic responses preserve the
server's experimental/available status and the selected profile ID. Configuration retains explicit
OP BIC, account, agreement and customer fields without substituting Nordea identifiers. The contract
parity assertion advances deliberately to the exact imported source revision.

Evidence/privacy/security review: new cases use an injected synthetic HTTP double, invented
identifiers and an isolated Processing session. Both requests retain the API gateway key and use the
Processing token rather than the bootstrap ID token; configuration retains its idempotency key. The
fixture is a transport/contract test, not a live API deployment, OP acceptance or production support
claim. Existing session, XML download-integrity, isolation and error tests remain in the package gate.

Simplicity/generated-drift review: no SDK method, hard-coded runtime bank catalog, bank-rule logic or
parallel API contract was added. The existing synchronizer owns all generated changes. Applications
must discover current release availability through `paymentExportProfiles.list()` and select the
returned exact profile. Bank profile interpretation and final payment validation remain platform
responsibilities.

Validation: exact source-contract check, formatting, ESLint, both TypeScript project checks, all
226 tests across 30 suites, browser bundle, package build and npm pack dry-run pass. Statement/line
coverage is above 92%, branches above 88%, and functions above 96%. No package was published and no
bank or deployed Processing endpoint was contacted. Local-main integration remains coordinated by
the platform task ledger after its complete aggregate and package gates.
