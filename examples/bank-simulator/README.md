# Bank simulator end-to-end example

This Node.js example uses only generic `WSChannel` operations. The SDK has no simulator-specific
methods or home-directory profile format: the application passes `Bank: "simulator"` and its
configuration explicitly.

It authenticates admin and data modes, enrolls the simulator when needed, lists and uploads an
OpenPGP authorize key, lists and downloads the enrollment's initial `camt.053` when newly enrolled,
signs and uploads the included synthetic `pain.001.001.09`, then polls and downloads the resulting
`pain.002.001.10`, `camt.054.001.02`, and payment-derived `camt.053.001.02` files.

## Existing test user

Set account values outside source control, then run:

```sh
export ISECURE_API_KEY='...'
export ISECURE_COMPANY='Example Synthetic Company'
export ISECURE_NAME='Synthetic User'
export ISECURE_EMAIL='user@example.test'
export ISECURE_PHONE='+358401234567'
export ISECURE_PASSWORD='...'

# Optional. Without these, the example generates a local signing key pair.
export ISECURE_PGP_PUBLIC_KEY_FILE='/absolute/path/to/authorize-public.asc'
export ISECURE_PGP_PRIVATE_KEY_FILE='/absolute/path/to/authorize-private.asc'

yarn example:simulator
```

The example prompts for MFA and verification codes. Automation can instead set
`ISECURE_ADMIN_MFA_CODE`, `ISECURE_DATA_MFA_CODE`, `ISECURE_ADMIN_EMAIL_CODE`,
`ISECURE_DATA_EMAIL_CODE`, `ISECURE_ADMIN_PHONE_CODE`, or `ISECURE_DATA_PHONE_CODE`. Shared
fallbacks such as `ISECURE_MFA_CODE` also work. Do not put codes or credentials in source, Git, or
logs.

The default endpoint is `https://ws-api.test.isecure.fi/v2`. The included RSA test public key and
synthetic payment fixture are used by default. Override them with `ISECURE_BASE_URL`,
`ISECURE_PUBLIC_KEY_PEM_FILE`, and `ISECURE_PAYMENT_FILE`. Downloads go to
`./isecure-simulator-downloads`; override that with `ISECURE_OUTPUT_DIR`.

When PGP key files are not supplied, the example writes a generated pair to the ignored
`.isecure-simulator-pgp` directory with mode-`0600` files and reuses it later. Override the directory
with `ISECURE_PGP_KEY_DIRECTORY`; move the private key into your normal secret store. The deployed
gpgtest API does not currently support deleting an uploaded PGP key.

## First-time registration

Use an invented test identity whose email and phone can receive the API's verification codes. Keep
the same account fields for both modes:

```sh
export ISECURE_REGISTER=1
export ISECURE_COMPANY='Example Synthetic Company'
export ISECURE_NAME='Synthetic User'
export ISECURE_EMAIL='user@example.test'
export ISECURE_PHONE='+358401234567'
export ISECURE_PASSWORD='...'
yarn example:simulator
```

The example registers admin mode with `ApiKey: "0"`, uses the returned API key to register data
mode, and prompts through the SDK's login/verification state machine. It writes the new API key to
the ignored, mode-`0600` `.isecure-simulator-api-key` file without logging the value. Override that
path with `ISECURE_API_KEY_OUTPUT_FILE`, then move the key into your secret store. The example
deliberately does not create a profile file.

For the simulator, the example generates `WsUserId` and `Code` values locally. There is no endpoint
for fetching a WS channel ID or bank PIN. The simulator is synthetic gpgtest infrastructure and
does not execute real payments.
