# Bank Simulator administration

[Back to the README](../README.md)

`createSimulationAdminClient` and `SimulationAdminHttpTransport` expose twelve configuration
operations using your existing WS login. They require no Processing session or SSE stream.
File Exchange access to the `simulator` bank uses the `bank-simulator` subscription.
Administration requires a separate `bank-simulation` subscription with the requested capabilities
and an explicit manager grant. Neither enrollment grants the other. Both use the existing WS login;
authorization remains on the server.

```ts
import { createSimulationAdminClient, SimulationAdminHttpTransport } from "isecure-ts-client/iso20022";

const loginLifetime = new AbortController();
const simulatorAdmin = createSimulationAdminClient(
  new SimulationAdminHttpTransport({
    baseUrl: simulatorAdministrationUrl, // Exact endpoint supplied for your environment.
    authentication: () => ({ idToken: currentLogin.idToken, apiKey: currentLogin.apiKey }),
    signal: loginLifetime.signal,
  }),
);
const workspaces = await simulatorAdmin.simulationWorkspaces.list({ page: { page_size: 25 } });
// On sign-out or account replacement, discard this client and its displayed data:
loginLifetime.abort();
```

The client exposes capabilities, workspace list/get/create/revise/activate/suspend/close, and
scenario list/get/create/revise. Activation changes configuration only. Run execution, reset,
clocks, checkpoints, branches and output retrieval are unavailable through this transport. Existing
customer Bank Simulator file exchange remains separate and unchanged. SDK support does not by itself
establish that the independent service is deployed or that execution is qualified.

The transport resolves identity on every request, refuses redirects and browser caching, limits
command bodies to 256 KiB and bounds response size and elapsed time. `SimulationAdminHttpError`
extends `Iso20022HttpError` with HTTP status and the service response. No request is automatically
retried. A timeout, cancellation or lost response does not prove a command failed to commit.
Retain the original input, idempotency key and expected revision for an explicit retry; never replace
the key merely because a response was lost. A conflict requires refreshing the current revision;
an expired command key (HTTP 410) requires reconciliation before starting a new command.

| Environment | Base URL                                      |
| ----------- | --------------------------------------------- |
| Test        | `https://simulator-admin-api.test.isecure.fi` |
| Production  | `https://simulator-admin-api.isecure.fi`      |

This client is exported from the experimental `isecure-ts-client/iso20022` entry point; see
[API stability](../STABILITY.md).
