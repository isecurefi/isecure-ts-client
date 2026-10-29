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
the existing byte helpers select only `identity` + `inline`. `transfer-v1` permits
an authenticated detail read; its presence alone never enables encrypted transfer. Backend rollout must
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

## Explicit encrypted capability discovery

```ts
const encrypted = await client.getEncryptedFileTransferSupport("test", {
  signal: abortController.signal,
});
if (encrypted.protocol === "s3-aead-v1") {
  const limit = encrypted.capability.MaxRawUploadBytes;
  // Metadata only: full encrypted upload/download workflow is still being implemented.
}
```

The environment argument checks the response; it does not change `BaseUrl` or select
another account. The SDK first reads the existing authenticated `ListCerts` envelope.
It calls `GET /file-transfers/capabilities/{Bank}` only if that bank's unchanged
version-1 metadata includes `transfer-v1`. Legacy Production needs no new route:
without this explicit marker the new method returns `protocol: "unavailable"`.

The detail response must specify contract version 2 and `s3-aead-v1`, match the bank
and expected environment, and provide a canonical account scope, bounded limits,
allowed encodings/delivery and an HTTPS regional S3 origin. The SDK returns an
immutable snapshot and rejects contradictory limits. Authentication, missing-route,
network and malformed-response failures stop discovery. They never authorize a
plaintext or legacy retry. Session changes during either read also stop discovery.
The existing `getFileTransferSupport()` behavior and legacy byte helpers are unchanged.

No deployed capability is activated by this SDK change. The Web Crypto codec and
shared Rust interoperability vectors are local foundations; successful discovery
alone does not demonstrate an end-to-end large transfer.

## Resumable metadata controls

The unpublished SDK also exposes `openFileTransfer()` and `resumeFileTransfer()`.
They require an authenticated Data session and explicit encrypted capability
advertisement. They do not fall back on current Production. Opening a handle
reads metadata only; creating the transfer is a separate, explicit call:

```ts
const transfer = await client.openFileTransfer(
  {
    Operation: "download",
    Bank: client.props.Bank,
    FileType: "pain.002",
    FileReference: "example-reference",
    AcceptGzip: false,
  },
  { environment: "test" },
);
const savedReference = transfer.reference; // Save before attempting create.
const created = await transfer.create({ signal: abortController.signal });
const current = await transfer.status(); // Does not contact the bank.
// Save transfer.reference again to retain the confirmed TransferId.
```

`create()` reserves the stable random `ClientRequestId` and immutable intent. It
never downloads or uploads a bank file. If its response is lost, restore the
saved reference with `await client.resumeFileTransfer(savedReference)` and
explicitly call `create()` again. The server reconciles the identical logical
request. Do not generate a new ID for that retry. The SDK never performs this
repeat automatically. Once the ID is confirmed, use `status()` to check state.

Resuming checks the current authenticated account scope, environment, bank and
base URL. Each handle also checks its session before and after requests. A changed
or expired session invalidates that handle; resume explicitly in the new session.
The reference has no tokens, keys, grants, signatures or file bytes, but its file
selectors can still contain private information. Store it accordingly, not in logs.

`retire()` cancels a prepared transfer or revokes retained delivery. It cannot undo
bank processing. Neither status nor retirement contacts the bank. `completed`
means a retained bank response exists; check `ResponseCode` separately for the
bank outcome, including bank refusal codes. `uncertain` must never trigger blind
resubmission. Unexpected keys, URLs or file payloads in metadata-only responses
are rejected. These controls are locally fixture-tested; prepare/grant/execute,
encrypted file delivery and hosted qualification remain in progress.

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

Full compression/transfer execution, temporary S3 transport, resumable controls,
original-file integrity verification, progress and download-to-sink remain to be
connected to the encrypted codec and discovery. No new AWS resource, Gateway compression or response streaming
is enabled. These follow the backend-owned large-file transfer specification and
must be qualified before their capabilities are advertised. An already attempted
bank operation is never repeated merely to select a different representation.

## Source and verification

Backend `aws/ws-channel-api/config.json` and `__wsapi.json.tmpl` own the additive
metadata schema. `yarn sync:transfer-contract` imports only that overlay into the
pinned SDK specification; `yarn check:transfer-contract` checks it against the
sibling backend checkout (or `ISECURE_WSAPI_ROOT`). `yarn generate:types` owns the
TypeScript definitions. Existing upstream and PGP-overlay provenance is retained.
The separate `transfer-api.json` export owns the unpublished transfer controls and
crypto-context types; it does not replace the Production snapshot. Use
`yarn sync:encrypted-transfer-contract` / `yarn check:encrypted-transfer-contract`
with the same backend checkout to import/verify it. `transfer-contract.lock.json`
pins its exact bytes. The encryption codec now consumes its generated context type.

The local gate covers both endpoint fixtures, exact wire compatibility, byte and
JSON boundaries, binary round trips, malformed advertisements/results, bank
refusals, session changes and no replay. Actual hosted qualification and public
SDK/API publication remain separate. Use the unpublished package for integration;
this document does not claim that the candidate is available from npm.

## Local compression foundation

An internal representation codec now selects gzip only when it makes the file
smaller, otherwise retaining the original bytes. It checks original size and
SHA-256 before returning decoded bytes and accepts at most 32 MiB. This is local
codec evidence, not a new hosted file limit or an activated byte-helper feature.

The decoder accepts exactly one gzip member. Node 24's native gzip decoder accepts
concatenated members, despite the single-member requirement in the
[Compression Standard](https://compression.spec.whatwg.org/#gzip). The SDK therefore
checks the compressed body with native `deflate-raw`, then runs a bounded native
gzip validation pass for header/data checksums. The second pass retains no output
buffer. Input chunks and output buffers are bounded; errors and cancellation clear
owned temporary buffers where JavaScript permits. This does not promise complete
memory erasure or qualify the full bank-transfer memory budget. Native codecs and
Web Crypto own compression, checksums and hashing; no new dependency is added.

Local Node, Chromium and WebKit tests cover shared encrypted fixtures through
original-byte decoding, 32 MiB compressible/incompressible files and extra members.
Node tests additionally cover corrupt headers/checksums, truncation, expansion and
cancellation. The actual macOS app WebView, encrypted S3 transport and hosted
workflow still require qualification.

## Encrypted upload preparation

For a created S3 upload whose intent already contains the original byte count and
SHA-256, `await transfer.prepareUpload(originalBytes, { signal })` now prepares and
encrypts the file in memory. It returns encoding, sizes and fingerprints only.
Preparation does not upload to S3 or execute a bank operation. Use the separate
`uploadPrepared` step below for storage; bank execution remains in progress.

Preparation freezes the SHA-256 of the **exact encoded bytes** before the API releases
a key. This is separate from the original-file hash and the ciphertext hash.
Two valid gzip files can contain the same original bytes and have the same length
while differing in headers or compression output. Their encoded hashes differ,
so the server refuses to reuse a prepared key for the second representation.

The SDK checks account, environment, transfer, purpose, lengths, hashes and canonical
key/nonce encodings before encrypting. A repeated call with identical original bytes
reuses the retained representation or ciphertext. A lost preparation response is not
retried automatically; an explicit repeat uses the same frozen request. After losing
local state, reconstruction must match the server's encoded fingerprint or fail.
There is no unsafe fallback based on matching size alone.

Keys are not returned to callers or stored in the resumable reference. The handle
keeps only the pending encoded bytes, then replaces them with encrypted bytes.
`transfer.discardUpload()` releases these local buffers when no control call is in
progress; it does not cancel the remote transfer. Retiring a transfer also clears
its local upload buffers. JavaScript cannot guarantee erasure of every runtime copy.
This remains unpublished and locally qualified; capabilities are not activated.

## Uploading the encrypted object

After preparation, `await transfer.uploadPrepared({ signal })` obtains a short-lived
grant and sends the retained ciphertext to the advertised S3 origin. It returns
`VersionId`, `CiphertextSha256` and `ObjectBytes`. The API call uses the existing
session; the separate S3 request carries no API credentials, cookies or referrer and
does not follow redirects. Neither call automatically retries. The SDK validates
the grant, ciphertext checksum and returned version; it ignores the S3 XML body.

A repeated successful call on the same handle returns the saved version without
another upload. If the upload acknowledgement is lost or invalid, the handle reports
`storage-uncertain` and refuses another POST. Do not create a new handle to work around
that result. Server-side storage reconciliation and durable resume of an uploaded
version are still being implemented; this is not yet a complete recovery workflow.
Cancellation after dispatch can also leave an object stored. It never authorizes
bank execution. The storage request has a deadline of at most two minutes, further
bounded by grant expiry. Current upload feedback is completion only; incremental
progress, execution and retained download delivery remain in progress.

These helpers have local Node/browser tests using synthetic storage responses. They
do not establish hosted S3 CORS, actual app WebView or end-to-end bank support.
