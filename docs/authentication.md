# Registration, login and sessions

[Back to the README](../README.md)

## Configuration

These environment variable names are conventions used by the examples. Pass their values to
`WSChannel`; the SDK does not load them automatically.

| Environment variable     | Required | Description                                                                       |
| ------------------------ | -------- | --------------------------------------------------------------------------------- |
| `ISECURE_BASE_URL`       | No       | API endpoint. Defaults to `https://ws-api.test.isecure.fi/v2` in examples.        |
| `ISECURE_API_KEY`        | No       | Existing integrator API key. Use `0` or omit for initial integrator registration. |
| `ISECURE_COMPANY`        | Yes      | Company name for registration.                                                    |
| `ISECURE_NAME`           | Yes      | Full user name for registration.                                                  |
| `ISECURE_EMAIL`          | Yes      | Account email address.                                                            |
| `ISECURE_PHONE`          | Yes      | Phone number with country code, for example `+358401234567`.                      |
| `ISECURE_PASSWORD`       | Yes      | Registration: at least 20 characters, with A-Z, a-z, 0-9 and a special character. |
| `ISECURE_PUBLIC_KEY_PEM` | Yes      | ISECure RSA public key in PEM format.                                             |
| `ISECURE_MODE`           | No       | `admin` or `data`. Defaults to `data` in examples.                                |
| `ISECURE_BANK`           | No       | Bank identifier. Defaults to `nordea` in examples.                                |

## First Registration

Registration passwords must contain **at least 20 characters**, including an uppercase letter
(`A-Z`), a lowercase letter (`a-z`), a number (`0-9`) and a special character such as `!`, `@`, `#`
or `_`. These are the published [WS API registration requirements](https://www.isecure.fi/wsapi_v2/).
Use a password manager to generate a unique password. Register `admin` first; use `ApiKey: "0"` for
a new integrator. Company, name, email and an international phone number are required; a business
ID is not a registration field. Registration does not automatically grant Bank Simulator access.

`register()` checks the password before fetching a challenge, encrypting it or making any HTTP
request. Invalid passwords throw `ISecurePasswordValidationError`, whose `issues` lists all missing
requirements: `too_short`, `missing_uppercase`, `missing_lowercase`, `missing_number` and/or
`missing_symbol`. Its message and issue codes contain no password. This local error has no
`requestId`, because no request was sent. Existing-account login is not subject to this registration
check. The checks use the documented policy, not a live policy lookup; the server remains the final
authority. RSA encryption also enforces its separate key-dependent maximum UTF-8 byte length.

Forms can call the exported `validateRegistrationPassword(password)` helper before creating a
client. It returns normally when the local checks pass and throws the same typed error otherwise.
Handle errors without logging passwords, encryption payloads or raw response bodies:

```ts
import { ISecureHttpError, ISecurePasswordValidationError } from "isecure-ts-client";

try {
  const registration = await client.register();
  // Retain registration.ApiKey for subsequent client instances.
} catch (error) {
  if (error instanceof ISecurePasswordValidationError) {
    console.error(error.message); // For example: "... Use at least 20 characters."
    // Use error.issues for field hints or translated messages.
  } else if (error instanceof ISecureHttpError) {
    console.error(error.responseText, error.requestId); // Keep RequestId for support.
  } else {
    throw error;
  }
}
```

Admin login and first-time registration may require MFA, email, or phone verification. The SDK returns typed auth states instead of reading from the terminal:

```ts
const state = await client.login();

if (state.status === "needs_mfa") {
  // state.method is "sms" or "totp" (Google Authenticator) so you can label the prompt.
  await client.submitMfaCode("123456");
}

if (state.status === "needs_email_verification") {
  await client.verifyEmail("123456");
}

if (state.status === "needs_phone_verification") {
  await client.verifyPhone("123456");
}
```

### Enrolling Google Authenticator (TOTP)

An existing SMS user can start using Google Authenticator or another TOTP app without
registering again. First finish phone and email verification. Start a fresh admin
login and submit its SMS code with `{ setupTotp: true }`; do not reuse a completed
MFA session. If login offers `needs_mfa_selection`, choose `"sms"` only if it is
included in `state.methods`.

Show the returned `otpauthUri` as a QR code, or use `secret` for manual entry. Scan
it with the authenticator, then confirm a current six-digit code with `verifyTotp`.
Enrollment is complete only when its result is `verification_accepted`. If login
instead requests phone or email verification, finish that step and start a fresh
login before requesting enrollment again.

As verified on 21 September 2026, production makes TOTP preferred for new
enrollments. Test enables both factors without a preference. Both keep SMS enabled;
existing accounts retain their preferences. On subsequent logins, follow
`needs_mfa.method`. Offer a choice only for `needs_mfa_selection`, using
`selectMfaType` and the returned state. Selection applies to that login and does
not change stored preferences.

A direct TOTP challenge cannot be switched to SMS. If the authenticator is lost
and SMS is not offered, contact support. The public API has no MFA-reset or
backup-code endpoint; password reset does not reset MFA. See the live REST
reference's **Initial registration with TOTP**, **Login after TOTP enrollment**,
and **Interrupted enrollment and lost authenticators** sections.

```ts
// Complete login with the SMS code AND ask to set up TOTP in one step:
const state = await client.submitMfaCode(smsCode, { setupTotp: true });

if (state.status === "authenticated" && state.totpEnrollment) {
  const { secret, otpauthUri, accessToken } = state.totpEnrollment;
  // Render otpauthUri as a QR code (or show `secret` for manual entry).
  // accessToken is held in memory only — do not persist it.
  const verification = await client.verifyTotp(accessToken, codeFromAuthenticatorApp);
  if (verification.status !== "verification_accepted") {
    throw new Error("TOTP enrollment was not confirmed");
  }
}
```

For CLI scripts, pass a prompt adapter. `loginWithPrompt` follows the returned authentication states, including fresh MFA after accepted email or phone verification. It stops on repeated verification or the transition limit and returns `stalled`. HTTP and transport errors still throw; handle those separately from returned authentication states.

```ts
const state = await client.loginWithPrompt({
  requestMfaCode: async () => "...",
  requestEmailCode: async () => "...",
  requestPhoneCode: async () => "...",
});

if (state.status === "authenticated") {
  // ready to call authenticated operations
} else if (state.status === "stalled") {
  // an accepted verification did not advance login (e.g. backend did not flip
  // confirmation). `state.step` names the stuck step instead of looping.
  console.error(`Login stalled on ${state.step} after ${state.transitions} steps`);
} else if (state.status === "failed") {
  // `state.reason` is a discriminable AuthErrorReason such as "invalid_code",
  // "expired_code", "too_many_attempts", or "missing_access_token".
  console.error(`Login failed (${state.reason}): ${state.responseText}`);
}
```

Verification helpers (`verifyEmail`, `verifyPhone`) and `classifyVerificationResponse` return the same typed `failed` state with an `AuthErrorReason`, so invalid/expired codes, rate limiting, and already-verified cases are discriminable rather than collapsed into a single error string.

## Session Account

Authenticated `login()` and `submitMfaCode()` states carry the server-decided `Account` object on
`state.response.Account` (`SessionAccount`): `Type` is `operator`, `integrator` or `customer`,
`Entitlements` lists the tenant's active products (absent if the lookup was unavailable), and
`Features` lists per-user preview flags. Use it to choose what to show; the API enforces access on
every operation regardless.

```ts
const state = await client.login();
if (state.status === "authenticated") {
  const { Type, Entitlements = [] } = state.response.Account ?? { Type: "customer" };
  // Use Type and Entitlements to choose which controls to display.
}
```

## Session Lifecycle

The SDK tracks the id-token expiry returned at login. Inspect it with `client.isAuthenticated()`, `client.isSessionExpired()`, and `client.sessionExpiresAt`. When an authenticated call is made on an expired session, the SDK invokes an optional refresh hook so you can re-establish the session in one place instead of handling 401s everywhere:

```ts
const client = new WSChannel(props, {
  expirySkewMs: 30_000, // refresh 30s early
  onSessionExpired: async (channel) => {
    await channel.loginWithPrompt(promptAdapter);
  },
});
```

Without a hook, an authenticated call on an expired session throws `ISecureError` rather than sending a request that would 401. `logout()` always works, even when expired.
