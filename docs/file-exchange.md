# File Exchange operations and error handling

[Back to the README](../README.md)

## Account Lifecycle (integrator owner)

The integrator API key owner manages its customer accounts from an `admin` mode session.
`retireCert` renames the active certificate of the client's `Bank` so a new enrollment or
import can follow; pass `Account` to act on a customer account under the same API key.
`deleteAccount` is permanent and removes both Cognito users, the account record and every
certificate on it. Audit evidence is retained separately for ten years. The API requires the admin login (with MFA) to be at most 10 minutes old
and rejects older sessions with `Re-authenticate to delete accounts`; the SDK refuses a
confirmation that does not repeat the email exactly before sending anything.

```ts
await client.retireCert({ Account: "customer@example.com" });
await client.deleteAccount("customer@example.com", "customer@example.com");
```

## Audit history

`listAuditEvents()` reads one page of sanitized account-management and certificate renewal evidence, newest first.
An authenticated integrator API-key owner sees its tenant; a customer sees only its own
account. Both admin and data modes can read. The server checks the session and API-key
ownership on every request; the SDK does not grant access based on client-side roles.

WS API 2.15 adds optional `Tenant` for verified superadmins. With `Account` alone, the server
resolves the account's current tenant; deleted accounts require explicit `Tenant`. Integrators
keep access to their own deleted-account history without a lookup. Keep Tenant and Account
unchanged while following NextToken. The server decides operator authority, not the SDK.

Available since WS API 2.11.0 and deployed to production and test as of 2026-09-20.
Use `BaseUrl: "https://ws-api.isecure.fi/v2"` for production or
`BaseUrl: "https://ws-api.test.isecure.fi/v2"` for test.

```ts
import type { ListAuditEventsQuery } from "isecure-ts-client";

const query: ListAuditEventsQuery = {
  // Optional for an integrator; omit to see its whole tenant.
  Account: "customer@example.com",
  Action: "certificate.retire",
  Outcome: "completed",
  Limit: 50,
};
const first = await client.listAuditEvents(query);
// Display first.Events only to the authorized user.
if (first.NextToken) {
  // Fetch the next page on demand, including after an empty page.
  const next = await client.listAuditEvents({ ...query, NextToken: first.NextToken });
  // Display next.Events in the same account context.
}
```

Filters are `Account`, `From`, `To`, `Action`, `Outcome`, `Limit`, and `NextToken`.
`From` and `To` are UTC timestamps. The default window is seven days; the maximum
is 31 days per query, with `From` on or after 2024-01-01. `Limit` is 1–100 (default
100), and a page may contain fewer events. Tokens expire after 24 hours and bind
the caller, tenant, account and filters; keep `Account` unchanged on later pages.
Omitted time/filter values are retained from the cursor.

The method makes one API request and does not fetch further pages automatically.
Responses use `ListAuditEventsResponse` and `AuditEventDescriptor`. Audit evidence
includes actors, affected accounts, actions, outcomes and correlation identifiers;
it excludes SOAP messages, bank-file contents, credentials and private keys.
Delivery is asynchronous. Deduplicate by `eventId` across pages because delivery
retries can repeat events. Integrators can read a deleted customer's retained history.

### Automatic certificate renewal errors (WS API 2.12.0)

Filter `listAuditEvents({ Account: "customer@example.com", Action: "certificate.renew" })`
to read renewal attempts. Events include UTC timestamps, `actorType: "system"`,
`operationId`, and optional `bankResponseCode` / `bankResponseText`. Preserve the code
as a string (including leading zeroes) and render the sanitized message as plain text.
Only `phase: "result", outcome: "completed"` confirms certificate persistence.
A bank rejection uses `rejected`; processing/storage failures use `failed`; a check
that did not need renewal uses `skipped`. A request without a final result is incomplete
evidence. Correlate its events by `operationId` and deduplicate by `eventId` across pages.
WS API 2.12.0 renewal audit fields are deployed to production and test as of 2026-09-20.
They remain optional when no valid bank response is available or its text must be omitted.
Raw bank SOAP, credentials and internal exceptions are never audit fields.

## Account usage

`client.listAccountUsage({ Month: "2026-09" })` reads observed bank-account usage through
the authenticated API. Tenant owners see their tenant and its users; customer accounts
see only themselves. The ISECure operator may pass `Tenant` to select another tenant.
`Account` narrows the result to one permitted user.

The server calculates monthly distinct accounts as the union of daily observations.
Do not sum daily values or user counts to calculate tenant totals. `MissingDays`,
daily `Issues`, and an absent `UniqueAccounts` preserve missing coverage. The basis
covers accounts observed in supported CAMT files, not all contracted or idle accounts.
Payment rows and invoice issuance are outside this operation.

## Errors and Resilience

Logical failures returned by the API as HTTP 200 with `ResponseCode !== "00"` surface through the typed auth/verification states described above. Transport-level failures throw a typed error hierarchy instead of raw `AxiosError`s:

- `ISecureHttpError` — a non-2xx response, exposing `status`, `responseCode`, `responseText`, `requestId` (quote this in support tickets), and the raw `body`.
- `ISecureNetworkError` — a network failure or timeout (`timedOut`, `code`, `cause`).
- `ISecureAbortError` — a request cancelled via `AbortSignal`.

All extend `ISecureError`; use `isISecureError(err)` to narrow.

```ts
import { isISecureError, ISecureHttpError } from "isecure-ts-client";

try {
  await client.listFiles({ Status: "ALL" });
} catch (err) {
  if (err instanceof ISecureHttpError) {
    console.error(`HTTP ${err.status} (RequestId ${err.requestId}): ${err.responseText}`);
  } else if (isISecureError(err)) {
    console.error(err.message);
  }
}
```

The default `AxiosTransport` uses a 30-second timeout and bounded retries with jitter and
`Retry-After` support. It retries transient failures for GET requests. Mutating requests are not
retried for network or server failures unless explicitly enabled; HTTP 429 can be retried.
A request with `retry: false` disables all retries. Tune the transport through `AxiosTransportOptions`:

```ts
const client = new WSChannel(props, {
  transport: new AxiosTransport({ timeoutMs: 10_000, retries: 3 }),
});
```

The transport also honors an `AbortSignal` on each `TransportRequest` (cancelling an in-flight request or a pending retry backoff), which custom transports and integrations can use directly.

## Debug Logging

Logging is opt-in. By default the SDK uses a no-op logger and emits nothing. Inject a `logger` and keep `LogLevel` at `debug` (the default) to get redacted request/response debug lines for every call — secrets, tokens, and one-time codes are stripped before logging:

```ts
const client = new WSChannel(
  { ...props, LogLevel: "debug" },
  {
    logger: {
      debug: (message, meta) => console.debug(message, meta),
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  },
);
```

Set `LogLevel: "silent"` (or omit the logger) to disable transport logging. The redaction lives in `LoggingTransport`, which wraps whatever transport you provide, so a custom transport is logged too.

Redaction strips known secrets and PII (tokens, passwords, codes, email, phone, name), masks token-like values regardless of field name, and removes emails from logged URLs. For low-trust log sinks, pass `redaction: "strict"` (via `WSChannelOptions` or `LoggingTransportOptions`) to redact everything except an allowlist of known-safe fields.

## Company workspace authority

`client.readWorkspaceAuthority(nativeChallenge, { signal })` calls the authenticated
`POST /desktop/workspace-authority` contract. The challenge must be a canonical 32-byte base64url
value generated by the native workspace owner. The request uses the current session and subscription;
it accepts no tenant selector, company, actor or role input. It follows the existing session-refresh
hook and forwards cancellation. This request explicitly disables Axios retries, including rate-limit
retries and transport-wide opt-ins. Custom transports must honor `TransportRequest.retry: false`.

Signed schema v2 includes explicit enrolled company names, external identity and platform registration dates. These facts must stay in protected native storage and must not be logged. The SDK never supplies missing directory facts or migrates legacy evidence.

The response's `Assertion` is opaque signed evidence. The SDK does not decode it, retain it in the
session, cache it or turn it into permissions. The trusted native consumer must verify its signature,
fixed environment trust, schema, session/challenge binding, expiry and enrollment revisions/digest before
using it. At an unchanged company/membership revision pair, `enrollmentDigest` must remain fixed;
the current assignment array may change at scheduled time boundaries. A login/session change while the request is pending requires a new native challenge; the
old response must not be adopted. Both Challenge and Assertion are always redacted from SDK logs,
even if the server returns malformed evidence. Treat native acceptance as a separate result from
successful HTTP transport. The backend route and native onboarding are not yet live-qualified.
