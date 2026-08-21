import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WSChannel } from "../../src/index.js";
import { Iso20022HttpError, Iso20022TransportError, type Iso20022Client } from "../../src/iso20022/index.js";
import {
  channelClients,
  createApprovedExport,
  ensureAuthorizeKey,
  exactEnv,
  optionalEnv,
  processingClient,
  publicRsaKey,
  requireExplicitUploadConfirmation,
  signingMaterial,
  type ChannelClients,
} from "../processing-manual-upload/processing-manual-upload.js";
import {
  ManualUploadRefusedError,
  detachedSignature,
  hasAuthorizeKey,
  requirePain001,
  requireSharedApiKeyDomain,
  uploadPain001Once,
} from "../processing-manual-upload/security.js";
import { checkpointPath, readCheckpoint, withPhase, writeCheckpoint } from "./checkpoint.js";
import { paymentCorrelation, SIMULATOR_OUTPUT_TYPES } from "./evidence.js";
import { captureBaseline, collectSimulatorEvidence, type JourneyCheckpoint } from "./journey.js";

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/u;
const GPGTEST_REST_BASE_URL = "https://ws-api.test.isecure.fi/v2";
const GPGTEST_PROCESSING_AUDIENCE = "isecure-processing-gpgtest-v1";

type JourneyFailureCode =
  | "CHECKPOINT_INVALID"
  | "CONFIGURATION_INVALID"
  | "LOCAL_SIGNING_FAILED"
  | "OUTPUT_PERSISTENCE_FAILED"
  | "OUTPUT_RECONCILIATION_FAILED"
  | "PAYMENT_CONTENT_INVALID"
  | "PAYMENT_DOWNLOAD_FAILED"
  | "PAYMENT_PREPARATION_FAILED"
  | "PROCESSING_SESSION_DENIED"
  | "PROCESSING_SESSION_FAILED"
  | "PROCESSING_SESSION_UNAVAILABLE"
  | "REST_AUTHENTICATION_FAILED"
  | "SIMULATOR_CONNECTION_UNAVAILABLE"
  | "UPLOAD_REFUSED";

class JourneyStageError extends Error {
  public constructor(public readonly code: JourneyFailureCode) {
    super(code);
    this.name = "JourneyStageError";
  }
}

async function stage<T>(code: JourneyFailureCode, work: () => Promise<T> | T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof JourneyStageError) throw error;
    throw new JourneyStageError(code);
  }
}

async function assertSimulatorConnection(data: WSChannel): Promise<void> {
  const response = await data.listCerts();
  if (
    response.ResponseCode !== "00" ||
    !response.Certs.some((connection) => connection.CertName.toLowerCase().includes("simulator"))
  ) {
    throw new Error("The authenticated data identity has no ready simulator connection");
  }
}

async function assertUploaderAuthorizeKey(uploader: WSChannel, publicKey: import("openpgp").PublicKey): Promise<void> {
  const response = await uploader.listKeys();
  if (response.ResponseCode !== "00" || !hasAuthorizeKey(publicKey, response.PgpKeys)) {
    throw new Error("The uploader cannot use the Admin-managed authorize OpenPGP key");
  }
}

async function processingIdentities(channels: ChannelClients): Promise<{
  readonly submitter: Iso20022Client;
  readonly approver: Iso20022Client;
}> {
  const submitterMode = optionalEnv("ISECURE_PROCESSING_SUBMITTER_MODE", "admin");
  const approverMode = optionalEnv("ISECURE_PROCESSING_APPROVER_MODE", "data");
  if (
    (submitterMode !== "admin" && submitterMode !== "data") ||
    (approverMode !== "admin" && approverMode !== "data") ||
    submitterMode === approverMode
  ) {
    throw new Error("Processing submitter and approver must be distinct admin/data identities");
  }
  try {
    return {
      submitter: await processingClient(channels[submitterMode]),
      approver: await processingClient(channels[approverMode]),
    };
  } catch (error) {
    if (error instanceof Iso20022HttpError && (error.status === 401 || error.status === 403)) {
      throw new JourneyStageError("PROCESSING_SESSION_DENIED");
    }
    if (error instanceof Iso20022HttpError || error instanceof Iso20022TransportError) {
      throw new JourneyStageError("PROCESSING_SESSION_UNAVAILABLE");
    }
    throw error;
  }
}

async function prepareAndUpload(channels: ChannelClients, runId: string, filePath: string): Promise<JourneyCheckpoint> {
  requireExplicitUploadConfirmation();
  const identities = await stage("PROCESSING_SESSION_FAILED", async () => processingIdentities(channels));
  const approved = await stage("PAYMENT_PREPARATION_FAILED", async () =>
    createApprovedExport(identities.submitter, identities.approver, runId, (preparationStage) => {
      console.log(`Synthetic payment preparation: ${preparationStage}.`);
    }),
  );
  const downloaded = await stage("PAYMENT_DOWNLOAD_FAILED", async () =>
    identities.submitter.paymentBatches.download({ payment_export_id: approved.paymentExportId }, approved.authority, {
      idempotencyKey: `${runId}-download`,
    }),
  );
  const correlation = await stage("PAYMENT_CONTENT_INVALID", () => {
    requirePain001(downloaded.bytes);
    return paymentCorrelation(downloaded.bytes);
  });
  const baseline = await stage("SIMULATOR_CONNECTION_UNAVAILABLE", async () =>
    captureBaseline(channels.uploader, correlation.debtorIban),
  );
  const checkpoint: JourneyCheckpoint = {
    version: 1,
    runId,
    phase: "upload_started",
    correlation,
    ...baseline,
  };

  const signature = await stage("LOCAL_SIGNING_FAILED", async () => {
    const material = await signingMaterial();
    await ensureAuthorizeKey(channels.admin, material);
    await assertUploaderAuthorizeKey(channels.uploader, material.publicKey);
    return detachedSignature(downloaded.bytes, material.publicKey, material.privateKey);
  });
  await stage("CHECKPOINT_INVALID", async () => writeCheckpoint(filePath, checkpoint));
  try {
    await uploadPain001Once(channels.uploader, downloaded.bytes, signature, runId);
    const accepted = withPhase(checkpoint, "upload_accepted");
    await stage("CHECKPOINT_INVALID", async () => writeCheckpoint(filePath, accepted));
    return accepted;
  } catch (error) {
    if (error instanceof ManualUploadRefusedError) {
      await stage("CHECKPOINT_INVALID", async () => writeCheckpoint(filePath, withPhase(checkpoint, "upload_refused")));
      throw new JourneyStageError("UPLOAD_REFUSED");
    }
    const uncertain = withPhase(checkpoint, "upload_uncertain");
    await stage("CHECKPOINT_INVALID", async () => writeCheckpoint(filePath, uncertain));
    return uncertain;
  }
}

async function writePrivateExact(filePath: string, bytes: Uint8Array): Promise<void> {
  try {
    const metadata = await lstat(filePath);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      (process.platform !== "win32" && (metadata.mode & 0o077) !== 0)
    ) {
      throw new Error("An output path is not a private regular file");
    }
    const existing = await readFile(filePath);
    if (!existing.equals(Buffer.from(bytes))) throw new Error("An existing output does not equal the verified bytes");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
  }
}

async function requirePrivateDirectory(directory: string): Promise<void> {
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("An output path is not a regular directory");
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    throw new Error("The output directory must not be accessible by group or other users");
  }
}

async function persistEvidence(
  runId: string,
  files: Awaited<ReturnType<typeof collectSimulatorEvidence>>["files"],
): Promise<void> {
  const root = path.resolve(process.env.ISECURE_OUTPUT_DIR ?? "isecure-processing-simulator-downloads");
  const directory = path.join(root, runId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await requirePrivateDirectory(directory);
  for (const fileType of SIMULATOR_OUTPUT_TYPES) {
    await writePrivateExact(path.join(directory, `${fileType}.xml`), files[fileType]);
  }
}

async function main(): Promise<void> {
  const runId = await stage("CONFIGURATION_INVALID", () => {
    if (optionalEnv("ISECURE_BANK", "").toLowerCase() !== "simulator") {
      throw new Error("This synthetic journey requires ISECURE_BANK=simulator");
    }
    if (
      optionalEnv("ISECURE_BASE_URL", "") !== GPGTEST_REST_BASE_URL ||
      optionalEnv("ISECURE_PROCESSING_AUDIENCE", "") !== GPGTEST_PROCESSING_AUDIENCE
    ) {
      throw new Error("This synthetic journey is restricted to the exact gpgtest REST and Processing profiles");
    }
    return exactEnv("ISECURE_EXAMPLE_RUN_ID", RUN_ID);
  });
  const filePath = checkpointPath(runId);
  const channels = await stage("REST_AUTHENTICATION_FAILED", async () => channelClients(await publicRsaKey()));
  try {
    requireSharedApiKeyDomain([
      channels.admin.session.apiKey,
      channels.data.session.apiKey,
      channels.uploader.session.apiKey,
    ]);
  } catch {
    throw new JourneyStageError("REST_AUTHENTICATION_FAILED");
  }
  await stage("SIMULATOR_CONNECTION_UNAVAILABLE", async () => assertSimulatorConnection(channels.uploader));
  let checkpoint = await stage("CHECKPOINT_INVALID", async () => readCheckpoint(filePath, runId));
  if (checkpoint?.phase === "complete") {
    console.log("The synthetic Processing-to-simulator journey was already completed for this run.");
    return;
  }
  if (checkpoint?.phase === "upload_refused") {
    throw new JourneyStageError("UPLOAD_REFUSED");
  }
  if (checkpoint?.phase === "upload_started") {
    const uncertainCheckpoint = withPhase(checkpoint, "upload_uncertain");
    await stage("CHECKPOINT_INVALID", async () => writeCheckpoint(filePath, uncertainCheckpoint));
    checkpoint = uncertainCheckpoint;
  }
  checkpoint ??= await prepareAndUpload(channels, runId, filePath);
  const readyCheckpoint: JourneyCheckpoint = checkpoint;

  const evidence = await stage("OUTPUT_RECONCILIATION_FAILED", async () =>
    collectSimulatorEvidence(channels.uploader, readyCheckpoint),
  );
  await stage("OUTPUT_PERSISTENCE_FAILED", async () => persistEvidence(runId, evidence.files));
  await stage("CHECKPOINT_INVALID", async () => writeCheckpoint(filePath, withPhase(readyCheckpoint, "complete")));
  console.log(
    readyCheckpoint.phase === "upload_uncertain"
      ? "The uncertain upload was reconciled from exact simulator outputs; no upload retry was attempted."
      : "The approved payment batch and all exact simulator outputs were verified successfully.",
  );
}

main().catch((error: unknown) => {
  const code = error instanceof JourneyStageError ? error.code : "CONFIGURATION_INVALID";
  console.error(
    `The synthetic Processing-to-simulator journey stopped safely (${code}); inspect the private checkpoint before retrying.`,
  );
  process.exitCode = 1;
});
