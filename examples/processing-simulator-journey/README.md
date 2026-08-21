# Processing payment to Bank Simulator

This runnable Node example proves the current synthetic, bank-channel-independent journey:

1. Two separately authenticated Processing identities select the admitted profile, create and
   validate one payment batch, finalize it, submit it for review and independently approve it.
2. The client releases and integrity-verifies the exact generated `pain.001.001.09` bytes.
3. The local process verifies and signs those exact in-memory bytes with the customer-controlled
   OpenPGP key, then makes one upload through the unchanged ISECure REST `WSChannel` with
   `Bank: "simulator"`.
4. It downloads exact `pain.002.001.10`, `camt.054.001.02` and updated `camt.053.001.02` files,
   correlates their message/payment/transaction identifiers and verifies the exact debtor balance
   transition without floating-point arithmetic.

This is synthetic `gpgtest` evidence, not a real bank, settlement, production-channel or automatic
feedback-reconciliation claim. The example does not add server-side signing, upload orchestration,
retry, simulator-specific SDK methods or unattended execution.

## Run

Set the same account, Processing, payment-profile, debtor, creditor and local OpenPGP variables
listed by the [manual Processing upload example](../processing-manual-upload/README.md). In
particular, the bank and explicit safety acknowledgements must be:

```sh
export ISECURE_BANK='simulator'
export ISECURE_CONFIRM_SIMULATOR_PROFILE_BRIDGE='1'
export ISECURE_CONFIRM_EXPERIMENTAL_PROFILE='1'
export ISECURE_CONFIRM_MANUAL_UPLOAD='I-understand-upload-is-not-idempotent'
export ISECURE_EXAMPLE_RUN_ID='synthetic-processing-simulator-001'
# Use a valid synthetic creditor account distinct from the simulator debtor account so the
# statement demonstrates the exact outbound debit rather than an internal self-transfer.
export ISECURE_CREDITOR_IBAN='FI4516273000000856'

yarn example:processing-simulator
```

The account must already have the qualified simulator connection and a `camt.053.001.02` statement.
Use `yarn example:simulator` for first-time synthetic enrollment if needed. The journey never enrolls
a connection or invents credentials.

## Safe restart and local files

Before calling `uploadFile`, the example writes a mode-`0600` checkpoint under
`.isecure-processing-simulator/`. It contains bounded local correlation and prior-file references,
but no credential, private key, payload, signature or payload-derived hash. If the process stops
after that point, rerunning the same run ID only reconciles authoritative File Exchange reads. It
never uploads again. If exact correlated outputs do not appear before the bound, the result remains
explicitly uncertain.

Verified downloads are written once with mode `0600` under a run-specific directory in
`isecure-processing-simulator-downloads/`. Override the private checkpoint and output roots with
`ISECURE_SIMULATOR_JOURNEY_CHECKPOINT_DIR` and `ISECURE_OUTPUT_DIR`. Keep both outside shared or
backed-up locations unless your local retention and encryption policy explicitly admits them.
Delete a completed checkpoint only as a deliberate local retention action; reusing its run ID after
deletion is unsafe because the upstream upload has no idempotency key.

`release-lock.json` records the exact reviewed Processing and simulator releases this example was
built against. Runtime environment selection remains explicit; the lock is evidence, not an
automatic deployment selector.
