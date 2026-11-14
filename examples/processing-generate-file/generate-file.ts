import { createHash } from "node:crypto";
import { WSChannel } from "../../src/index.js";
import {
  createIso20022Client,
  Iso20022HttpTransport,
  type GeneratedPaymentFileContent,
  type Iso20022Client,
  type PaymentExportProfileResource,
  type PaymentOrderFinalizationResult,
} from "../../src/iso20022/index.js";
import { authenticate, configFromEnv, requiredEnv } from "../shared/auth.js";

const PAIN_001_ROOT = /^\s*<\?xml[^>]*\?>\s*<Document\s[^>]*xmlns="urn:iso:std:iso:20022:tech:xsd:pain\.001\.001\.09"/u;
const EXACT_AMOUNT = /^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/u;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/u;

/** One synthetic transfer; every value comes from the operator's environment, never from a default. */
export interface GenerationInputs {
  readonly runId: string;
  readonly bankProfileId: string;
  readonly debtor: {
    readonly iban: string;
    readonly name: string;
    readonly agentBic: string;
    readonly countryCode: string;
    readonly bankAgreementId: string;
    readonly initiatingPartyName: string;
    readonly initiatingPartyCustomerId: string;
  };
  readonly creditor: {
    readonly iban: string;
    readonly name: string;
    readonly agentBic: string;
    readonly countryCode: string;
    readonly townName: string;
    readonly addressLine: string;
  };
  readonly amount: string;
  readonly remittanceText: string;
  readonly requestedExecutionDate: string;
}

export function inputsFromEnv(): GenerationInputs {
  const runId = requiredEnv("ISECURE_EXAMPLE_RUN_ID");
  const amount = requiredEnv("ISECURE_PAYMENT_AMOUNT");
  const date = requiredEnv("ISECURE_REQUESTED_EXECUTION_DATE");
  if (!RUN_ID.test(runId)) throw new Error("ISECURE_EXAMPLE_RUN_ID must be a short identifier");
  if (!EXACT_AMOUNT.test(amount)) throw new Error("ISECURE_PAYMENT_AMOUNT must be an exact decimal amount");
  if (!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(date))
    throw new Error("ISECURE_REQUESTED_EXECUTION_DATE must use YYYY-MM-DD");
  return {
    runId,
    bankProfileId: requiredEnv("ISECURE_BANK_PROFILE_ID"),
    debtor: {
      iban: requiredEnv("ISECURE_DEBTOR_IBAN"),
      name: requiredEnv("ISECURE_DEBTOR_NAME"),
      agentBic: requiredEnv("ISECURE_DEBTOR_AGENT_BIC"),
      countryCode: requiredEnv("ISECURE_DEBTOR_COUNTRY"),
      bankAgreementId: requiredEnv("ISECURE_DEBTOR_BANK_AGREEMENT_ID"),
      initiatingPartyName: requiredEnv("ISECURE_INITIATING_PARTY_NAME"),
      initiatingPartyCustomerId: requiredEnv("ISECURE_INITIATING_PARTY_CUSTOMER_ID"),
    },
    creditor: {
      iban: requiredEnv("ISECURE_CREDITOR_IBAN"),
      name: requiredEnv("ISECURE_CREDITOR_NAME"),
      agentBic: requiredEnv("ISECURE_CREDITOR_AGENT_BIC"),
      countryCode: requiredEnv("ISECURE_CREDITOR_COUNTRY"),
      townName: requiredEnv("ISECURE_CREDITOR_TOWN"),
      addressLine: requiredEnv("ISECURE_CREDITOR_ADDRESS_LINE"),
    },
    amount,
    remittanceText: requiredEnv("ISECURE_REMITTANCE_TEXT"),
    requestedExecutionDate: date,
  };
}

/** Deterministic unique Max35 end-to-end identifier derived from the run, as the upload example does. */
export function transferExternalId(runId: string): string {
  return `E2E-${createHash("sha256").update(runId).digest("hex").slice(0, 31)}`;
}

/** The generate-file query binds one finalized order revision to one active profile revision. */
export function generationQuery(
  paymentOrderId: string,
  finalized: PaymentOrderFinalizationResult,
  profile: PaymentExportProfileResource,
): {
  payment_order_id: string;
  order_revision_id: string;
  payment_export_profile_id: string;
  profile_revision: string;
} {
  if (finalized.mutation.workflow_state !== "finalized") throw new Error("The order is not finalized");
  if (profile.state !== "active") throw new Error("The export profile is not active");
  return {
    payment_order_id: paymentOrderId,
    order_revision_id: finalized.mutation.revision_id,
    payment_export_profile_id: profile.payment_export_profile_id,
    profile_revision: profile.profile_revision,
  };
}

/** Accept only safe pain.001.001.09 XML whose bytes match the metadata the server returned. */
export function requireVerifiedPain001(content: GeneratedPaymentFileContent): void {
  const digest = `sha256:${createHash("sha256").update(content.bytes).digest("hex")}`;
  if (content.artifact_digest !== digest || content.artifact_byte_length !== String(content.bytes.length)) {
    throw new Error("The generated file does not match its integrity metadata");
  }
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(content.bytes);
  if (!PAIN_001_ROOT.test(xml) || xml.includes("<!DOCTYPE") || xml.includes("<!ENTITY")) {
    throw new Error("The generated file is not safe pain.001.001.09 XML");
  }
}

export async function processingClient(channel: WSChannel): Promise<Iso20022Client> {
  const processingAudience = process.env.ISECURE_PROCESSING_AUDIENCE;
  const transport = new Iso20022HttpTransport({
    baseUrl: requiredEnv("ISECURE_PROCESSING_BASE_URL"),
    bootstrapAuthentication: () => {
      const { apiKey, idToken } = channel.session;
      if (!apiKey || !idToken || channel.isSessionExpired()) throw new Error("The ISECure session is not available");
      return { apiKey, idToken };
    },
    ...(processingAudience === undefined ? {} : { processingAudience }),
    maxResponseBytes: 16 * 1_024 * 1_024,
    timeoutMs: 30_000,
  });
  await transport.exchangeProcessingSession();
  return createIso20022Client(transport);
}

/**
 * Configure the profile, draft one transfer, validate, finalize and generate the exact file.
 * Drafts and revisions are stored by Processing. Nothing is approved, released or uploaded;
 * signing and bank submission happen on the File Exchange API afterwards.
 */
export async function prepareFinalizedFile(client: Iso20022Client, inputs: GenerationInputs) {
  const catalog = await client.paymentExportProfileCatalog.list();
  const admitted = catalog.profiles.find((profile) => profile.bank_profile_id === inputs.bankProfileId);
  if (admitted?.availability_status !== "available") {
    throw new Error("The selected bank profile is not available in the catalogue");
  }
  const configured = await client.paymentExportProfiles.configure(
    {
      bank_profile_id: admitted.bank_profile_id,
      debtor_account_identifier: inputs.debtor.iban,
      debtor_account_scheme: "iban",
      debtor_account_currency: "EUR",
      initiating_party_name: inputs.debtor.initiatingPartyName,
      initiating_party_customer_id: inputs.debtor.initiatingPartyCustomerId,
      debtor_name: inputs.debtor.name,
      debtor_bank_agreement_id: inputs.debtor.bankAgreementId,
      debtor_country_code: inputs.debtor.countryCode,
      debtor_agent_bic: inputs.debtor.agentBic,
    },
    { idempotencyKey: `${inputs.runId}-configure-profile` },
  );
  const profile = configured.payment_export_profile;
  const capability = await client.paymentCapabilities.resolve({
    connected_account_id: profile.debtor_account_id,
    business_type: "credit_transfer",
    currency: "EUR",
    destination_country_code: inputs.creditor.countryCode,
    requested_execution_date: inputs.requestedExecutionDate,
    transfer_count: 1,
    total_money: { amount: inputs.amount, currency: "EUR" },
    required_option_kinds: [],
  });
  if (capability.outcome !== "resolved" || !capability.selected)
    throw new Error("No exact payment capability was resolved");
  const draftInput: Parameters<Iso20022Client["paymentBatches"]["createDraft"]>[0] = {
    capability: capability.selected,
    external_id: inputs.runId,
    requested_execution_date: inputs.requestedExecutionDate,
    options: [],
    transfers: [
      {
        external_id: transferExternalId(inputs.runId),
        money: { amount: inputs.amount, currency: "EUR" },
        creditor: {
          name: inputs.creditor.name,
          identifiers: [],
          postal_address: {
            country_code: inputs.creditor.countryCode,
            town_name: inputs.creditor.townName,
            address_lines: [inputs.creditor.addressLine],
          },
        },
        creditor_account: { account_type: "iban", iban: inputs.creditor.iban },
        creditor_agent: { agent_type: "bic", bic: inputs.creditor.agentBic },
        remittance: { remittance_type: "unstructured", text_lines: [inputs.remittanceText] },
        options: [],
      },
    ],
  };
  const created = await client.paymentBatches.createDraft(draftInput, {
    idempotencyKey: `${inputs.runId}-create-draft`,
  });
  const paymentOrderId = created.payment_order_reference.resource_id;
  const validated = await client.paymentBatches.validate({
    payment_order_id: paymentOrderId,
    revision_id: created.revision_id,
  });
  if (validated.validation.outcome !== "valid") throw new Error("The payment order is not valid");
  const finalized = await client.paymentBatches.finalize(
    { payment_order_id: paymentOrderId },
    { idempotencyKey: `${inputs.runId}-finalize`, expectedResourceVersion: JSON.stringify(created.resource_version) },
  );
  return { profile, created, finalized, draftInput, query: generationQuery(paymentOrderId, finalized, profile) };
}

export async function generateFinalizedFile(
  client: Iso20022Client,
  inputs: GenerationInputs,
): Promise<GeneratedPaymentFileContent> {
  const prepared = await prepareFinalizedFile(client, inputs);
  const content = await client.paymentBatches.generateFile(prepared.query);
  requireVerifiedPain001(content);
  return content;
}

async function main(): Promise<void> {
  const inputs = inputsFromEnv();
  const channel = new WSChannel(configFromEnv());
  await authenticate(channel);
  const client = await processingClient(channel);
  const content = await generateFinalizedFile(client, inputs);
  // Hand the bytes to the customer's signing and File Exchange upload step; never print them.
  console.log(
    JSON.stringify({
      byteLength: content.bytes.length,
      digest: content.artifact_digest,
      mediaType: content.artifact_media_type,
    }),
  );
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Generation failed");
    process.exitCode = 1;
  });
}
