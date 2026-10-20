# Plugin catalogue and hosted integrations

[Back to the README](../README.md)

The separate `isecure-ts-client/platform` entry point exposes the platform's generated Platform API
operations. Catalogue discovery and signed download links use the independent Plugin API:

```ts
import { createPlatformClient, PluginHttpTransport } from "isecure-ts-client/platform";

const plugins = new PluginHttpTransport({
  baseUrl: pluginApiBaseUrl, // Deployment-provided root URL.
  authentication: () => ({ apiKey: currentApiKey, idToken: currentIdToken }),
});
const platform = createPlatformClient(plugins);
const { entries } = await platform.pluginCatalogue.list({});
```

This transport sends the current WS-channel ID token directly, with no Processing session exchange.
It permits only the two plugin read operations, refuses redirects, bounds response size and time,
and performs no automatic retries. `PluginHttpError` exposes HTTP status and the response body;
never log tokens, signed download links or response bodies. The intended deployment roots are
`https://plugins-api.test.isecure.fi` and `https://plugins-api.isecure.fi`; deployment availability
is separate from SDK support.

Catalogue format selection is independent of app and plugin versions. Existing callers can keep
`list({})`, which returns the legacy response. `list({ catalogue_format_version: 2 })` opts into
`catalogue_format_version` and per-release `entry_issues` alongside the usable `entries`. Issues
contain public release identities and closed reasons; they grant no permission and do not revoke
installed packages. Hosts assess compatibility for each release, and still verify signed packages
and resources before use. A caller supporting an older server may retry the legacy request only
when the server explicitly rejects the new input contract, never after an authorization failure.

`pluginCatalogue.list` returns the plugin catalogue filtered to the signed-in caller's tenant and
roles; the Platform API is the only listing authority, and each entry carries its complete canonical
release entry (`release_entry`). `pluginArtifact.get` returns a five-minute link to a listed
release's signed package or resource bundle; the whole listing is never linked. A link is a bearer
capability: fetch it promptly, never log it, and verify the bytes against their signatures.

The `integrations` namespace exposes generated draft creation/revision, list/get, review,
approval, activation, pause/revoke and active-connector resolution. Hosted setup uses
`setupBegin`, `setupRead`, `setupAnswer`, `setupResume` and `setupCancel`. Methods use each
operation's generated contract version independently of the application or plugin version.
These operations still require `Iso20022HttpTransport` from `isecure-ts-client/iso20022` and a
separately deployed Processing API. `PluginHttpTransport` refuses them. These client methods do
not establish deployment availability or provider qualification.

```ts
import { Iso20022HttpTransport } from "isecure-ts-client/iso20022";

const transport = new Iso20022HttpTransport({ baseUrl, bootstrapAuthentication, processingAudience });
await transport.exchangeProcessingSession();
const hosted = createPlatformClient(transport);
const progress = await hosted.integrations.setupBegin(
  { integration_id: savedIntegrationId, expected_revision: savedRevision },
  { idempotencyKey: retryId, expectedResourceVersion: `"${savedRevision}"` },
);
const retained = await hosted.integrations.setupRead({ setup_session_id: progress.setup_session_id });
```

Hosted draft creation needs the authenticated server account scope. Desktop storage IDs are not
server identities. An application adopting the schema-2 session endpoint can explicitly request it:

```ts
const session = await transport.exchangeProcessingSession({ schemaVersion: 2 });
const { tenantId, legalEntityId, actorId } = session.scope;
```

The scoped exchange sends `ISECure-Session-Schema-Version: 2`. An older server returning schema 1
is rejected for that opt-in; the client never guesses a scope or silently downgrades. Ordinary
`exchangeProcessingSession()` keeps the existing schema-1 response and headers unchanged.
Schema 2 accepts additive metadata but exposes only validated routing IDs, audience and expiry;
it never returns the session credential. These IDs confer no permission. Clear session metadata
on sign-out/account changes, and re-read it after renewal rather than retaining another account's
scope. `processingSessionMetadata` now returns the schema-1 or schema-2 discriminated union.
The schema-2 server endpoint is a delivery candidate, not claimed available on live deployments.

Keep the returned setup session and checkpoint generation with the user's current form. Answer,
resume and cancel require that checkpoint generation in the input and its quoted value in
`expectedResourceVersion`. Use a new retry ID for a new command and preserve it for an explicit
retry of the same command. Reading retained setup does not begin another attempt. The SDK does
not silently retry commands, restart setup, or refresh authentication. On session expiry, the
application can retain the form, obtain fresh sign-in, explicitly exchange a Processing session,
and read the retained setup before continuing. A stale checkpoint requires reconciliation;
permission refusal or uncertain provider outcomes must not trigger automatic resubmission.
Provider credentials remain under server custody; these methods carry generated references and
challenge answers, not publisher secrets.
