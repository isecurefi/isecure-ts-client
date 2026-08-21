import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as openpgp from "openpgp";
import { WSChannel, type ApiResponse, type IWSChannel } from "../../src/index.js";
import {
  createIso20022Client,
  Iso20022HttpTransport,
  type Iso20022Client,
  type PaymentExportContentAuthority,
  type PaymentExportProfileCatalogEntry,
  type ProcessingBootstrapAuthentication,
} from "../../src/iso20022/index.js";
import { authenticate, configFromEnv, requiredEnv } from "../shared/auth.js";
import { detachedSignature, requireMatchingKeys, requirePain001, uploadPain001Once } from "./security.js";

const PAIN_001 = "pain.001.001.09";
const UPLOAD_CONFIRMATION = "I-understand-upload-is-not-idempotent";
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/u;
const EXACT_AMOUNT = /^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/u;
const COUNTRY_CODE = /^[A-Z]{2}$/u;
const BIC = /^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/u;
let uploadAttemptStarted = false;

export interface ChannelClients {
  readonly admin: WSChannel;
  readonly data: WSChannel;
}

export interface SigningMaterial {
  readonly armoredPublicKey: string;
  readonly privateKey: openpgp.PrivateKey;
  readonly publicKey: openpgp.PublicKey;
}

function assertSuccess<T extends Pick<ApiResponse, "ResponseCode" | "ResponseText">>(
  response: T,
  operation: string,
): T {
  if (response.ResponseCode !== "00") {
    throw new Error(`${operation} was refused with code ${response.ResponseCode}`);
  }
  return response;
}

export function exactEnv(name: string, pattern: RegExp): string {
  const value = requiredEnv(name);
  if (!pattern.test(value)) throw new Error(`${name} is invalid`);
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function requireExplicitUploadConfirmation(): void {
  if (process.env.ISECURE_CONFIRM_MANUAL_UPLOAD !== UPLOAD_CONFIRMATION) {
    throw new Error(`Set ISECURE_CONFIRM_MANUAL_UPLOAD=${UPLOAD_CONFIRMATION} for this one upload attempt`);
  }
}

export async function publicRsaKey(): Promise<string> {
  const configuredPath = process.env.ISECURE_PUBLIC_KEY_PEM_FILE;
  if (configuredPath) return readFile(path.resolve(configuredPath), "utf8");
  return requiredEnv("ISECURE_PUBLIC_KEY_PEM");
}

export async function channelClients(publicKey: string): Promise<ChannelClients> {
  const shared: Partial<IWSChannel> = {
    Bank: requiredEnv("ISECURE_BANK"),
    BaseUrl: requiredEnv("ISECURE_BASE_URL"),
    PublicKey: publicKey,
  };
  const admin = new WSChannel(configFromEnv({ ...shared, Mode: "admin" }));
  const data = new WSChannel(configFromEnv({ ...shared, Mode: "data" }));
  await authenticate(admin);
  await authenticate(data);
  return { admin, data };
}

function bootstrapAuthentication(channel: WSChannel): ProcessingBootstrapAuthentication {
  const { apiKey, idToken } = channel.session;
  if (!apiKey || !idToken || channel.isSessionExpired()) {
    throw new Error("A current ISECure REST session is required for Processing session exchange");
  }
  return { apiKey, idToken };
}

export async function processingClient(channel: WSChannel): Promise<Iso20022Client> {
  const transport = new Iso20022HttpTransport({
    baseUrl: requiredEnv("ISECURE_PROCESSING_BASE_URL"),
    bootstrapAuthentication: () => bootstrapAuthentication(channel),
    processingAudience: requiredEnv("ISECURE_PROCESSING_AUDIENCE"),
    maxResponseBytes: 16 * 1_024 * 1_024,
    timeoutMs: 30_000,
  });
  await transport.exchangeProcessingSession();
  return createIso20022Client(transport);
}

function admittedProfile(
  profiles: readonly PaymentExportProfileCatalogEntry[],
  bankProfileId: string,
): PaymentExportProfileCatalogEntry {
  const matches = profiles.filter((profile) => profile.bank_profile_id === bankProfileId);
  if (matches.length !== 1) throw new Error("The selected bank profile is not uniquely admitted");
  const profile = matches[0];
  if (profile === undefined) throw new Error("The selected bank profile is unavailable");
  if (profile.availability_status !== "available" || profile.message_definition !== PAIN_001) {
    throw new Error("The selected bank profile is unavailable or does not render pain.001.001.09");
  }
  if (profile.qualification_status === "none") throw new Error("The selected bank profile is not qualified");
  if (profile.qualification_status === "experimental" && process.env.ISECURE_CONFIRM_EXPERIMENTAL_PROFILE !== "1") {
    throw new Error("The selected bank profile is experimental; set ISECURE_CONFIRM_EXPERIMENTAL_PROFILE=1");
  }
  if (
    profile.qualification_status === "qualified_with_limitations" &&
    process.env.ISECURE_CONFIRM_PROFILE_LIMITATIONS !== "1"
  ) {
    throw new Error("The selected bank profile has limitations; set ISECURE_CONFIRM_PROFILE_LIMITATIONS=1");
  }
  return profile;
}

function executionDate(): string {
  const configured = process.env.ISECURE_REQUESTED_EXECUTION_DATE;
  if (configured) {
    if (!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(configured)) {
      throw new Error("ISECURE_REQUESTED_EXECUTION_DATE must use YYYY-MM-DD");
    }
    return configured;
  }
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  return tomorrow.toISOString().slice(0, 10);
}

export async function createApprovedExport(
  submitter: Iso20022Client,
  approver: Iso20022Client,
  runId: string,
): Promise<{ readonly authority: PaymentExportContentAuthority; readonly paymentExportId: string }> {
  const bankProfileId = requiredEnv("ISECURE_BANK_PROFILE_ID");
  const catalog = await submitter.paymentExportProfiles.list();
  const profile = admittedProfile(catalog.profiles, bankProfileId);
  const channelBank = requiredEnv("ISECURE_BANK").toLowerCase();
  if (
    channelBank !== profile.bank_id.toLowerCase() &&
    !(channelBank === "simulator" && process.env.ISECURE_CONFIRM_SIMULATOR_PROFILE_BRIDGE === "1")
  ) {
    throw new Error("The selected export profile does not match the ISECure bank connection");
  }
  const debtorCountry = exactEnv("ISECURE_DEBTOR_COUNTRY", COUNTRY_CODE);
  if (profile.country_code !== debtorCountry) throw new Error("The bank profile country does not match the debtor");

  const configured = await submitter.paymentExportProfiles.configure(
    {
      bank_profile_id: profile.bank_profile_id,
      debtor_account_identifier: requiredEnv("ISECURE_DEBTOR_IBAN"),
      debtor_account_scheme: "iban",
      debtor_account_currency: "EUR",
      initiating_party_name: requiredEnv("ISECURE_INITIATING_PARTY_NAME"),
      initiating_party_customer_id: requiredEnv("ISECURE_INITIATING_PARTY_CUSTOMER_ID"),
      debtor_name: requiredEnv("ISECURE_DEBTOR_NAME"),
      debtor_bank_agreement_id: requiredEnv("ISECURE_DEBTOR_BANK_AGREEMENT_ID"),
      debtor_country_code: debtorCountry,
      debtor_agent_bic: exactEnv("ISECURE_DEBTOR_AGENT_BIC", BIC),
    },
    { idempotencyKey: `${runId}-configure-profile` },
  );
  if (configured.payment_export_profile.state !== "active") throw new Error("The export profile is not active");

  const requestedExecutionDate = executionDate();
  const amount = exactEnv("ISECURE_PAYMENT_AMOUNT", EXACT_AMOUNT);
  const creditorCountry = exactEnv("ISECURE_CREDITOR_COUNTRY", COUNTRY_CODE);
  const capability = await submitter.paymentCapabilities.resolve({
    connected_account_id: configured.payment_export_profile.debtor_account_id,
    business_type: "credit_transfer",
    currency: "EUR",
    destination_country_code: creditorCountry,
    requested_execution_date: requestedExecutionDate,
    transfer_count: 1,
    total_money: { amount, currency: "EUR" },
    required_option_kinds: [],
  });
  if (capability.outcome !== "resolved" || !capability.selected) {
    throw new Error("No exact payment capability was resolved");
  }

  const created = await submitter.paymentBatches.createDraft(
    {
      capability: capability.selected,
      external_id: runId,
      requested_execution_date: requestedExecutionDate,
      options: [],
      transfers: [
        {
          external_id: `${runId}-transfer-1`,
          money: { amount, currency: "EUR" },
          creditor: {
            name: requiredEnv("ISECURE_CREDITOR_NAME"),
            identifiers: [],
            postal_address: {
              country_code: creditorCountry,
              town_name: requiredEnv("ISECURE_CREDITOR_TOWN"),
              address_lines: [requiredEnv("ISECURE_CREDITOR_ADDRESS_LINE")],
            },
          },
          creditor_account: { account_type: "iban", iban: requiredEnv("ISECURE_CREDITOR_IBAN") },
          creditor_agent: { agent_type: "bic", bic: exactEnv("ISECURE_CREDITOR_AGENT_BIC", BIC) },
          remittance: {
            remittance_type: "unstructured",
            text_lines: [requiredEnv("ISECURE_REMITTANCE_TEXT")],
          },
          options: [],
        },
      ],
    },
    { idempotencyKey: `${runId}-create-draft` },
  );
  if (created.workflow_state !== "draft" || created.resource_version !== "1") {
    throw new Error("The Processing API did not return a new draft");
  }
  const paymentOrderId = created.payment_order_reference.resource_id;
  const validated = await submitter.paymentBatches.validate({
    payment_order_id: paymentOrderId,
    revision_id: created.revision_id,
  });
  if (validated.validation.outcome !== "valid") throw new Error("The payment batch is not valid");

  const finalized = await submitter.paymentBatches.finalize(
    { payment_order_id: paymentOrderId },
    { idempotencyKey: `${runId}-finalize`, expectedResourceVersion: "1" },
  );
  if (finalized.mutation.workflow_state !== "finalized" || finalized.mutation.resource_version !== "2") {
    throw new Error("The payment batch was not finalized");
  }
  const submitted = await submitter.paymentBatches.submitForReview(
    { payment_order_id: paymentOrderId },
    { idempotencyKey: `${runId}-submit-review`, expectedResourceVersion: "2" },
  );
  const pendingExport = submitted.payment_export;
  const approvalRequest = submitted.approval_request;
  if (
    submitted.workflow_state !== "review_pending" ||
    submitted.approval_state !== "pending" ||
    !pendingExport ||
    !approvalRequest
  ) {
    throw new Error("The payment batch did not produce a pending export approval");
  }
  if (approvalRequest.approval_subject.exact_subject_digest !== pendingExport.exact_approval_subject_digest) {
    throw new Error("The approval request is not bound to the prepared export");
  }

  const decision = await approver.paymentApprovalRequests.decide(
    {
      payment_approval_request_id: approvalRequest.payment_approval_request_id,
      exact_subject_digest: pendingExport.exact_approval_subject_digest,
      decision: "approve",
      reason_code: optionalEnv("ISECURE_APPROVAL_REASON_CODE", "manual_example_approval"),
    },
    { idempotencyKey: `${runId}-approve`, expectedResourceVersion: "1" },
  );
  if (decision.state !== "approved") throw new Error("The separate approval was not accepted");

  const released = await submitter.paymentExports.release(
    {
      payment_export_id: pendingExport.payment_export_id,
      exact_approval_subject_digest: pendingExport.exact_approval_subject_digest,
    },
    { idempotencyKey: `${runId}-release`, expectedResourceVersion: "2" },
  );
  if (released.payment_export.state !== "released") throw new Error("The approved export was not released");
  const authority: PaymentExportContentAuthority = {
    artifact_id: released.payment_export.artifact_id,
    artifact_digest: released.payment_export.artifact_digest,
    artifact_byte_length: released.payment_export.artifact_byte_length,
    artifact_media_type: released.payment_export.artifact_media_type,
  };
  return { authority, paymentExportId: released.payment_export.payment_export_id };
}

export async function signingMaterial(): Promise<SigningMaterial> {
  const armoredPublicKey = await readFile(path.resolve(requiredEnv("ISECURE_PGP_PUBLIC_KEY_FILE")), "utf8");
  const armoredPrivateKey = await readFile(path.resolve(requiredEnv("ISECURE_PGP_PRIVATE_KEY_FILE")), "utf8");
  const publicKey = await openpgp.readKey({ armoredKey: armoredPublicKey });
  let privateKey = await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey });
  if (!privateKey.isDecrypted()) {
    privateKey = await openpgp.decryptKey({
      privateKey,
      passphrase: requiredEnv("ISECURE_PGP_PRIVATE_KEY_PASSPHRASE"),
    });
  }
  requireMatchingKeys(publicKey, privateKey);
  return { armoredPublicKey, privateKey, publicKey };
}

export async function ensureAuthorizeKey(admin: WSChannel, material: SigningMaterial): Promise<void> {
  const keyId = material.publicKey.getKeyID().toHex().slice(-8).toUpperCase();
  const listed = assertSuccess(await admin.listKeys(), "list OpenPGP keys");
  const exists = listed.PgpKeys.some(
    (key) => key.PgpKeyPurpose === "authorize" && key.PgpKeyId.toUpperCase() === keyId,
  );
  if (!exists) assertSuccess(await admin.uploadPgpKey(material.armoredPublicKey, "authorize"), "upload OpenPGP key");
  const verified = assertSuccess(await admin.listKeys(), "verify OpenPGP key");
  if (!verified.PgpKeys.some((key) => key.PgpKeyPurpose === "authorize" && key.PgpKeyId.toUpperCase() === keyId)) {
    throw new Error("The authorize OpenPGP key is unavailable");
  }
}

async function main(): Promise<void> {
  const runId = exactEnv("ISECURE_EXAMPLE_RUN_ID", RUN_ID);
  requireExplicitUploadConfirmation();
  const channels = await channelClients(await publicRsaKey());
  const submitterMode = optionalEnv("ISECURE_PROCESSING_SUBMITTER_MODE", "admin");
  const approverMode = optionalEnv("ISECURE_PROCESSING_APPROVER_MODE", "data");
  if (
    (submitterMode !== "admin" && submitterMode !== "data") ||
    (approverMode !== "admin" && approverMode !== "data") ||
    submitterMode === approverMode
  ) {
    throw new Error("Processing submitter and approver modes must be distinct admin/data identities");
  }
  const submitter = await processingClient(channels[submitterMode]);
  const approver = await processingClient(channels[approverMode]);
  const pending = await createApprovedExport(submitter, approver, runId);
  const downloaded = await submitter.paymentBatches.download(
    { payment_export_id: pending.paymentExportId },
    pending.authority,
    { idempotencyKey: `${runId}-download` },
  );
  requirePain001(downloaded.bytes);

  const material = await signingMaterial();
  await ensureAuthorizeKey(channels.admin, material);
  const signature = await detachedSignature(downloaded.bytes, material.publicKey, material.privateKey);
  uploadAttemptStarted = true;
  await uploadPain001Once(channels.data, downloaded.bytes, signature, runId);
  console.log("Approved Processing export was integrity-verified, signed, and accepted by ISECure REST for upload.");
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error(
      uploadAttemptStarted
        ? "Manual Processing-to-ISECure upload stopped after the upload attempt began. Do not retry until an authorized operator reconciles it."
        : "Manual Processing-to-ISECure workflow stopped before upload; no bank upload was attempted.",
    );
    process.exitCode = 1;
  });
}
