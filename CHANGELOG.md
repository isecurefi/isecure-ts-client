# Changelog

## Unreleased

- Corrected all 21 Bank Simulation operations to the dedicated `manage_simulation` authority and
  advanced contract versions from the pinned platform release. Their generated SDK metadata now
  preserves the exact public audiences while excluding the private Module transition and agent/MCP
  tools; authentication, entitlement, and authorization enforcement remain server-owned.
- Added the complete generated Bank Simulation control plane to the isolated experimental
  `./iso20022` Processing entry point. The client exposes capabilities, workspaces, scenarios, runs,
  clocks, checkpoints, branches, events, and Artifact references while preserving exact contract
  versions, separate Processing sessions, idempotency, optimistic concurrency, and snapshot
  pagination. It adds no simulator rules, private Module route, retries, AWS access, checkpoint-byte
  access, or changes to the permanent WS Channel/File Exchange API.
- Added an isolated experimental `./iso20022` entry point for the platform's generated balance,
  entry, statement, transaction, validation, payment-capability, and `PaymentOrder` operations. The
  digest-pinned surface carries exact command idempotency/concurrency headers, uses an explicit
  no-retry HTTP adapter with bounded JSON requests and responses, and leaves the existing WS
  Channel/File Exchange API unchanged.
- Extracted WS API endpoint construction into a pure, separately tested `UrlBuilder`, shrinking the `WSChannel` class and making URL behavior unit-testable in isolation.
- Fixed stale-token classification bugs: a lingering access token from the email-verification stage no longer re-triggers email verification, and a prior session's id token/API key no longer misclassifies a refresh (re-login) MFA-stage response as already authenticated. Classification now keys both on the tokens carried by the current response. (The first was surfaced by a new end-to-end onboarding test.)
- Raised the toolchain bar: ESLint now uses `strict-type-checked` + `stylistic-type-checked`, and `tsconfig` adds `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`, and `noUnusedParameters`.
- Added a `STABILITY.md` API-stability/semver policy, a `docs` script (typedoc) for generating API reference docs, and an end-to-end onboarding integration test exercising register → verify email → verify phone → MFA → authenticated through the public SDK only.
- Added session-expiry awareness. The SDK now derives an absolute expiry from the login `ExpiresIn`, exposed via `WSChannel.sessionExpiresAt`, `isAuthenticated()`, and `isSessionExpired()`. Authenticated calls made on an expired session invoke an optional `onSessionExpired` refresh hook (configurable skew via `expirySkewMs`) and re-check afterwards — a hook that fails to refresh throws rather than letting the call proceed with a stale token — or throw a typed `ISecureError` when no hook is configured instead of firing a request doomed to 401. `logout()` still works on an expired session.
- Hardened debug-log redaction. Sensitive-field stripping now also covers PII (email, phone, name), a value heuristic redacts token-like strings (JWTs, long base64, the `base64|timestamp|uuid` challenge) regardless of field name, and request URLs have embedded email addresses and phone numbers masked. A new `"strict"` mode (selectable via `WSChannelOptions.redaction` or `LoggingTransportOptions.redaction`) switches to an allowlist that redacts everything except known-safe fields. Redaction lives in a dedicated, exported `redact` module (`redactValue` / `redactUrl`).
- Split the auth state shapes into `auth-state.ts`, leaving `auth.ts` to own the classification logic (re-exported for a stable `./auth.js` import surface).
- Added a typed error hierarchy (`ISecureError`, `ISecureHttpError`, `ISecureNetworkError`, `ISecureAbortError`, plus `isISecureError`). Non-2xx HTTP responses now throw `ISecureHttpError` carrying the HTTP status, backend `ResponseCode`/`ResponseText`, and the `RequestId` needed for support — instead of leaking raw `AxiosError`s. The `ResponseCode !== "00"` logical-failure path is unchanged (it stays on 2xx and is handled by the auth-state classifier).
- Hardened `AxiosTransport` for production: a default 30s request timeout, bounded exponential-backoff retries with full jitter and `Retry-After` support for transient failures, and `AbortSignal` propagation (including aborting a pending retry backoff). Retries are **idempotency-aware** — non-idempotent methods (anything but `GET`) are only retried on a `429` (rate-limited, not processed), so a file upload or one-time code is never silently replayed; opt in with `retryNonIdempotent`. The constructor still accepts a bare axios instance for backwards compatibility in addition to the new `AxiosTransportOptions`.
- Refactored `classifyAuthResponse` into an explicit, ordered rule table so the precedence between overlapping login signals (verification prompt vs. session/`sms code` MFA heuristic) lives in one reviewable place — the root cause of the original misclassification was an ordering bug in a hand-written if-ladder.
- Collapsed the per-operation request boilerplate into a single private `call()` funnel that centralizes JSON-vs-authenticated header selection and response unwrapping.
- Added a `User-Agent: isecure-ts-client/<version>` header on Node runtimes (skipped in browsers, where it is a forbidden header), plus exported `SDK_VERSION` / `USER_AGENT`.
- Added `parseMode` / `parseLogLevel` (and `isMode` / `isLogLevel`) input guards so untrusted values such as environment variables are validated instead of unchecked-cast.
- Tightened the `classifyErrorReason` "unconfirmed" heuristic to avoid matching unrelated responses that merely contain the word "confirm".

## [2.3.1](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v2.3.0...isecure-ts-client-v2.3.1) (2026-09-03)


### Bug Fixes

* **auth:** explain password challenge length limit ([e191236](https://github.com/isecurefi/isecure-ts-client/commit/e191236d86d418b7ca32350b8cd16ea1096a3c44))
* **auth:** explain password challenge length limit ([6d1830a](https://github.com/isecurefi/isecure-ts-client/commit/6d1830a56a1b5b1598d99969198eb5c3b23a0077))

## [2.3.0](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v2.2.3...isecure-ts-client-v2.3.0) (2026-08-30)


### Features

* **iso20022:** expose authenticated processing event stream ([f3dede6](https://github.com/isecurefi/isecure-ts-client/commit/f3dede6da846a2f59a67478947c30bf99dffcb74))

## [2.2.3](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v2.2.2...isecure-ts-client-v2.2.3) (2026-08-26)


### Bug Fixes

* **example:** bound payment end-to-end identifier ([b23a68c](https://github.com/isecurefi/isecure-ts-client/commit/b23a68c2958c3f87feafdfe3bc801ec67f72940d))

## [2.2.2](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v2.2.1...isecure-ts-client-v2.2.2) (2026-08-25)


### Bug Fixes

* **iso20022:** expose simulation capability reference ([92a679b](https://github.com/isecurefi/isecure-ts-client/commit/92a679b23e88a9b60d5668bd4d4855fd9971d548))

## [2.2.1](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v2.2.0...isecure-ts-client-v2.2.1) (2026-08-23)


### Bug Fixes

* **iso20022:** require bank simulation management authority ([823d410](https://github.com/isecurefi/isecure-ts-client/commit/823d410203edaf34fa75496396774358795b95b9))

## [2.2.0](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v2.1.0...isecure-ts-client-v2.2.0) (2026-08-23)


### Features

* add manual processing payment upload example ([6f50d7e](https://github.com/isecurefi/isecure-ts-client/commit/6f50d7eb37f7365818a6f6101bdf9f9b6514dac2))
* add verified payment export client ([d8634f8](https://github.com/isecurefi/isecure-ts-client/commit/d8634f88d8c41dfec97460291ea94b5e8a4cb9ad))
* **examples:** add Processing simulator journey ([27aa9c1](https://github.com/isecurefi/isecure-ts-client/commit/27aa9c124e656f840f0a882b6b4f5482da6b9b04))
* **iso20022:** add bank simulation control client ([15d592c](https://github.com/isecurefi/isecure-ts-client/commit/15d592c6c57ab23a90854196284b96c757b79c1c))
* **iso20022:** add payment submission client ([b3bd7a9](https://github.com/isecurefi/isecure-ts-client/commit/b3bd7a9384ce0769be6a0b821f669158d3174e08))


### Bug Fixes

* refresh audited build dependencies ([f1e321d](https://github.com/isecurefi/isecure-ts-client/commit/f1e321d262436d849377fc17956f68aa911f5af0))
* repin payment export profile lifecycle contract ([14445b2](https://github.com/isecurefi/isecure-ts-client/commit/14445b2d51c7dc010676b9362c91a0c812167fe3))

## [2.1.0](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v2.0.0...isecure-ts-client-v2.1.0) (2026-08-10)


### Features

* add experimental ISO observation client ([f2a6dc5](https://github.com/isecurefi/isecure-ts-client/commit/f2a6dc591388cee6411f4cc39a062fd0a4a858e6))
* add payment operations to ISO client ([0dc71ec](https://github.com/isecurefi/isecure-ts-client/commit/0dc71ec49386236c2bd4e57945df4eae2c8566ec))
* type effective bank connections ([0273aaa](https://github.com/isecurefi/isecure-ts-client/commit/0273aaa2261ce085e412bb006e585ed8d518ffb6))


### Bug Fixes

* resolve js-yaml audit advisory ([1e594ba](https://github.com/isecurefi/isecure-ts-client/commit/1e594ba5c38195d481061fac78bb072eb572b6a9))

## [2.0.0](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v1.3.2...isecure-ts-client-v2.0.0) (2026-08-05)


### ⚠ BREAKING CHANGES

* Node.js 22 is no longer supported. Consumers must use Node.js 24 or newer.

### Features

* require Node.js 24 or newer ([#39](https://github.com/isecurefi/isecure-ts-client/issues/39)) ([7311e51](https://github.com/isecurefi/isecure-ts-client/commit/7311e51bbdf168cf32f9f300cd692568726cc5bd))

## [1.3.2](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v1.3.1...isecure-ts-client-v1.3.2) (2026-08-05)


### Bug Fixes

* **metadata:** point package to canonical repository ([#37](https://github.com/isecurefi/isecure-ts-client/issues/37)) ([cf52639](https://github.com/isecurefi/isecure-ts-client/commit/cf5263974e3bf1b89eaeecba8ee5bf68d8619ae1))

## [1.3.1](https://github.com/isecurefi/isecure-ts-client/compare/isecure-ts-client-v1.3.0...isecure-ts-client-v1.3.1) (2026-08-05)


### Bug Fixes

* **deps:** refresh dependencies and resolve audit alerts ([#34](https://github.com/isecurefi/isecure-ts-client/issues/34)) ([5ec76e6](https://github.com/isecurefi/isecure-ts-client/commit/5ec76e65a5d48f28c6d81fe2848b26b5a42a3408))

## [1.3.0](https://github.com/dforsber/isecure-ts-client/compare/isecure-ts-client-v1.2.0...isecure-ts-client-v1.3.0) (2026-06-27)


### Features

* **mfa:** add login-time MFA factor selection (SELECT_MFA_TYPE) ([#20](https://github.com/dforsber/isecure-ts-client/issues/20)) ([f6eaa74](https://github.com/dforsber/isecure-ts-client/commit/f6eaa74a12bdb2f9313d5656afafe11ebc60cc63))

## [1.2.0](https://github.com/dforsber/isecure-ts-client/compare/isecure-ts-client-v1.1.0...isecure-ts-client-v1.2.0) (2026-06-23)


### Features

* **totp:** Google Authenticator (TOTP) MFA support ([#18](https://github.com/dforsber/isecure-ts-client/issues/18)) ([5f854ea](https://github.com/dforsber/isecure-ts-client/commit/5f854ea122ac05b4251079036eaaae48b3f1f120))

## [1.1.0](https://github.com/dforsber/isecure-ts-client/compare/isecure-ts-client-v1.0.2...isecure-ts-client-v1.1.0) (2026-06-22)


### Features

* harden SDK auth/verification surface (1.0.2) ([#5](https://github.com/dforsber/isecure-ts-client/issues/5)) ([2bffed2](https://github.com/dforsber/isecure-ts-client/commit/2bffed2739f0a64ab5b41ab09759ac9ca8eb7a94))
* redaction hardening + modularity (3/5) ([#9](https://github.com/dforsber/isecure-ts-client/issues/9)) ([5f2540a](https://github.com/dforsber/isecure-ts-client/commit/5f2540ad4a21b44dff99122840f526b971a5762d))
* resilient transport + typed errors (2/5) ([#8](https://github.com/dforsber/isecure-ts-client/issues/8)) ([352742c](https://github.com/dforsber/isecure-ts-client/commit/352742ce6662b1f66bcedfa6153a8dadb5e94be5))
* session lifecycle + refresh hook (4/5) ([#10](https://github.com/dforsber/isecure-ts-client/issues/10)) ([6cf5b24](https://github.com/dforsber/isecure-ts-client/commit/6cf5b24eb1c053dac9429a48d87b4e4b2d5963e6))
* support browser bundlers ([33d3b89](https://github.com/dforsber/isecure-ts-client/commit/33d3b89333e042060f9bc681a8ab5ec938feeb89))

## 1.0.2

- Fixed `classifyAuthResponse` so explicit `verify phone` / `verify email` prompts are detected before the session/`sms code` MFA heuristic. A verification response that also carries a Cognito session token (or the words "sms code") is no longer misclassified as `needs_mfa`.
- Made the email-verification state self-consistent: `needs_email_verification` is now only returned when a usable access token is present. An email-verification prompt that arrives without an access token resolves to a typed `failed` state (`reason: "missing_access_token"`) instead of a state that `verifyEmail()` would reject.
- Replaced the `loginWithPrompt` "did not settle" exception with a typed `stalled` auth state that names the stuck `step` (`mfa` / `email_verification` / `phone_verification`) and the number of transitions, so callers never re-implement the verify/re-login loop or guess where it stopped. The loop also detects an accepted verification that fails to advance login and stops immediately.
- Added discriminable verification/confirmation error reasons via `AuthErrorReason` on the `failed` state (invalid/expired code, resend required, too many attempts, not/already verified, unconfirmed, missing access token). The mapping is best-effort over `ResponseText` until the backend exposes machine-readable codes.
- Added opt-in, redacted request/response debug logging via a `LoggingTransport` decorator wired to `LogLevel`. Secrets, tokens, and one-time codes are stripped before logging; the default `NoopLogger` keeps the SDK silent unless a logger is injected.
- Pinned the build-time `js-yaml` transitive dependency to `4.2.0` for npm consumers via `overrides` (mirroring the existing yarn `resolutions`) and refreshed `yarn.lock`, keeping `npm audit --audit-level=moderate` clean.

## 1.0.1

- Tightened release automation so semantic releases fail clearly when `RELEASE_PLEASE_TOKEN` is missing.
- Documented the full local quality gate sequence.
- Exported the remaining OpenAPI-derived request and response aliases from the root SDK entrypoint.
- Made auth prompt classification more tolerant of response text wording changes.
- Added browser bundler support by replacing Node-only challenge encryption with WebCrypto-compatible encryption and adding a browser bundle quality gate.

## 1.0.0

- Published the first stable SDK release.
- Covered every operation declared by `wsapi_v2.json`.
- Added OpenAPI contract tests for operation coverage, paths, methods, headers, query parameters, and request body shapes.
- Added GitHub Actions CI, npm provenance publishing, package metadata, and release checks.
- Added typed auth states, prompt adapters, generated OpenAPI types, and focused unit coverage.

## 0.1.0

- Fixed package shape so the declared entrypoint is `dist/index.js`.
- Split library builds from example builds.
- Added OpenAPI-derived TypeScript request and response types from `wsapi_v2.json`.
- Added explicit supported and unsupported operation lists.
- Implemented all operations in `wsapi_v2.json`.
- Replaced terminal-driven auth with typed auth states and a prompt adapter interface.
- Added fake-transport unit tests for SDK usability and request construction.
- Added strict TypeScript and Vitest coverage gates.
- Moved OpenPGP usage to dev/example scope and kept runtime dependencies narrow.
