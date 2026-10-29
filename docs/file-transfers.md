# Optional byte-based file helpers

Status: unpublished SDK 4.6.0-rc.1 foundation. No backend deployment or large-file
activation is included. The same SDK package targets Production and Test.

Existing `uploadFile()` / `downloadFile()` signatures, authentication, requests and
response envelopes are unchanged. `Content` still means ordinary Base64 of the
original file. Both methods now disable automatic transport retries: even a bank
GET may change bank status. A timeout can mean the bank already processed the call;
reconcile it before deliberately submitting another operation.

```ts
const support = await client.getFileTransferSupport(); // Metadata only, no bank call.
const result = await client.uploadFileBytes({
  bytes: new Uint8Array([0, 255, 127]),
  FileName: "example.bin",
  FileType: "bank-specific-type",
  Signature: detachedSignatureOverTheseExactBytes,
});
if (result.response.ResponseCode === "00" && result.bytes !== undefined) {
  // Optional immediate upload result, decoded as bytes without interpreting it.
}
const downloaded = await client.downloadFileBytes(fileType, fileReference, {
  signal: abortController.signal,
});
// Check downloaded.response.ResponseCode before using downloaded.bytes.
```

The SDK neither signs uploads nor interprets their contents. Pass the original
signed bytes. It snapshots upload bytes/metadata before awaiting network calls.
It preserves bank refusal codes and acknowledgement-only uploads. The optional
`bytes` result is present only on success with valid inline Content. Unsupported,
malformed, size and session errors use `ISecureTransferError.reason`; transport
errors retain the existing HTTP/network/abort classes. Errors do not attach files
or signatures. Keep response envelopes out of application logs.

## Discovery and compatibility

Discovery reads authenticated `GET /certs`, which does not contact a bank. Its
optional generated `FileTransferCapabilities` array describes per-bank support.
A successful legacy envelope with `Certs` and no advertisement selects
`legacy-inline`. A present empty array means unavailable. Malformed metadata,
unknown versions, failed authentication, missing routes, outages and timeouts
never cause fallback. There is no guessed capability based on URL, environment
name or Lambda runtime. Capability metadata does not grant bank access.

Version 1 advertises `Protocols`, `Encodings`, `Delivery`, `MaxRawUploadBytes`,
`MaxRawDownloadBytes` and `MaxInlineRequestBytes`, scoped by `Bank`.
`inline-v1` explicitly means the existing Files wire format with advertised bounds;
this SDK selects only `identity` + `inline`. `transfer-v1` is reserved for the future
intent/execute protocol. Advertising it alone does not enable it in this SDK. Future backend rollout must
preserve this version-1 bootstrap and `inline-v1` while legacy Files operations
remain supported; richer transfer details belong to the separately versioned
transfer protocol, not extra fields silently added to this closed schema.

| Caller                                     | Current Production / Test without metadata   | Future qualified inline advertisement            |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------ |
| Existing methods                           | Existing wire requests/results; no discovery | Same existing wire requests/results              |
| New helpers, fitting files                 | Legacy inline after authenticated discovery  | Advertised identity inline with server bounds    |
| New helpers, oversized upload              | Local size error before bank contact         | Local size error; no compression/S3 fallback yet |
| Unsupported protocol or malformed metadata | Stop without bank contact                    | Stop without bank contact                        |

Current Rust Test has **no capability advertisement activated by this change**;
it uses the same legacy-compatible path as Production. The advertised path is
qualified with local transport fixtures, not claimed as a hosted feature. Existing
account/PGP APIs retain their separate deployment boundaries.

This foundation reads metadata for each new helper call (no cache or stale
cross-session capability reuse). It checks the base URL, bank, identity, mode,
tokens and session expiry across discovery and completion. A session change after
dispatch cannot undo the bank operation; do not automatically resubmit. Aborting
stops waiting when supported by the transport; it also cannot undo bank processing.
Custom transports must honor `retry: false` and cancellation.

## Explicit limits and unavailable functionality

The inline SDK budget is 6,225,920 serialized UTF-8 JSON bytes: the six-MiB Lambda
ceiling minus a 64-KiB mapping reserve. Upload admission counts Base64 exactly
(`4 * ceil(rawBytes / 3)`) plus escaped filename, file type, signatures and JSON.
Metadata itself is bounded to two MiB. Advertised limits can lower this budget,
never raise it beyond the SDK's inline bound. Binary response decoding is bounded,
requires canonical Base64, and refuses a substituted FilePayload/URL.

These are client-side safety ceilings, **not a guaranteed bank file capacity**.
Existing bank, wire/XML and runtime limits may be smaller; the backend remains
authoritative. Legacy methods retain their existing server-side size handling.
Inline helpers do not promise files larger than six MiB, even if highly compressible.

Compression negotiation/execution, temporary S3 grants and delivery, transfer
status/reconciliation, hashes, progress and download-to-sink are not implemented
in this foundation. No new AWS resource, Gateway compression or response streaming
is enabled. These follow the backend-owned large-file transfer specification and
must be qualified before their capabilities are advertised. An already attempted
bank operation is never repeated merely to select a different representation.

## Source and verification

Backend `aws/ws-channel-api/config.json` and `__wsapi.json.tmpl` own the additive
metadata schema. `yarn sync:transfer-contract` imports only that overlay into the
pinned SDK specification; `yarn check:transfer-contract` checks it against the
sibling backend checkout (or `ISECURE_WSAPI_ROOT`). `yarn generate:types` owns the
TypeScript definitions. Existing upstream and PGP-overlay provenance is retained.

The local gate covers both endpoint fixtures, exact wire compatibility, byte and
JSON boundaries, binary round trips, malformed advertisements/results, bank
refusals, session changes and no replay. Actual hosted qualification and public
SDK/API publication remain separate. Use the unpublished package for integration;
this document does not claim that the candidate is available from npm.
