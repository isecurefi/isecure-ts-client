# Plugin transport source review

Functional: the standalone transport uses generated routes, fields and operation versions, and
resolves the current WS identity for each request. It exposes only catalogue/artifact reads and
requires no Processing session. Existing Processing/hosted Integration transport behavior remains
covered. Seven focused tests cover direct authentication, artifact routing, no retry after refusal,
input refusal, response bounds, timeout and endpoint validation. Full prepublication verification
passed: 348 tests, lint, strict types, formatting, browser bundle and package checks.

Security/privacy: no redirect, cookie, cache or retry path; credentials are validated before sending,
response bytes and request time are bounded, and provider exceptions become fixed safe errors.
Only generated Plugin read operations can carry the token. HTTP errors expose status and structured
body to the integrator; README warns against logging credentials, signed links or response bodies.
The consumer remains responsible for selecting its trusted deployment origin and ignoring late
responses after its account lifetime ends. Existing errors remain compatible with SDK consumers.

Simplicity/drift: share the existing bounded HTTP serialization/parsing rather than duplicating
schema behavior. Helpers are internal-module exports, not new package entry-point API. No generated
wire contracts change. PluginHttpTransport is additive, with a 4.3.0 candidate version; npm publication
and live service evidence are still pending and are not implied by these source checks.
