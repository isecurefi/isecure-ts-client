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
