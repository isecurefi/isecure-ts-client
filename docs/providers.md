# Maventa and MobilePay connections

These operations are available on the test API and the separately admitted production
release candidate. Live production provider operations require separate promotion.
The unpublished SDK candidate does not change server availability or grant subscriptions.

`listCerts().Connections` discovers enabled enrollments belonging to the signed-in
account. Maventa and MobilePay use `Access: "direct"` and `Certificates: []`.
Display these connections even when no certificate exists. They are not inherited from
linked accounts. Discovery does not imply readiness or a subscription.

## Read operations

Keep the existing `listFiles` and `downloadFile` methods. Select `Bank: "maventa"`
or `Bank: "mobilepay"` on a dedicated client; avoid changing shared client props during
concurrent requests. `checkProviderConnection(provider)` checks the Data account's
current enrollment, subscription and upstream access, returning `Ready` and `Environment`.
`getProviderConnection(provider)` is Admin-only and returns `Enrolled`, `Environment`
and `Version`, never credentials. Neither method changes `props.Bank`.

| Provider  | Canonical FileType        | Downloaded content                                              |
| --------- | ------------------------- | --------------------------------------------------------------- |
| Maventa   | `MAVENTA_INVOICE_JSON_V1` | Received invoice details JSON; not original XML or attachments. |
| MobilePay | `MOBILEPAY_FUNDS_JSON_V1` | Complete funds report for one ledger date.                      |
| MobilePay | `MOBILEPAY_FEES_JSON_V1`  | Complete fees report for one ledger date.                       |

Omit FileType to list all supported types; do not send literal `ALL` as FileType.
Omitted Status, `ALL` and `DLD` are equivalent. `NEW` is unsupported. Descriptors
use `DLD` as a convention, not download history. Download does not mark a file read.
Uploads and file deletion are unsupported for these providers.

MobilePay listings accept a window suffix such as `MOBILEPAY_FUNDS_JSON_V1_7D`, with
1–31 completed ledger dates. Download with the returned canonical FileType and opaque
FileReference, not the suffixed listing type. The enrolled timezone/cutoff determines
the dates. Downloads do not recompute a relative window. The Base64 Content decodes to
`{ schemaVersion: 1, ledgerId, ledgerDate, topic, pages }`; pages preserve all provider
responses in order. Empty reports still contain a complete provider page. Pending or
incomplete pages fail the whole request. Maventa Content is the exact invoice-details JSON.
Keep financial values unchanged when parsing, and do not log reports or source identities.

## Enrollment, rotation and disable

`MaventaCredentials` contains Environment, CompanyUuid, UserApiKey and VendorApiKey.
The environment must match the deployment: `stage` for test, `production` for RC.
`MobilePayCredentials` uses the production Report API: ClientId, ClientSecret,
LedgerTimezone, LedgerCutoff, optional DefaultLookbackDays (1–31), and either:

- Fixed LedgerId and RecipientHandle, or
- Explicit `LedgerScope: "AllAccessible"` with neither fixed selector.

AllAccessible includes future provider ledger grants. Use it only when the authorized
ISECure account may access every ledger available to those credentials. The SDK does
not infer or widen this scope. Readiness and file reads require the provider's
`file-exchange.read` subscription capability; connection administration requires
`configuration.write` and an Admin session. Server checks remain authoritative.

`updateProviderConnection(provider, credentials, change)` validates upstream access and
replaces the account's encrypted connection. `disableProviderConnection(provider, change)`
removes active credentials, retains a revision and removes the provider from discovery.
Read current metadata first. Pass its unquoted Version as `change.expectedVersion` and
a new lowercase nonzero UUID as `change.idempotencyKey`. A never-enrolled connection uses
`ABSENT_PROVIDER_VERSION`; a disabled connection retains its actual version.

Existing enrollment remains supported:

```ts
import { createProviderEnrollment, type MaventaCredentials } from "isecure-ts-client";

// admin is an authenticated Admin client with Bank: "maventa".
// credentials came from the user's protected input, never a committed fixture.
async function enroll(credentials: MaventaCredentials) {
  const metadata = await admin.getProviderConnection("maventa");
  const change = { expectedVersion: metadata.Version, idempotencyKey: crypto.randomUUID() };
  const request = createProviderEnrollment("maventa", credentials, change, admin.props.Company);
  await admin.enrollCert(request);
}
```

The builder maps CompanyUuid/ClientId to WsUserId and puts the remaining credential
bundle, SchemaVersion, ExpectedVersion and ChangeId in Code. Treat the entire request
as secret. It does not send a request or change the selected bank. Prefer the explicit
connection methods for rotation and disabling; certificate retirement is not provider disable.

Connection PUT/DELETE disable all automatic retries, including 429. After an uncertain
outcome, retain the exact input, expected version and idempotency key for an explicit
retry; do not generate a new key. An exact replay returns the existing revision. A stale
version or changed replay returns HTTP 409: read metadata and reconcile first. The existing
`enrollCert` method retains its general transport policy, including possible 429 retries;
its provider Code bundle stays byte-for-byte identical. Custom transports must respect
`retry: false` on connection writes. Read requests retain bounded transient retries.

HTTP 401 means authentication failed; 403 means access is denied; 404 means the enrolled
connection or file is unavailable; 409 is a version/source conflict; 413 requires reducing
the complete-result scope; 503 means unavailable or incomplete provider results. Invalid
filters return 400. Do not treat those errors as empty results or silently fall back to
another account, provider, stage or API. Exceptions retain typed diagnostics for the caller;
never print raw response data, error causes or report contents. SDK transport error logging
uses a fixed message and does not echo the underlying error message.

## Contract and qualification

`provider-api.json` is a generated companion contract exported from the backend's
`config.json` and `__wsapi.json.tmpl`. `provider-contract.lock.json` pins its SHA-256;
`src/generated/provider-api.ts` is generated by `yarn generate:types`. Run
`yarn check:provider-contract` against the owning checkout (set ISECURE_WSAPI_ROOT when
using a worktree), or `yarn sync:provider-contract` after reviewing an intentional source
change. Do not hand-edit either generated contract. Ordinary package builds use the
vendored contract and do not require a backend checkout.

The [provider qualification harness](../examples/provider-qualification/README.md) has
separate read-only and isolated-fixture lifecycle commands. Synthetic tests qualify SDK
behavior; they do not establish real provider availability or production acceptance.
