import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WSChannel } from "../../src/index.js";
import type { Iso20022Client } from "../../src/iso20022/index.js";
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
  requirePain001,
  uploadPain001Once,
} from "../processing-manual-upload/security.js";
import { checkpointPath, readCheckpoint, withPhase, writeCheckpoint } from "./checkpoint.js";
import { paymentCorrelation, SIMULATOR_OUTPUT_TYPES } from "./evidence.js";
import { captureBaseline, collectSimulatorEvidence, type JourneyCheckpoint } from "./journey.js";

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/u;
const GPGTEST_REST_BASE_URL = "https://ws-api.test.isecure.fi/v2";
const GPGTEST_PROCESSING_AUDIENCE = "isecure-processing-gpgtest-v1";

async function assertSimulatorConnection(data: WSChannel): Promise<void> {
  const response = await data.listCerts();
  if (
    response.ResponseCode !== "00" ||
    !response.Certs.some((connection) => connection.CertName.toLowerCase().includes("simulator"))
  ) {
    throw new Error("The authenticated data identity has no ready simulator connection");
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
  return {
    submitter: await processingClient(channels[submitterMode]),
    approver: await processingClient(channels[approverMode]),
  };
}

async function prepareAndUpload(channels: ChannelClients, runId: string, filePath: string): Promise<JourneyCheckpoint> {
  requireExplicitUploadConfirmation();
  const identities = await processingIdentities(channels);
  const approved = await createApprovedExport(identities.submitter, identities.approver, runId);
  const downloaded = await identities.submitter.paymentBatches.download(
    { payment_export_id: approved.paymentExportId },
    approved.authority,
    { idempotencyKey: `${runId}-download` },
  );
  requirePain001(downloaded.bytes);
  const correlation = paymentCorrelation(downloaded.bytes);
  const baseline = await captureBaseline(channels.data, correlation.debtorIban);
  const checkpoint: JourneyCheckpoint = {
    version: 1,
    runId,
    phase: "upload_started",
    correlation,
    ...baseline,
  };

  const material = await signingMaterial();
  await ensureAuthorizeKey(channels.admin, material);
  const signature = await detachedSignature(downloaded.bytes, material.publicKey, material.privateKey);
  await writeCheckpoint(filePath, checkpoint);
  try {
    await uploadPain001Once(channels.data, downloaded.bytes, signature, runId);
    const accepted = withPhase(checkpoint, "upload_accepted");
    await writeCheckpoint(filePath, accepted);
    return accepted;
  } catch (error) {
    if (error instanceof ManualUploadRefusedError) {
      await writeCheckpoint(filePath, withPhase(checkpoint, "upload_refused"));
      throw error;
    }
    const uncertain = withPhase(checkpoint, "upload_uncertain");
    await writeCheckpoint(filePath, uncertain);
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
  if (optionalEnv("ISECURE_BANK", "").toLowerCase() !== "simulator") {
    throw new Error("This synthetic journey requires ISECURE_BANK=simulator");
  }
  if (
    optionalEnv("ISECURE_BASE_URL", "") !== GPGTEST_REST_BASE_URL ||
    optionalEnv("ISECURE_PROCESSING_AUDIENCE", "") !== GPGTEST_PROCESSING_AUDIENCE
  ) {
    throw new Error("This synthetic journey is restricted to the exact gpgtest REST and Processing profiles");
  }
  const runId = exactEnv("ISECURE_EXAMPLE_RUN_ID", RUN_ID);
  const filePath = checkpointPath(runId);
  const channels = await channelClients(await publicRsaKey());
  if (!channels.admin.session.apiKey || channels.admin.session.apiKey !== channels.data.session.apiKey) {
    throw new Error("The admin and data identities do not belong to the same API-key security domain");
  }
  await assertSimulatorConnection(channels.data);
  let checkpoint = await readCheckpoint(filePath, runId);
  if (checkpoint?.phase === "complete") {
    console.log("The synthetic Processing-to-simulator journey was already completed for this run.");
    return;
  }
  if (checkpoint?.phase === "upload_refused") {
    throw new Error("The prior upload was refused; start a deliberately new run after correcting the cause");
  }
  if (checkpoint?.phase === "upload_started") {
    checkpoint = withPhase(checkpoint, "upload_uncertain");
    await writeCheckpoint(filePath, checkpoint);
  }
  checkpoint ??= await prepareAndUpload(channels, runId, filePath);

  const evidence = await collectSimulatorEvidence(channels.data, checkpoint);
  await persistEvidence(runId, evidence.files);
  await writeCheckpoint(filePath, withPhase(checkpoint, "complete"));
  console.log(
    checkpoint.phase === "upload_uncertain"
      ? "The uncertain upload was reconciled from exact simulator outputs; no upload retry was attempted."
      : "The approved payment batch and all exact simulator outputs were verified successfully.",
  );
}

main().catch(() => {
  console.error(
    "The synthetic Processing-to-simulator journey stopped safely; inspect the private checkpoint before retrying.",
  );
  process.exitCode = 1;
});
