import {
  iso20022Operations,
  type AppendPaymentOrderTransfersInput,
  type BalanceGetResult,
  type BalanceListInput,
  type BalanceListResult,
  type EntryGetResult,
  type EntryListInput,
  type EntryListResult,
  type ExplanationResult,
  type ObservationExplainInput,
  type ObservationGetInput,
  type PaymentCapabilityCriteria,
  type PaymentCapabilityGetInput,
  type PaymentCapabilityGetResult,
  type PaymentCapabilityListInput,
  type PaymentCapabilityListResult,
  type PaymentCapabilityResolution,
  type ConfigurePaymentExportProfileInput,
  type DecidePaymentApprovalRequestInput,
  type DownloadPaymentExportContentInput,
  type PaymentApprovalDecisionResult,
  type PaymentExportGetInput,
  type PaymentExportGetResult,
  type PaymentExportProfileCatalogListInput,
  type PaymentExportProfileCatalogListResult,
  type PaymentExportProfileGetInput,
  type PaymentExportProfileResult,
  type PaymentExportReleaseResult,
  type PaymentExecutionAttemptGetInput,
  type PaymentExecutionAttemptGetResult,
  type PaymentExecutionAttemptListInput,
  type PaymentExecutionAttemptListResult,
  type PaymentExecutionConnectorObservationInput,
  type PaymentExecutionConnectorObservationResult,
  type PaymentExecutionFulfillmentClaimInput,
  type PaymentExecutionFulfillmentResult,
  type PaymentOrderDraftInput,
  type PaymentOrderExecuteResult,
  type PaymentOrderFinalizationResult,
  type PaymentOrderGetInput,
  type PaymentOrderGetResult,
  type PaymentOrderListInput,
  type PaymentOrderListResult,
  type PaymentOrderMutationResult,
  type PaymentOrderOutcomeGetInput,
  type PaymentOrderOutcomeGetResult,
  type PaymentOrderOutcomeListInput,
  type PaymentOrderOutcomeListResult,
  type PaymentOrderReviewSubmissionResult,
  type PaymentOrderRevisionInput,
  type PaymentOrderSimulationResult,
  type PaymentOrderTransitionInput,
  type PaymentOrderValidationResult,
  type ProcessingCommandOptions,
  type ProcessingRequestMetadata,
  type ProcessingRevisionCommandOptions,
  type ReleasePaymentExportInput,
  type RemovePaymentOrderTransfersInput,
  type RevokePaymentExportProfileInput,
  type RevisePaymentOrderInput,
  type RevisePaymentOrderTransferInput,
  type StatementGetResult,
  type StatementListInput,
  type StatementListResult,
  type TransactionGetResult,
  type TransactionListInput,
  type TransactionListResult,
  type ValidationGetResult,
  type ValidationListInput,
  type ValidationListResult,
} from "../generated/iso20022-contracts.js";
import type {
  Iso20022Transport,
  PaymentExportContentAuthority,
  PaymentExportContentSink,
  VerifiedPaymentExportContent,
  VerifiedPaymentExportContentMetadata,
} from "./transport.js";

/**
 * Creates the experimental ISO 20022 observation and payment surface.
 *
 * The methods are a thin projection of the generated platform operations. All
 * authorization, qualification, validation, lineage, and financial semantics
 * remain server-side. Command options only carry generated idempotency and
 * optimistic-concurrency metadata.
 */
export function createIso20022Client(transport: Iso20022Transport) {
  const paymentFileDownload = {
    download: (
      input: DownloadPaymentExportContentInput,
      authority: PaymentExportContentAuthority,
      options: ProcessingCommandOptions,
    ): Promise<VerifiedPaymentExportContent> =>
      transport.downloadPaymentExport(input, commandMetadata("payment_exports.download_content", options), authority),
    downloadTo: (
      input: DownloadPaymentExportContentInput,
      authority: PaymentExportContentAuthority,
      sink: PaymentExportContentSink,
      options: ProcessingCommandOptions,
    ): Promise<VerifiedPaymentExportContentMetadata> =>
      transport.downloadPaymentExportTo(
        input,
        commandMetadata("payment_exports.download_content", options),
        authority,
        sink,
      ),
  } as const;

  const paymentBatches = {
    addPayments: (input: AppendPaymentOrderTransfersInput, options: ProcessingRevisionCommandOptions) =>
      invoke<AppendPaymentOrderTransfersInput, PaymentOrderMutationResult>(
        transport,
        "payment_orders.append_transfers",
        input,
        options,
      ),
    cancelDraft: (input: PaymentOrderTransitionInput, options: ProcessingRevisionCommandOptions) =>
      invoke<PaymentOrderTransitionInput, PaymentOrderMutationResult>(
        transport,
        "payment_orders.cancel_draft",
        input,
        options,
      ),
    createCorrection: (input: PaymentOrderTransitionInput, options: ProcessingRevisionCommandOptions) =>
      invoke<PaymentOrderTransitionInput, PaymentOrderMutationResult>(
        transport,
        "payment_orders.correct",
        input,
        options,
      ),
    createDraft: (input: PaymentOrderDraftInput, options: ProcessingCommandOptions) =>
      invoke<PaymentOrderDraftInput, PaymentOrderMutationResult>(
        transport,
        "payment_orders.create_draft",
        input,
        options,
      ),
    ...paymentFileDownload,
    explain: (input: PaymentOrderGetInput) =>
      invoke<PaymentOrderGetInput, ExplanationResult>(transport, "payment_orders.explain", input),
    finalize: (input: PaymentOrderTransitionInput, options: ProcessingRevisionCommandOptions) =>
      invoke<PaymentOrderTransitionInput, PaymentOrderFinalizationResult>(
        transport,
        "payment_orders.finalize_draft",
        input,
        options,
      ),
    get: (input: PaymentOrderGetInput) =>
      invoke<PaymentOrderGetInput, PaymentOrderGetResult>(transport, "payment_orders.get", input),
    list: (input: PaymentOrderListInput) =>
      invoke<PaymentOrderListInput, PaymentOrderListResult>(transport, "payment_orders.list", input),
    removePayments: (input: RemovePaymentOrderTransfersInput, options: ProcessingRevisionCommandOptions) =>
      invoke<RemovePaymentOrderTransfersInput, PaymentOrderMutationResult>(
        transport,
        "payment_orders.remove_transfers",
        input,
        options,
      ),
    replaceDraft: (input: RevisePaymentOrderInput, options: ProcessingRevisionCommandOptions) =>
      invoke<RevisePaymentOrderInput, PaymentOrderMutationResult>(
        transport,
        "payment_orders.revise_draft",
        input,
        options,
      ),
    simulate: (input: PaymentOrderRevisionInput) =>
      invoke<PaymentOrderRevisionInput, PaymentOrderSimulationResult>(transport, "payment_orders.simulate", input),
    submitForReview: (input: PaymentOrderTransitionInput, options: ProcessingRevisionCommandOptions) =>
      invoke<PaymentOrderTransitionInput, PaymentOrderReviewSubmissionResult>(
        transport,
        "payment_orders.submit_for_review",
        input,
        options,
      ),
    updatePayment: (input: RevisePaymentOrderTransferInput, options: ProcessingRevisionCommandOptions) =>
      invoke<RevisePaymentOrderTransferInput, PaymentOrderMutationResult>(
        transport,
        "payment_orders.revise_transfer",
        input,
        options,
      ),
    validate: (input: PaymentOrderRevisionInput) =>
      invoke<PaymentOrderRevisionInput, PaymentOrderValidationResult>(transport, "payment_orders.validate", input),
  } as const;

  const paymentSubmissions = {
    claim: (input: PaymentExecutionFulfillmentClaimInput, options: ProcessingCommandOptions) =>
      invoke<PaymentExecutionFulfillmentClaimInput, PaymentExecutionFulfillmentResult>(
        transport,
        "payment_execution_fulfillments.claim",
        input,
        options,
      ),
    createAttempt: (input: PaymentOrderTransitionInput, options: ProcessingRevisionCommandOptions) =>
      invoke<PaymentOrderTransitionInput, PaymentOrderExecuteResult>(
        transport,
        "payment_orders.execute",
        input,
        options,
      ),
    ...paymentFileDownload,
    explain: (input: PaymentExecutionAttemptGetInput) =>
      invoke<PaymentExecutionAttemptGetInput, ExplanationResult>(
        transport,
        "payment_execution_attempts.explain",
        input,
      ),
    get: (input: PaymentExecutionAttemptGetInput) =>
      invoke<PaymentExecutionAttemptGetInput, PaymentExecutionAttemptGetResult>(
        transport,
        "payment_execution_attempts.get",
        input,
      ),
    list: (input: PaymentExecutionAttemptListInput) =>
      invoke<PaymentExecutionAttemptListInput, PaymentExecutionAttemptListResult>(
        transport,
        "payment_execution_attempts.list",
        input,
      ),
    reportUpload: (input: PaymentExecutionConnectorObservationInput, options: ProcessingCommandOptions) =>
      invoke<PaymentExecutionConnectorObservationInput, PaymentExecutionConnectorObservationResult>(
        transport,
        "payment_execution_observations.report",
        input,
        options,
      ),
  } as const;

  const paymentOutcomes = {
    explain: (input: PaymentOrderOutcomeGetInput) =>
      invoke<PaymentOrderOutcomeGetInput, ExplanationResult>(transport, "payment_order_outcomes.explain", input),
    get: (input: PaymentOrderOutcomeGetInput) =>
      invoke<PaymentOrderOutcomeGetInput, PaymentOrderOutcomeGetResult>(transport, "payment_order_outcomes.get", input),
    list: (input: PaymentOrderOutcomeListInput) =>
      invoke<PaymentOrderOutcomeListInput, PaymentOrderOutcomeListResult>(
        transport,
        "payment_order_outcomes.list",
        input,
      ),
  } as const;

  return {
    balances: {
      explain: (input: ObservationExplainInput) =>
        invoke<ObservationExplainInput, ExplanationResult>(transport, "balances.explain", input),
      get: (input: ObservationGetInput) =>
        invoke<ObservationGetInput, BalanceGetResult>(transport, "balances.get", input),
      list: (input: BalanceListInput) => invoke<BalanceListInput, BalanceListResult>(transport, "balances.list", input),
    },
    entries: {
      explain: (input: ObservationExplainInput) =>
        invoke<ObservationExplainInput, ExplanationResult>(transport, "entries.explain", input),
      get: (input: ObservationGetInput) => invoke<ObservationGetInput, EntryGetResult>(transport, "entries.get", input),
      list: (input: EntryListInput) => invoke<EntryListInput, EntryListResult>(transport, "entries.list", input),
    },
    paymentApprovalRequests: {
      decide: (input: DecidePaymentApprovalRequestInput, options: ProcessingRevisionCommandOptions) =>
        invoke<DecidePaymentApprovalRequestInput, PaymentApprovalDecisionResult>(
          transport,
          "payment_approval_requests.decide",
          input,
          options,
        ),
    },
    paymentCapabilities: {
      explain: (input: PaymentCapabilityGetInput) =>
        invoke<PaymentCapabilityGetInput, ExplanationResult>(transport, "payment_capabilities.explain", input),
      get: (input: PaymentCapabilityGetInput) =>
        invoke<PaymentCapabilityGetInput, PaymentCapabilityGetResult>(transport, "payment_capabilities.get", input),
      list: (input: PaymentCapabilityListInput) =>
        invoke<PaymentCapabilityListInput, PaymentCapabilityListResult>(transport, "payment_capabilities.list", input),
      resolve: (input: PaymentCapabilityCriteria) =>
        invoke<PaymentCapabilityCriteria, PaymentCapabilityResolution>(
          transport,
          "payment_capabilities.resolve",
          input,
        ),
    },
    paymentExportProfiles: {
      list: (input: PaymentExportProfileCatalogListInput = {}) =>
        invoke<PaymentExportProfileCatalogListInput, PaymentExportProfileCatalogListResult>(
          transport,
          "payment_export_profile_catalog.list",
          input,
        ),
      configure: (input: ConfigurePaymentExportProfileInput, options: ProcessingCommandOptions) =>
        invoke<ConfigurePaymentExportProfileInput, PaymentExportProfileResult>(
          transport,
          "payment_export_profiles.configure",
          input,
          options,
        ),
      get: (input: PaymentExportProfileGetInput = {}) =>
        invoke<PaymentExportProfileGetInput, PaymentExportProfileResult>(
          transport,
          "payment_export_profiles.get",
          input,
        ),
      revoke: (input: RevokePaymentExportProfileInput, options: ProcessingRevisionCommandOptions) =>
        invoke<RevokePaymentExportProfileInput, PaymentExportProfileResult>(
          transport,
          "payment_export_profiles.revoke",
          input,
          options,
        ),
    },
    paymentBatches,
    paymentExports: {
      ...paymentFileDownload,
      get: (input: PaymentExportGetInput) =>
        invoke<PaymentExportGetInput, PaymentExportGetResult>(transport, "payment_exports.get", input),
      release: (input: ReleasePaymentExportInput, options: ProcessingRevisionCommandOptions) =>
        invoke<ReleasePaymentExportInput, PaymentExportReleaseResult>(
          transport,
          "payment_exports.release",
          input,
          options,
        ),
    },
    paymentOutcomes,
    /** Compatibility aliases; prefer the plain-English paymentBatches and paymentSubmissions namespaces. */
    paymentOrders: {
      ...paymentBatches,
      execute: paymentSubmissions.createAttempt,
      finalizeDraft: paymentBatches.finalize,
      reviseDraft: paymentBatches.replaceDraft,
    },
    paymentSubmissions,
    statements: {
      explain: (input: ObservationExplainInput) =>
        invoke<ObservationExplainInput, ExplanationResult>(transport, "statements.explain", input),
      get: (input: ObservationGetInput) =>
        invoke<ObservationGetInput, StatementGetResult>(transport, "statements.get", input),
      list: (input: StatementListInput) =>
        invoke<StatementListInput, StatementListResult>(transport, "statements.list", input),
    },
    transactions: {
      explain: (input: ObservationExplainInput) =>
        invoke<ObservationExplainInput, ExplanationResult>(transport, "transactions.explain", input),
      get: (input: ObservationGetInput) =>
        invoke<ObservationGetInput, TransactionGetResult>(transport, "transactions.get", input),
      list: (input: TransactionListInput) =>
        invoke<TransactionListInput, TransactionListResult>(transport, "transactions.list", input),
    },
    validations: {
      explain: (input: ObservationExplainInput) =>
        invoke<ObservationExplainInput, ExplanationResult>(transport, "validations.explain", input),
      get: (input: ObservationGetInput) =>
        invoke<ObservationGetInput, ValidationGetResult>(transport, "validations.get", input),
      list: (input: ValidationListInput) =>
        invoke<ValidationListInput, ValidationListResult>(transport, "validations.list", input),
    },
  } as const;
}

export type Iso20022Client = ReturnType<typeof createIso20022Client>;

function invoke<Input, Result>(
  transport: Iso20022Transport,
  operationId: keyof typeof iso20022Operations,
  input: Input,
  options: Omit<ProcessingRequestMetadata, "contractVersion"> = {},
): Promise<Result> {
  const metadata: ProcessingRequestMetadata = {
    contractVersion: iso20022Operations[operationId].version,
    ...options,
  };
  return transport.invoke<Input, Result>(operationId, input, metadata);
}

function commandMetadata(
  operationId: keyof typeof iso20022Operations,
  options: Omit<ProcessingRequestMetadata, "contractVersion">,
): ProcessingRequestMetadata {
  return {
    contractVersion: iso20022Operations[operationId].version,
    ...options,
  };
}
