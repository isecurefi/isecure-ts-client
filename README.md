# ISECure TypeScript SDK

Exchange bank files through the ISECure WS Channel API, browse the plugin catalogue, and manage
Bank Simulator workspaces and scenarios. Each service checks the signed-in account's access.

[API reference](https://www.isecure.fi/wsapi_v2/) · [Examples](examples/) ·
[Changelog](CHANGELOG.md) · [API stability](STABILITY.md)

## Install

Requires Node.js 24 or later. Modern browser bundlers are also supported; see [Runtime support](#runtime-support).

```sh
npm install isecure-ts-client
```

## Choose a client

| Service                  | Client                                            | Import                       | Access required                                        |
| ------------------------ | ------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Bank file exchange       | `WSChannel`                                       | `isecure-ts-client`          | WS account and bank enrollment                         |
| Simulator administration | `createSimulationAdminClient`                     | `isecure-ts-client/iso20022` | Separate administration subscription and manager grant |
| Plugin catalogue         | `createPlatformClient` with `PluginHttpTransport` | `isecure-ts-client/platform` | Catalogue subscription and applicable grants           |
| Experimental Processing  | `createIso20022Client`                            | `isecure-ts-client/iso20022` | Separate deployment and Processing access              |

The `iso20022` entry point is experimental. A method being present in the SDK does not grant access
or mean that its service is deployed. See [API stability](STABILITY.md).

## Quick start: list bank files

For an existing account, supply its API key, password and the ISECure RSA public key for the chosen
environment. The environment variables below are examples; pass their values to the constructor.

```ts
import { WSChannel } from "isecure-ts-client";

const client = new WSChannel({
  ApiKey: process.env.ISECURE_API_KEY!,
  Company: "Example Company",
  Name: "Example User",
  Email: "user@example.test",
  Phone: "+358401234567",
  Password: process.env.ISECURE_PASSWORD!,
  PublicKey: process.env.ISECURE_PUBLIC_KEY_PEM!,
  BaseUrl: "https://ws-api.test.isecure.fi/v2",
  Mode: "data",
  Bank: "simulator", // Requires separate File Exchange Simulator enrollment.
});

const state = await client.login();
if (state.status === "authenticated") {
  const files = await client.listFiles({ Status: "ALL" });
  // Handle files.FileDescriptors in your application; avoid logging customer data.
} else {
  // Ask the user to complete the returned MFA or verification step, or show the failure.
  // See the authentication guide for the supported states and prompt adapter.
}
```

| Environment | File Exchange base URL              |
| ----------- | ----------------------------------- |
| Test        | `https://ws-api.test.isecure.fi/v2` |
| Production  | `https://ws-api.isecure.fi/v2`      |

For registration, certificate enrollment, signing, upload and download, follow the
[File Exchange Simulator example](examples/bank-simulator/README.md).

## Immediate UploadFile results

`uploadFile()` returns `UploadFileResponse`. Some bank services return a result in
its optional Base64 `Content` field during the upload itself. For example, OP's
XML realtime balance query uploads `camt.060.001.02` with reporting request ID
`SALDOKYSELY` and returns `camt.052.001.02` inline. Sign and submit the exact request
bytes through the existing upload interface, then check `ResponseCode` before
reading `Content`. An inline result need not appear in `listFiles()`.

```ts
const result = await client.uploadFile(signedRequest);
if (result.ResponseCode === "00" && result.Content !== undefined) {
  // Decode Base64 using your application's byte decoder; interpret by bank/service.
  const encodedBankResult: string = result.Content;
}
```

The SDK preserves the response as received. It does not infer balance values,
automatically download another file, or assume every bank uses the same query flow.
Acknowledgement-only uploads continue to work without `Content`.

## Optional byte-based file helpers (unpublished)

The 4.6.0-rc.1 candidate adds `getFileTransferSupport()`, `uploadFileBytes()` and
`downloadFileBytes()`. Existing calls retain their wire format. Both bank upload
and download now disable automatic retries to avoid repeating an uncertain bank
operation. The new helpers use authenticated metadata to select legacy or
advertised identity inline support. They do not switch to compression or S3.
`getEncryptedFileTransferSupport("test")` adds strict, authenticated encrypted-protocol
discovery without probing new routes on legacy servers. Optional `openFileTransfer()` /
`resumeFileTransfer()` handles add explicit create/status/retire controls and stable
request IDs. The handle also exposes explicit execute, encrypted upload, retained
download and verified-sink methods; only execute can contact the bank. This workflow
has passed local SDK/native Rust round trips through ordinary simulator HTTPS.
Bounded Test checks also passed encrypted upload, retained download and retirement.
Exact deployment evidence is tracked in the backend TASKS.md; Production continues
to use the existing Files methods. See
[supported behavior and limits](docs/file-transfers.md).

## Register and sign in

Register an `admin` account first. Use `ApiKey: "0"` for a new integrator, then retain the returned
API key securely. Registration requires company, name, email and an international phone number;
a business ID is not required.

Passwords must have **at least 20 characters**, including uppercase and lowercase letters, a number
and a special character. `register()` checks this before sending a request. Forms can use
`validateRegistrationPassword()` and handle `ISecurePasswordValidationError.issues` for field hints.
Existing-account login is not subject to this registration check.

Login may require MFA, email or phone verification. Follow the returned state; do not repeat login
in an unbounded loop. See [Registration, login and sessions](docs/authentication.md) for TOTP,
CLI prompts and session renewal. Registration alone grants neither Simulator enrollment.

## Holvi SFTP connection (unpublished)

Holvi is the bank `holvi`. The existing file methods (`listFiles`, `downloadFile`,
`uploadFile`, `deleteFile`) work unchanged with `Bank: "holvi"`; `FileType` is Holvi's format
identifier such as `camt.053.001.02` or `pain.001.001.03`. An Admin session manages the SFTP
connection; the server generates the key and returns only its public half:

```ts
import { ABSENT_HOLVI_VERSION } from "isecure-ts-client";

const connection = await admin.enrollHolviConnection("ab12345.01", ABSENT_HOLVI_VERSION);
// Send connection.PublicKey and the connection.SourceAddresses (for Holvi's IP allow-list)
// to Holvi, then confirm Holvi accepts the key. listCerts().SftpKeys also lists the key
// (Type "sftp-public-key", Created; SSH keys have no expiry) if the response is lost.
const check = await admin.checkHolviConnection(); // ResponseCode "30" until Holvi registers it
await admin.disableHolviConnection((await admin.getHolviConnection()).Version);
```

Changes require the current `Version` and are never replayed automatically. The routes are
available only after the separately authorized `holvi` deployment.

## Bank Simulator administration

Manage workspaces, scenarios and synthetic runs with `createSimulationAdminClient` and
`SimulationAdminHttpTransport`. They use the existing WS login directly, without a Processing session.

**The two Simulator enrollments are separate:**

- **File Exchange Simulator** (`bank-simulator`): exchange files with the `simulator` bank.
- **Simulator administration** (`bank-simulation`): manage configuration, with an additional explicit manager grant.

Neither enrollment grants the other. The administration client supports twelve configuration
operations; it does **not** execute runs, reset state or retrieve simulation outputs.

See the [administration guide](docs/simulator-administration.md) for a code example, test and
production URLs, cancellation and safe command retries.

## Plugins and Processing

Use `PluginHttpTransport` to list permitted plugins and request signed download links with the
current WS login. See the [Plugin API guide](docs/plugins.md). Catalogue access does not grant
permission to every plugin.

The [experimental Processing guide](docs/processing.md) covers payment generation, observations
and hosted workflows. These require a separately deployed Processing service. The independent
Plugin and Simulator administration APIs do not require that service.

## Errors and retries

WS Channel exposes `ISecureHttpError`, `ISecureNetworkError` and `ISecureAbortError`. For HTTP
failures, retain `requestId` for support. Do not log credentials, raw response bodies or bank files.
Logging is off unless you supply a logger.

Retry behavior differs by transport: WS Channel has bounded retries, while Plugin and Simulator
administration transports never retry automatically. After an uncertain administration command,
keep its original input, idempotency key and expected revision for an explicit retry.

See [File Exchange operations and error handling](docs/file-exchange.md) for error types, retry
settings, audit history, account usage and account management.

## Runtime support

Browser runtimes need WebCrypto (`globalThis.crypto.subtle`) and an API endpoint that permits their
origin through CORS. Keep credentials on your backend for customer-facing web applications unless
you have a suitable trusted browser design.

## Contributing

See [Development and releases](docs/development.md) for setup, checks, generated contracts and the
Release Please publishing workflow. Examples and guides live in this repository; the npm package
contains the SDK, README, changelog, stability policy and license.

[MIT license](LICENSE)

Maventa and MobilePay credential connections use the existing File Exchange methods plus
typed readiness and configuration operations. See [provider connections](docs/providers.md)
for test/RC availability, certificate-free discovery and revision/retry rules.

`listAccounts()` exposes optional `CreatedAt` with the original registration instant in UTC.
Adding Admin or Data sign-in preserves it. Legacy accounts without recorded creation time omit
this field; display an unknown date instead of inferring one from login or deletion metadata.

### Rust candidate account administration (unpublished)

The local candidate contract adds `configurePgpPolicy`, `lockPgpPolicy`,
`deletePgpKey` (full primary fingerprint), and `requestActionMfa` (SMS dispatch).
These operations require a supporting Test deployment; their
presence in this SDK does not imply production availability. `uploadPgpKey` accepts
an optional reviewed policy revision. `retireCert(query, factor)` and
`deleteAccount(email, confirmation, factor)` accept an explicit fresh factor with
`AccessToken`, `MfaType` and `Code`. Use the opaque action credential returned by
completed Admin login. TOTP codes come from the established authenticator; SMS
requires `requestActionMfa` first. These mutations explicitly disable transport
retries, including opt-in retries. Read back state after an uncertain outcome.

Older method signatures remain available for older deployments. A normal login is
not a replacement for a fresh factor on the Rust candidate. Locking is irreversible
through the API. `Account.PgpAuthorization` is descriptive server state, not client
permission. Missing policy and malformed/unavailable policy are distinct.
`wsapi_v2.source.json` records the public upstream and the unpublished candidate
contract overlay; neither SDK nor API documentation has been published by this change.
