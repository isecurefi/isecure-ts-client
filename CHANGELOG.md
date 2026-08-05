# Changelog

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
