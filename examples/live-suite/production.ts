import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { WSChannel, type IWSChannel } from "../../src/index.js";
import { iso20022Operations } from "../../src/generated/iso20022-contracts.js";
import { createIso20022Client, Iso20022HttpTransport, Iso20022HttpError } from "../../src/iso20022/index.js";
import { authenticate } from "../shared/auth.js";
import {
  prepareFinalizedFile,
  requireVerifiedPain001,
  type GenerationInputs,
} from "../processing-generate-file/generate-file.js";

export const PRODUCTION_ORIGIN = "https://processing-api.isecure.fi";
const OPERATIONS = [
  "payment_export_profile_catalog.list",
  "payment_export_profiles.configure",
  "payment_export_profiles.get",
  "payment_capabilities.resolve",
  "payment_orders.create_draft",
  "payment_orders.get",
  "payment_orders.list",
  "payment_orders.validate",
  "payment_orders.finalize_draft",
  "payment_orders.generate_file",
  "payment_orders.cancel_draft",
] as const;
export interface ReleaseEvidence {
  sourceRevision: string;
  codeSha256: string;
  gatewayDeploymentId: string;
  sdkRevision: string;
}
interface Check {
  name: string;
  status: "passed" | "failed" | "running";
  httpStatus?: number;
}
interface Observation {
  operation: string;
  status: number;
  elapsedMs: number;
  requestId?: string;
}
export interface ProductionReport {
  environment: "production";
  startedAt: string;
  finishedAt: string;
  status: "passed" | "failed";
  release: ReleaseEvidence;
  checks: Check[];
  requests: Observation[];
  cleanup: "required";
}

/** Deny uploads, execution, approval, redirects and other hosts even if a journey changes. */
export function permittedProductionOperation(url: string, method: string): string {
  const parsed = new URL(url);
  if (parsed.origin !== PRODUCTION_ORIGIN || parsed.username || parsed.password || parsed.hash)
    throw new Error("PRODUCTION_DESTINATION_REFUSED");
  if (parsed.pathname === "/session" && method === "POST") return "session";
  for (const id of OPERATIONS) {
    const operation = iso20022Operations[id];
    const pattern = operation.path.replace(/\{[^}]+\}/gu, "[0-9a-f-]{36}");
    if (operation.method === method && new RegExp(`^${pattern}$`, "u").test(parsed.pathname)) return id;
  }
  throw new Error("PRODUCTION_OPERATION_REFUSED");
}

export function productionFetch(observations: Observation[], delegate: typeof fetch = globalThis.fetch): typeof fetch {
  let count = 0;
  return async (input, init) => {
    if (input instanceof Request) throw new Error("PRODUCTION_REQUEST_OBJECT_REFUSED");
    const operation = permittedProductionOperation(String(input), init?.method ?? "GET");
    if (++count > 100) throw new Error("PRODUCTION_REQUEST_BUDGET_EXCEEDED");
    const start = performance.now();
    const deadline = AbortSignal.timeout(60_000);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    const result = await delegate(input, { ...init, signal, redirect: "error" });
    const requestId = result.headers.get("x-amzn-requestid");
    observations.push({
      operation,
      status: result.status,
      elapsedMs: Math.round(performance.now() - start),
      ...(requestId && /^[A-Za-z0-9_-]{1,100}$/u.test(requestId) ? { requestId } : {}),
    });
    return result;
  };
}

/** Synthetic values only; these bytes must never be submitted to a bank. */
export function syntheticGenerationInputs(runId: string, bankProfileId: string): GenerationInputs {
  return {
    runId,
    bankProfileId,
    debtor: {
      iban: "FI2112345600000785",
      name: "Synthetic Debtor Oy",
      agentBic: "NDEAFIHH",
      countryCode: "FI",
      bankAgreementId: "9600158260",
      initiatingPartyName: "Synthetic Initiating Party Oy",
      initiatingPartyCustomerId: "5780860238",
    },
    creditor: {
      iban: "FI4516273000000856",
      name: "Synthetic Creditor Oy",
      agentBic: "OKOYFIHH",
      countryCode: "FI",
      townName: "Helsinki",
      addressLine: "Synthetic Street 1",
    },
    amount: "12.34",
    remittanceText: "Synthetic qualification only",
    requestedExecutionDate: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10),
  };
}

export async function runProductionChecks(
  channel: WSChannel,
  release: ReleaseEvidence,
  persist?: (report: ProductionReport) => Promise<void>,
): Promise<ProductionReport> {
  assert.equal(channel.props.BaseUrl, "https://ws-api.isecure.fi/v2");
  assert.match(channel.props.Company, /^ISECure Synthetic Processing Qualification$/u);
  assert.match(release.sourceRevision, /^[a-f0-9]{40}$/u);
  assert.match(release.sdkRevision, /^[a-f0-9]{40}$/u);
  assert.match(release.codeSha256, /^[A-Za-z0-9+/]{43}=$/u);
  assert.match(release.gatewayDeploymentId, /^[a-z0-9]+$/u);
  const report: ProductionReport = {
    environment: "production",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    status: "failed",
    release: {
      sourceRevision: release.sourceRevision,
      codeSha256: release.codeSha256,
      gatewayDeploymentId: release.gatewayDeploymentId,
      sdkRevision: release.sdkRevision,
    },
    checks: [],
    requests: [],
    cleanup: "required",
  };
  const guardedFetch = productionFetch(report.requests);
  const check = async (name: string, action: () => Promise<void> | void) => {
    const entry: Check = { name, status: "running" };
    report.checks.push(entry);
    await persist?.(report);
    try {
      await action();
      entry.status = "passed";
    } catch (error) {
      entry.status = "failed";
      if (error instanceof Iso20022HttpError) entry.httpStatus = error.status;
      throw error;
    } finally {
      await persist?.(report);
    }
  };
  const transport = new Iso20022HttpTransport({
    baseUrl: PRODUCTION_ORIGIN,
    processingAudience: "isecure-processing-production-v1",
    bootstrapAuthentication: () => {
      const { apiKey, idToken } = channel.session;
      if (!apiKey || !idToken || channel.isSessionExpired()) throw new Error("SESSION_REQUIRED");
      return { apiKey, idToken };
    },
    fetch: guardedFetch,
    timeoutMs: 60_000,
  });
  const client = createIso20022Client(transport);
  const refuses = async (action: () => Promise<unknown>, status: number) =>
    assert.rejects(action, (error: unknown) => error instanceof Iso20022HttpError && error.status === status);
  try {
    await check("gateway-missing-key", async () => {
      const r = await guardedFetch(`${PRODUCTION_ORIGIN}/v1/payment-orders`);
      await r.text();
      assert.equal(r.status, 403);
    });
    await check("gateway-missing-identity", async () => {
      const r = await guardedFetch(`${PRODUCTION_ORIGIN}/session`, {
        method: "POST",
        headers: { "x-api-key": channel.session.apiKey ?? "", "content-type": "application/json" },
        body: "{}",
      });
      await r.text();
      assert.equal(r.status, 401);
    });
    await check("processing-session", async () => {
      await transport.exchangeProcessingSession();
    });
    const catalog = await client.paymentExportProfileCatalog.list();
    // Match the current published generation path. Other banks are reported separately as scope.
    const profileId = "nordea-ca-v9-finland-sepa-unstructured";
    await check("available-bank-profile", () => {
      assert.ok(catalog.profiles.some((p) => p.bank_profile_id === profileId && p.availability_status === "available"));
    });
    const runId = `prod-${randomUUID().replaceAll("-", "")}`;
    const inputs = syntheticGenerationInputs(runId, profileId);
    let prepared: Awaited<ReturnType<typeof prepareFinalizedFile>> | undefined;
    await check("configure-draft-validate-finalize", async () => {
      prepared = await prepareFinalizedFile(client, inputs);
    });
    assert.ok(prepared);
    const { query, created, draftInput, profile } = prepared;
    await check("profile-readback", async () => {
      const p = await client.paymentExportProfiles.get();
      assert.equal(p.payment_export_profile.payment_export_profile_id, profile.payment_export_profile_id);
    });
    await check("draft-idempotent-replay", async () => {
      const replay = await client.paymentOrders.createDraft(draftInput, { idempotencyKey: `${runId}-create-draft` });
      assert.equal(replay.payment_order_reference.resource_id, created.payment_order_reference.resource_id);
      assert.equal(replay.revision_id, created.revision_id);
    });
    await check("generated-xml-and-repeat", async () => {
      const first = await client.paymentOrders.generateFile(query);
      const second = await client.paymentOrders.generateFile(query);
      requireVerifiedPain001(first);
      requireVerifiedPain001(second);
      assert.deepEqual(first.bytes, second.bytes);
      const xml = new TextDecoder().decode(first.bytes);
      for (const value of [
        "12.34",
        inputs.creditor.iban,
        inputs.debtor.iban,
        inputs.remittanceText,
        inputs.requestedExecutionDate,
      ])
        assert.ok(xml.includes(value));
    });
    await check("stale-order-revision", () =>
      refuses(() => client.paymentOrders.generateFile({ ...query, order_revision_id: randomUUID() }), 412),
    );
    await check("stale-profile-revision", () =>
      refuses(() => client.paymentOrders.generateFile({ ...query, profile_revision: "999999" }), 412),
    );
    await check("unknown-order-authorization-denial", () =>
      refuses(() => client.paymentOrders.get({ payment_order_id: randomUUID() }), 403),
    );
    await check("generation-preserves-finalized-state", async () => {
      const order = await client.paymentOrders.get({ payment_order_id: query.payment_order_id });
      assert.equal(order.payment_order.workflow_state, "finalized");
      assert.equal(order.payment_order.current_revision_id, query.order_revision_id);
    });
    await check("cancel-separate-draft", async () => {
      const draft = await client.paymentOrders.createDraft(
        { ...draftInput, external_id: `${runId}-c` },
        { idempotencyKey: `${runId}-cancel-draft-create` },
      );
      const cancelled = await client.paymentOrders.cancelDraft(
        { payment_order_id: draft.payment_order_reference.resource_id },
        { idempotencyKey: `${runId}-cancel`, expectedResourceVersion: JSON.stringify(draft.resource_version) },
      );
      assert.equal(cancelled.workflow_state, "cancelled");
    });
    report.status = "passed";
  } catch {
    /* Safe stage/status evidence only; never serialize exception bodies or XML. */
  }
  report.finishedAt = new Date().toISOString();
  await persist?.(report);
  return report;
}

export async function productionMain(configPath: string, reportPath: string): Promise<void> {
  const info = await lstat(configPath);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.size > 32_768)
    throw new Error("PRIVATE_FIXTURE_REQUIRED");
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    account: IWSChannel;
    release: ReleaseEvidence;
    acknowledgement: string;
  };
  if (
    config.acknowledgement !== "temporary-production-fixture-no-bank-submission" ||
    config.account.BaseUrl !== "https://ws-api.isecure.fi/v2" ||
    config.account.Company !== "ISECure Synthetic Processing Qualification"
  )
    throw new Error("PRODUCTION_FIXTURE_REFUSED");
  const channel = new WSChannel(config.account);
  await authenticate(channel);
  await writeFile(reportPath, '{"status":"starting","cleanup":"required"}\n', { mode: 0o600, flag: "wx" });
  const report = await runProductionChecks(channel, config.release, async (report) => {
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  });
  console.log(JSON.stringify({ status: report.status, checks: report.checks, cleanup: report.cleanup }));
  process.exitCode = report.status === "passed" ? 0 : 1;
}
