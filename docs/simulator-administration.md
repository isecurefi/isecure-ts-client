# Bank Simulator administration

[Back to the README](../README.md)

`createSimulationAdminClient` and `SimulationAdminHttpTransport` expose configuration and bounded synthetic execution
using your existing WS login. They require no Processing session or SSE stream.
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

The client exposes capabilities, workspace and scenario configuration, file import/read, run start/list/get,
and run artifact/event lists. Always discover capabilities first: older deployments can manage configuration
while reporting `runtime_availability: "contract_only"`. SDK support does not itself establish deployment
or qualification. Clock, checkpoint, branch and reset controls remain unavailable through this transport.

To run without Processing:

1. Select an active workspace and scenario, using their exact resource references.
2. Call `simulationFiles.import` with `data_admission_mode: "synthetic"` and either:
   - `source_type: "sample_payment"`, two distinct workspace account keys and an exact decimal amount/currency; or
   - `source_type: "uploaded_file"` and base64-encoded synthetic pain.001.001.09 XML (at most 128 KiB).
3. Pass the returned artifact to `simulationRuns.start` as `input: { input_type: "exact_artifact", artifact }`.
4. Read the run's input/output artifacts through `simulationFiles.read` with its workspace reference.

Give import and start separate idempotency keys. Retain both inputs and keys until confirmed;
if start needs a retry, reuse the imported artifact. A successfully completed run can intentionally
produce a rejected payment: inspect its scenario, events and pain.002 evidence.
The initial runtime allows at most 16 runs per workspace revision and retains bounded exact files.
These management files do not appear automatically in the customer File Exchange Simulator bank.
Generating payments with Processing is optional and requires a separately available Processing service.

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
