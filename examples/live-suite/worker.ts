import { createHash, createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { WSChannel, type IWSChannel, type AuthPromptAdapter } from "../../src/index.js";
import { Iso20022HttpError } from "../../src/iso20022/index.js";
import {
  ensureAuthorizeKey,
  publicRsaKey,
  processingClient,
  signingMaterial,
  type ChannelClients,
} from "../processing-manual-upload/processing-manual-upload.js";
import { runProcessingSimulatorJourney } from "../processing-simulator-journey/processing-simulator-journey.js";

let phase = "fixture";

function totp(secret: string): string {
  if (!/^[A-Z2-7]{16,128}$/u.test(secret)) throw new Error("Invalid TOTP fixture");
  const bits = Array.from(secret)
    .map((c) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from((bits.match(/.{8}/gu) ?? []).map((b) => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return String((hash.readUInt32BE((hash[hash.length - 1] ?? 0) & 15) & 0x7fffffff) % 1000000).padStart(6, "0");
}
async function main(): Promise<void> {
  const directory = process.argv[2] ?? "";
  if (!path.isAbsolute(directory)) throw new Error("Private run directory required");
  const file = path.join(directory, "fixture.json");
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.size > 65536)
    throw new Error("Private fixture required");
  const fixture = JSON.parse(await readFile(file, "utf8")) as {
    version: number;
    env: Record<string, string>;
    adminTotpSecret: string;
    platform: { root: string; sdkRoot: string; clientRevision: string; manifest: string; receipt: string };
  };
  if (
    fixture.version !== 1 ||
    fixture.env.ISECURE_BASE_URL !== "https://ws-api.test.isecure.fi/v2" ||
    fixture.env.ISECURE_PROCESSING_BASE_URL !== "https://processing-api.test.isecure.fi" ||
    fixture.env.ISECURE_PROCESSING_AUDIENCE !== "isecure-processing-gpgtest-v1" ||
    fixture.env.ISECURE_BANK !== "simulator"
  )
    throw new Error("Only branded test APIs are allowed");
  for (const name of Object.keys(process.env))
    if (name.startsWith("ISECURE_")) Reflect.deleteProperty(process.env, name);
  for (const [key, value] of Object.entries(fixture.env)) {
    if (!key.startsWith("ISECURE_") || typeof value !== "string") throw new Error("Invalid environment");
    process.env[key] = value;
  }
  const runId = path.basename(directory);
  if (!/^run-[a-f0-9-]{36}$/u.test(runId)) throw new Error("Invalid run ID");
  process.env.ISECURE_EXAMPLE_RUN_ID = runId;
  process.env.ISECURE_OUTPUT_DIR = path.join(directory, "files");
  process.env.ISECURE_SIMULATOR_JOURNEY_CHECKPOINT_DIR = path.join(directory, "checkpoints");
  const env = fixture.env;
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error("Incomplete fixture");
    return value;
  };
  const common: IWSChannel = {
    ApiKey: required("ISECURE_API_KEY"),
    Bank: "simulator",
    BaseUrl: required("ISECURE_BASE_URL"),
    Company: required("ISECURE_COMPANY"),
    Name: required("ISECURE_NAME"),
    Phone: required("ISECURE_PHONE"),
    PublicKey: await publicRsaKey(),
    Email: required("ISECURE_ADMIN_EMAIL"),
    Password: required("ISECURE_ADMIN_PASSWORD"),
    Mode: "admin",
  };
  const admin = new WSChannel(common);
  const data = new WSChannel({
    ...common,
    Mode: "data",
    Email: required("ISECURE_DATA_EMAIL"),
    Password: required("ISECURE_DATA_PASSWORD"),
  });
  const uploader = new WSChannel({
    ...common,
    Mode: "data",
    Email: required("ISECURE_UPLOAD_DATA_EMAIL"),
    Password: required("ISECURE_UPLOAD_DATA_PASSWORD"),
  });
  const adversary = new WSChannel({
    ...common,
    Mode: "data",
    Email: required("ISECURE_ADVERSARY_EMAIL"),
    Password: required("ISECURE_ADVERSARY_PASSWORD"),
    ApiKey: required("ISECURE_ADVERSARY_API_KEY"),
  });
  if (admin.props.Email === data.props.Email) throw new Error("Separate approval identity required");
  let totpObserved = false;
  const prompts: AuthPromptAdapter = {
    requestMfaSelection: (state) => {
      if (!state.methods.includes("totp")) throw new Error("TOTP required");
      return Promise.resolve("totp");
    },
    requestMfaCode: (state) => {
      if (state.method !== "totp" || state.mode !== "admin") throw new Error("Unexpected MFA");
      totpObserved = true;
      return Promise.resolve(totp(fixture.adminTotpSecret));
    },
    requestEmailCode: () => {
      throw new Error("Verification fixture not ready");
    },
    requestPhoneCode: () => {
      throw new Error("Verification fixture not ready");
    },
  };
  const passed: string[] = [];
  const receipt = async (stage: string) => {
    passed.push(stage);
    await writeFile(path.join(directory, "workflow.json"), JSON.stringify({ version: 1, passed }) + "\n", {
      mode: 0o600,
    });
  };
  phase = "shared-authentication";
  for (const client of [admin, data, uploader, adversary]) {
    const result = await client.loginWithPrompt(prompts);
    if (result.status !== "authenticated") throw new Error("Authentication failed");
  }
  if (!totpObserved) throw new Error("TOTP was not exercised");
  await receipt("shared-authentication");
  phase = "processing-sessions";
  const submitter = await processingClient(admin),
    approver = await processingClient(data);
  phase = "simulator-permissions";
  const capabilities = await submitter.simulationCapabilities.list({
    data_admission_mode: "synthetic",
    page: { page_size: 1 },
  });
  if (capabilities.capabilities.length !== 1) throw new Error("Simulator capability unavailable");
  try {
    await approver.simulationCapabilities.list({ page: { page_size: 1 } });
    throw new Error("Unexpected simulator authority");
  } catch (error) {
    if (!(error instanceof Iso20022HttpError) || error.status !== 403) throw error;
  }
  const platform = fixture.platform;
  if (![platform.root, platform.sdkRoot, platform.manifest, platform.receipt].every(path.isAbsolute))
    throw new Error("Invalid qualification paths");
  const manifest = JSON.parse(await readFile(platform.manifest, "utf8")) as Record<string, unknown>;
  const deployment = JSON.parse(await readFile(platform.receipt, "utf8")) as Record<string, unknown>;
  const host = manifest.simulationHost as { releaseId: string; functionVersion: string };
  const sdkPackage = JSON.parse(await readFile(path.join(platform.sdkRoot, "package.json"), "utf8")) as {
    version: string;
  };
  const qualification = (await import(
    pathToFileURL(path.join(platform.root, "infra/dist/src/bank-simulation-qualification.js")).href
  )) as {
    runBankSimulationQualification(input: unknown): Promise<unknown>;
  };
  const bootstrap = (client: WSChannel) => ({ apiKey: client.session.apiKey, idToken: client.session.idToken });
  phase = "simulator-qualification";
  const attestation = await qualification.runBankSimulationQualification({
    authentication: {
      schemaVersion: 1,
      baseUrl: required("ISECURE_PROCESSING_BASE_URL"),
      processingAudience: required("ISECURE_PROCESSING_AUDIENCE"),
      releaseId: manifest.releaseId,
      repositoryRevision: manifest.repositoryRevision,
      sdkVersion: sdkPackage.version,
      authorized: bootstrap(admin),
      adversary: bootstrap(adversary),
    },
    binding: {
      runId,
      qualificationRepositoryRevision: manifest.repositoryRevision,
      processingLambdaVersion: String(deployment.lambdaVersion),
      processingApiDeploymentId: deployment.apiDeploymentId,
      simulatorReleaseId: host.releaseId,
      simulatorFunctionVersion: host.functionVersion,
    },
    clientRoot: platform.sdkRoot,
    clientRepositoryRevision: platform.clientRevision,
    manifest,
    openApi: JSON.parse(
      await readFile(path.join(platform.root, "generated/processing/openapi.json"), "utf8"),
    ) as unknown,
  });
  await writeFile(path.join(directory, "simulator-attestation.json"), JSON.stringify(attestation) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  phase = "simulator-enrollment";
  const certificates = await uploader.listCerts();
  if (certificates.ResponseCode !== "00") throw new Error("Certificate listing failed");
  if (!certificates.Certs.some((cert) => cert.CertName.toLowerCase().includes("simulator"))) {
    // Enrollment is generic SDK behavior. These deterministic identifiers belong only to
    // the operator-admitted synthetic fixture and are retained between suite invocations.
    const fixtureId = createHash("sha256").update(required("ISECURE_API_KEY")).digest("hex");
    const enrolled = await admin.enrollCert({
      Code: `SIM-${fixtureId.slice(0, 24)}`,
      Company: required("ISECURE_COMPANY"),
      WsUserId: `SIM-${fixtureId.slice(0, 12)}`,
    });
    if (enrolled.ResponseCode !== "00") throw new Error("Simulator enrollment failed");
  }
  await receipt("simulator-access");
  phase = "payment-feedback-statement";
  await ensureAuthorizeKey(admin, await signingMaterial());
  const channels: ChannelClients = { admin, data, uploader };
  await runProcessingSimulatorJourney(channels);
  await receipt("payment-feedback-statement");
}
main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const code = /^(BFSIMQUAL[0-9]{3}|[A-Z][A-Z_]{5,60})$/u.test(message) ? message : "WORKFLOW_FAILED";
  const detail = error !== null && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const cause =
    detail.cause !== null && typeof detail.cause === "object" ? (detail.cause as Record<string, unknown>) : detail;
  const operation =
    typeof detail.operationId === "string" && /^(simulation_|payment_)[a-z_.]{1,80}$/u.test(detail.operationId)
      ? detail.operationId
      : undefined;
  const status =
    Number.isInteger(cause.status) && Number(cause.status) >= 400 && Number(cause.status) <= 599
      ? cause.status
      : undefined;
  const body = cause.body as { issues?: { issue_code?: unknown }[] } | undefined;
  const knownIssues = new Set([
    "processing_dependency_unavailable",
    "processing_outcome_indeterminate",
    "processing_invalid_release",
  ]);
  const issues = Array.isArray(body?.issues)
    ? body.issues.flatMap((issue) =>
        typeof issue.issue_code === "string" && knownIssues.has(issue.issue_code) ? [issue.issue_code] : [],
      )
    : [];
  const directory = process.argv[2];
  if (directory && path.isAbsolute(directory))
    await writeFile(
      path.join(directory, "failure.json"),
      JSON.stringify({ code, phase, operation, status, issues }) + "\n",
      {
        mode: 0o600,
      },
    );
  process.exitCode = 1;
});
