# Independent Simulator administration SDK review

Part of platform `SIMADMIN-CLIENT-001`. This review covers the SDK candidate; application and
live deployment acceptance remain separate.

## Functional correctness and recovery

The twelve configuration methods reuse the existing generated operation projection and contract
versions. The wider ISO 20022 client composes the same methods while retaining its separate reset
and execution methods. Shared header binding preserves generated idempotency and revision rules.
The independent HTTP transport admits only the configuration operations, uses current WS identity,
and performs no Processing session exchange or implicit retry. Response loss, refusal and expired
commands retain their original status/identity; callers own explicit reconciliation and retry.

Focused tests cover direct reads, exact path/pagination encoding, unchanged command body/key/revision
on retry, refusal status propagation and absence of unavailable methods. The existing client tests
still cover all generated method projections. Their namespace assertion now compares sorted keys:
property enumeration order is not an API operation contract.

## Security, privacy and evidence

The transport refuses unsafe endpoints, redirects, invalid credential headers, unsupported operations,
invalid metadata, secret-shaped fields and oversized requests/responses. The login lifetime signal
cancels pending calls and refuses future calls. Tests prove old responses cannot return after account
closure, current credentials are resolved again, and deadlines include authentication and injected
fetches that ignore cancellation. Late authentication cannot start a request after its deadline.
No AWS credential, remote authority rule, customer identifier or token is stored or logged.
An uncertain command may have committed; the README explicitly requires reuse of the original key
and input, with reconciliation before a new attempt after HTTP 410.

## Simplicity, integration and generated drift

The configuration projection was extracted from the existing client rather than copied. One shared
invocation helper supplies generated versions; existing HTTP URL/header/body parsers supply wire
rules. There is no retry engine, credential cache, new dependency, generated edit or schema change.
The scope allowlist is explicit because this service does not implement execution operations.
The old Processing and independent Plugin transports retain their separate behavior.

Validation: six initial tests failed before implementation. Ten new transport tests and existing
client/Plugin tests now pass (21 focused cases). Full `yarn prepublishOnly` passes: formatting,
strict lint/type checks, all 358 tests, enforced coverage, browser build and package dry run.
Private logs: `.private/evidence/simadmin-client-001/`. This is not npm publication, app acceptance,
AWS deployment or a claim of Simulator execution availability.
