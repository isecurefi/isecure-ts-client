# Processing approval to manual ISECure upload

This Node example creates one payment batch through the hosted Processing API, validates and
finalizes it, obtains a decision from a separately authenticated approver, releases and
integrity-verifies the exact generated `pain.001.001.09`, signs those exact in-memory bytes with an
OpenPGP authorize key, and uploads them once through the unchanged ISECure REST `WSChannel`.

This is a manual bridge, not `payment_orders.execute`. It does not retry an upload, reconcile an
uncertain response, retrieve feedback, prove bank acceptance, or qualify a production bank/profile.
The downloaded XML is never written to disk or re-rendered. After an upload begins, do not rerun the
example until an authorized operator has reconciled an uncertain result with ISECure and the bank.

## Required configuration

Use two separately authenticated ISECure modes. Processing authority is server-owned: the WS
`admin`/`data` mode names do not themselves grant approval. The defaults match the synthetic gpgtest
assignment (`admin` submits and `data` approves); deployments can swap them, but they cannot be the
same identity.

```sh
export ISECURE_PROCESSING_BASE_URL='https://.../gpgtest'
export ISECURE_PROCESSING_AUDIENCE='isecure-processing-gpgtest-v1'
export ISECURE_PROCESSING_SUBMITTER_MODE='admin'
export ISECURE_PROCESSING_APPROVER_MODE='data'

export ISECURE_BASE_URL='https://ws-api.test.isecure.fi/v2'
export ISECURE_BANK='simulator'
# Required only when intentionally sending a bank-profile payload to the synthetic simulator route.
export ISECURE_CONFIRM_SIMULATOR_PROFILE_BRIDGE='1'
export ISECURE_API_KEY='...'
export ISECURE_COMPANY='Invented Test Company'
export ISECURE_NAME='Invented Test User'
export ISECURE_ADMIN_EMAIL='admin-user@example.test'
export ISECURE_DATA_EMAIL='approver-user@example.test'
export ISECURE_PHONE='+358401234567'
export ISECURE_ADMIN_PASSWORD='...'
export ISECURE_DATA_PASSWORD='...'
# Optional when the Processing approver is not Admin's paired ISECure Data identity.
export ISECURE_UPLOAD_DATA_EMAIL='admin-user@example.test'
export ISECURE_UPLOAD_DATA_PASSWORD='...'
export ISECURE_PUBLIC_KEY_PEM_FILE='/absolute/path/to/ws-api-rsa-public.pem'

export ISECURE_PGP_PUBLIC_KEY_FILE='/absolute/path/to/authorize-public.asc'
export ISECURE_PGP_PRIVATE_KEY_FILE='/absolute/path/to/authorize-private.asc'
# Required only for an encrypted private key. Resolve it from a secret store in real use.
export ISECURE_PGP_PRIVATE_KEY_PASSPHRASE='...'

export ISECURE_EXAMPLE_RUN_ID='synthetic-run-001'
export ISECURE_BANK_PROFILE_ID='nordea-ca-v9-finland-sepa-unstructured'
export ISECURE_DEBTOR_IBAN='FI2112345600000785'
export ISECURE_DEBTOR_COUNTRY='FI'
export ISECURE_DEBTOR_AGENT_BIC='NDEAFIHH'
export ISECURE_DEBTOR_NAME='Invented Debtor Oy'
export ISECURE_DEBTOR_BANK_AGREEMENT_ID='invented-agreement'
export ISECURE_INITIATING_PARTY_NAME='Invented Initiating Party Oy'
export ISECURE_INITIATING_PARTY_CUSTOMER_ID='invented-customer-id'

export ISECURE_PAYMENT_AMOUNT='12.34'
export ISECURE_CREDITOR_NAME='Invented Creditor Oy'
export ISECURE_CREDITOR_IBAN='FI2112345600000785'
export ISECURE_CREDITOR_COUNTRY='FI'
export ISECURE_CREDITOR_TOWN='Helsinki'
export ISECURE_CREDITOR_ADDRESS_LINE='Synthetic Street 1'
export ISECURE_CREDITOR_AGENT_BIC='NDEAFIHH'
export ISECURE_REMITTANCE_TEXT='Synthetic invoice 1'
export ISECURE_APPROVAL_REASON_CODE='manual_example_approval'

# gpgtest currently publishes experimental profiles. This is never a production claim.
export ISECURE_CONFIRM_EXPERIMENTAL_PROFILE='1'
export ISECURE_CONFIRM_MANUAL_UPLOAD='I-understand-upload-is-not-idempotent'

yarn example:processing-upload
```

MFA and verification codes are prompted interactively or read from the existing mode-specific
`ISECURE_ADMIN_*` and `ISECURE_DATA_*` variables described by the simulator example. Keep all
credentials, codes and key material outside Git and ordinary logs. Reuse the same run ID only for
an individually verified Processing retry; do not restart the whole multi-step workflow after it may
have advanced. It is not an ISECure upload idempotency key.
The uploader variables fall back to the Data approver credentials when they are omitted. Common
`ISECURE_EMAIL` and `ISECURE_PASSWORD` remain an explicit fallback when both modes intentionally
share them.
