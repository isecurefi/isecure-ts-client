// GENERATED FILE: DO NOT EDIT.
// source: isecurefi/bankfiles-platform@2e782970f64bb2b6b1b534bbe653b1518d80d73c
// model: Bankfiles@0.94.0
// source-digest: sha256:0bb6d73f8e69e6ab9f32c42adfe24cb4a00a40f1df5624953d9d07f608ae83b9
// Exact decimals and 64-bit integers are JSON decimal strings.

export type ApprovalDecisionKind = "approve" | "reject";

export type BalanceBoundary = "opening" | "closing" | "intraday" | "available" | "expected" | "forward_available" | "other";

export type CashReportKind = "camt_052" | "camt_053" | "camt_054";

export type DebitCredit = "debit" | "credit";

export type IntegrityOutcome = "succeeded" | "failed" | "indeterminate" | "quarantined";

export type TemporalPrecision = "date" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond";

export type ProcessingRunKind = "detect" | "transform" | "parse" | "validate" | "map" | "render" | "project" | "reconcile";

export type ProfileResolutionOutcome = "selected" | "no_match" | "ambiguous" | "rejected" | "human_resolved";

export type TaskState = "queued" | "running" | "succeeded" | "failed" | "indeterminate" | "cancelled";

export type AccountCapabilityAvailability = "available" | "pending" | "unavailable" | "expired" | "uncertain";

export type CancellationBoundary = "preventable" | "race_possible" | "irreversible";

export type IdempotencyOutcome = "applied" | "replayed" | "in_progress" | "mismatch" | "expired";

export type OperationIssueCategory = "validation" | "authorization" | "policy" | "conflict" | "unsupported" | "external" | "internal";

export type OperationIssueSeverity = "error" | "warning" | "information";

export type PaymentAccountScheme = "iban" | "domestic";

export type PaymentApprovalBundleState = "not_required" | "pending" | "partially_approved" | "approved" | "rejected" | "expired" | "superseded";

export type PaymentApprovalRequestState = "pending" | "partially_approved" | "approved" | "rejected" | "expired" | "cancelled" | "superseded";

export type PaymentApprovalSubjectKind = "order_revision" | "transfer_revision" | "export_preparation";

export type PaymentAuthorizationState = "not_required" | "pending" | "partially_satisfied" | "satisfied" | "rejected" | "expired" | "cancelled" | "indeterminate";

export type PaymentBankOutcomeState = "not_observed" | "pending" | "accepted" | "partially_accepted" | "rejected" | "settled" | "partially_settled" | "returned" | "reversed" | "indeterminate" | "contradictory";

export type PaymentBatchBookingMode = "separate" | "combined" | "provider_choice";

export type PaymentBusinessType = "credit_transfer";

export type PaymentCapabilityResolutionOutcome = "resolved" | "unsupported" | "not_ready" | "ambiguous" | "expired" | "uncertain";

export type PaymentChargeBearer = "shared" | "debtor" | "creditor" | "service_level";

export type PaymentDestinationScope = "domestic" | "cross_border" | "any_qualified";

export type PaymentExecutionSummaryState = "not_started" | "planned" | "in_progress" | "completed" | "failed" | "indeterminate" | "cancelled";

export type PaymentExportProfileAvailabilityStatus = "available" | "unavailable";

export type PaymentExportProfileLifecycleState = "active" | "revoked";

export type PaymentExportProfileQualificationStatus = "none" | "experimental" | "qualified_with_limitations" | "qualified";

export type PaymentExportState = "pending_approval" | "approved" | "rejected" | "invalidated" | "released";

export type PaymentGroupingFeasibility = "feasible" | "infeasible" | "indeterminate";

export type PaymentOptionKind = "batch_booking" | "category_purpose" | "service_level" | "local_instrument" | "charge_bearer" | "purpose" | "priority" | "advice" | "regulatory_reporting";

export type PaymentOrderWorkflowState = "draft" | "finalized" | "review_pending" | "ready_for_execution" | "execution_pending" | "closed" | "cancelled";

export type PaymentPriority = "normal" | "high" | "express";

export type PaymentRecoveryKind = "select_capability" | "revise_order" | "complete_approval" | "complete_strong_authentication" | "wait_for_outcome" | "investigate_indeterminate" | "request_recall";

export type PaymentRemittanceKind = "none" | "unstructured" | "structured_creditor_reference" | "structured_document";

export type PaymentValidationOutcome = "not_evaluated" | "valid" | "invalid" | "indeterminate";

export interface BalanceGetResult {
    readonly context: OperationContext;
    readonly balance: BalanceResource;
}

export interface BalanceListInput {
    readonly bank_account_id?: string;
    readonly balance_type_code?: string;
    readonly currency?: string;
    readonly balance_date_from?: string;
    readonly balance_date_to?: string;
    readonly page_size?: number;
    readonly cursor?: string;
}

export interface BalanceListResult {
    readonly context: OperationContext;
    readonly balances: readonly BalanceResource[];
    readonly page: PageResult;
}

export interface BalanceResource {
    readonly balance_id: string;
    readonly balance_type_code: string;
    readonly balance_subtype_code?: string;
    readonly proprietary_type_code?: string;
    readonly money: ObservedMoney;
    readonly balance_date?: string;
    readonly balance_instant?: string;
    readonly temporal_precision: TemporalPrecision;
    readonly boundary: BalanceBoundary;
}

export interface EntryGetResult {
    readonly context: OperationContext;
    readonly entry: EntryResource;
}

export interface EntryListInput {
    readonly bank_account_id?: string;
    readonly status_code?: string;
    readonly debit_credit?: DebitCredit;
    readonly currency?: string;
    readonly booking_date_from?: string;
    readonly booking_date_to?: string;
    readonly page_size?: number;
    readonly cursor?: string;
}

export interface EntryListResult {
    readonly context: OperationContext;
    readonly entries: readonly EntryResource[];
    readonly page: PageResult;
}

export interface EntryResource {
    readonly entry_id: string;
    readonly entry_reference?: string;
    readonly money: ObservedMoney;
    readonly booking_date?: string;
    readonly booking_instant?: string;
    readonly value_date?: string;
    readonly value_instant?: string;
    readonly status_code: string;
    readonly reversal?: boolean;
    readonly bank_transaction_code?: string;
    readonly bank_transaction_domain_code?: string;
    readonly bank_transaction_family_code?: string;
    readonly bank_transaction_subfamily_code?: string;
    readonly bank_transaction_proprietary_code?: string;
    readonly bank_transaction_proprietary_issuer?: string;
}

export interface ExplanationFact {
    readonly fact_code: string;
    readonly safe_summary: string;
    readonly rule_id?: string;
    readonly evidence_references: readonly ResourceReference[];
}

export interface ExplanationResult {
    readonly context: OperationContext;
    readonly subject_reference: ResourceReference;
    readonly facts: readonly ExplanationFact[];
}

export interface ObservationExplainInput {
    readonly resource_id: string;
}

export interface ObservationGetInput {
    readonly resource_id: string;
}

export interface ObservationIssues {
    readonly issues: readonly OperationIssue[];
}

export interface ObservedMoney {
    readonly amount: string;
    readonly currency: string;
    readonly debit_credit?: DebitCredit;
}

export interface StatementGetResult {
    readonly context: OperationContext;
    readonly statement: StatementResource;
}

export interface StatementListInput {
    readonly bank_account_id?: string;
    readonly observed_from?: string;
    readonly observed_to?: string;
    readonly page_size?: number;
    readonly cursor?: string;
}

export interface StatementListResult {
    readonly context: OperationContext;
    readonly statements: readonly StatementResource[];
    readonly page: PageResult;
}

export interface StatementResource {
    readonly statement_id: string;
    readonly bank_account_id: string;
    readonly report_kind: CashReportKind;
    readonly bank_report_id: string;
    readonly bank_creation_time?: string;
    readonly observed_at: string;
    readonly period_from?: string;
    readonly period_to?: string;
}

export interface TransactionAmountResource {
    readonly transaction_amount_id: string;
    readonly amount_role: string;
    readonly amount_role_detail?: string;
    readonly money: ObservedMoney;
}

export interface TransactionGetResult {
    readonly context: OperationContext;
    readonly transaction: TransactionResource;
    readonly amounts: readonly TransactionAmountResource[];
}

export interface TransactionListInput {
    readonly bank_account_id?: string;
    readonly end_to_end_id?: string;
    readonly uetr?: string;
    readonly purpose_code?: string;
    readonly page_size?: number;
    readonly cursor?: string;
}

export interface TransactionListResult {
    readonly context: OperationContext;
    readonly transactions: readonly TransactionResource[];
    readonly page: PageResult;
}

export interface TransactionResource {
    readonly transaction_id: string;
    readonly end_to_end_id?: string;
    readonly instruction_id?: string;
    readonly uetr?: string;
    readonly account_servicer_reference?: string;
    readonly bank_transaction_code?: string;
    readonly bank_transaction_domain_code?: string;
    readonly bank_transaction_family_code?: string;
    readonly bank_transaction_subfamily_code?: string;
    readonly bank_transaction_proprietary_code?: string;
    readonly bank_transaction_proprietary_issuer?: string;
    readonly purpose_kind?: string;
    readonly purpose_code?: string;
}

export interface ValidationGetResult {
    readonly context: OperationContext;
    readonly validation: ValidationResource;
}

export interface ValidationListInput {
    readonly run_kind?: ProcessingRunKind;
    readonly outcome?: IntegrityOutcome;
    readonly started_from?: string;
    readonly started_to?: string;
    readonly page_size?: number;
    readonly cursor?: string;
}

export interface ValidationListResult {
    readonly context: OperationContext;
    readonly validations: readonly ValidationResource[];
    readonly page: PageResult;
}

export interface ValidationResource {
    readonly validation_id: string;
    readonly run_kind: ProcessingRunKind;
    readonly started_at?: string;
    readonly completed_at?: string;
    readonly outcome: IntegrityOutcome;
    readonly selected_conformance_profile_id?: string;
    readonly selected_conformance_profile_version?: number;
    readonly selected_capability_profile_id?: string;
    readonly resolution_outcome?: ProfileResolutionOutcome;
    readonly candidate_count?: number;
    readonly resolver_rule_id?: string;
    readonly resolver_rule_version?: string;
    readonly resolved_at?: string;
}

export interface ApprovalReference {
    readonly approval_request_id: string;
    readonly approval_decision_id?: string;
    readonly exact_subject_digest: string;
}

export interface AttemptReference {
    readonly attempt_type: string;
    readonly attempt_id: string;
    readonly attempt_ordinal: number;
}

export interface AuthorizationReference {
    readonly authorization_decision_id: string;
    readonly decided_at: string;
}

export interface ConfigurationAction {
    readonly configuration_code: string;
}

export interface ExactMoney {
    readonly amount: string;
    readonly currency: string;
}

export interface HumanReviewAction {
    readonly subject_reference: ResourceReference;
    readonly reason_code: string;
}

export interface IdempotencyResult {
    readonly outcome: IdempotencyOutcome;
    readonly original_request_id?: string;
    readonly retained_until: string;
}

export interface NextOperation {
    readonly operation_id: string;
    readonly target?: ResourceReference;
    readonly reason_code?: string;
}

export interface OperationContext {
    readonly request_id: string;
    readonly operation_id: string;
    readonly contract_version: string;
    readonly accepted_at: string;
    readonly resource?: ResourceReference;
    readonly attempt?: AttemptReference;
    readonly authorization: AuthorizationReference;
    readonly approval_reference?: ApprovalReference;
    readonly idempotency_result?: IdempotencyResult;
    readonly next_operations?: readonly NextOperation[];
}

export interface OperationIssue {
    readonly issue_code: string;
    readonly category: OperationIssueCategory;
    readonly severity: OperationIssueSeverity;
    readonly safe_message: string;
    readonly field_path?: string;
    readonly rule_id?: string;
    readonly retryable: boolean;
    readonly required_action?: RequiredAction;
}

export interface PageRequest {
    readonly page_size?: number;
    readonly cursor?: string;
}

export interface PageResult {
    readonly next_cursor?: string;
    readonly snapshot_reference: string;
}

export interface ResourceReference {
    readonly resource_type: string;
    readonly resource_id: string;
    readonly resource_version?: string;
    readonly revision_id?: string;
}

export interface RetryLaterAction {
    readonly retry_after_seconds: number;
}

export interface StrongAuthenticationAction {
    readonly action_reference: string;
    readonly expires_at?: string;
}

export interface TaskReference {
    readonly task_id: string;
    readonly attempt: AttemptReference;
    readonly state: TaskState;
    readonly poll_after_seconds?: number;
    readonly expires_at?: string;
    readonly cancellation_boundary: CancellationBoundary;
}

export interface BicPaymentAgent {
    readonly bic: string;
}

export interface ClearingMemberPaymentAgent {
    readonly clearing_system_id: string;
    readonly member_identifier: string;
}

export interface ConfigurePaymentExportProfileInput {
    readonly bank_profile_id: string;
    readonly debtor_account_identifier: string;
    readonly debtor_account_scheme: PaymentAccountScheme;
    readonly debtor_account_currency?: string;
    readonly initiating_party_name: string;
    readonly initiating_party_customer_id: string;
    readonly debtor_name: string;
    readonly debtor_bank_agreement_id: string;
    readonly debtor_country_code: string;
    readonly debtor_agent_bic: string;
}

export interface DecidePaymentApprovalRequestInput {
    readonly payment_approval_request_id: string;
    readonly exact_subject_digest: string;
    readonly decision: ApprovalDecisionKind;
    readonly reason_code?: string;
}

export interface DomesticPaymentAccount {
    readonly account_scheme_id: string;
    readonly account_identifier: string;
}

export interface DownloadPaymentExportContentInput {
    readonly payment_export_id: string;
}

export interface IbanPaymentAccount {
    readonly iban: string;
}

export interface PaymentAdviceOption {
    readonly advice_method_id: string;
    readonly advice_reference?: string;
}

export interface PaymentApprovalDecisionResult {
    readonly context: OperationContext;
    readonly payment_approval_request_reference: ResourceReference;
    readonly state: PaymentApprovalRequestState;
    readonly approval_reference: ApprovalReference;
    readonly issues: readonly OperationIssue[];
}

export interface PaymentApprovalRequestResource {
    readonly payment_approval_request_id: string;
    readonly resource_version: string;
    readonly payment_approval_bundle_id?: string;
    readonly approval_subject: PaymentApprovalSubject;
    readonly state: PaymentApprovalRequestState;
    readonly created_at: string;
    readonly expires_at?: string;
    readonly transitioned_at: string;
}

export interface PaymentApprovalSubject {
    readonly payment_approval_request_id: string;
    readonly subject_kind: PaymentApprovalSubjectKind;
    readonly subject_reference: ResourceReference;
    readonly exact_subject_digest: string;
    readonly required_approvals: number;
    readonly received_approvals: number;
    readonly state: PaymentApprovalRequestState;
}

export interface PaymentApprovalSummary {
    readonly bundle_id?: string;
    readonly state: PaymentApprovalBundleState;
    readonly required_approvals: number;
    readonly received_approvals: number;
    readonly exact_revision_digest?: string;
}

export interface PaymentAuthorizationSummary {
    readonly authorization_bundle_id?: string;
    readonly state: PaymentAuthorizationState;
    readonly required_action?: RequiredAction;
    readonly expires_at?: string;
}

export interface PaymentBankOutcomeSummary {
    readonly state: PaymentBankOutcomeState;
    readonly outcome_reference?: string;
    readonly observed_at?: string;
    readonly issue_codes: readonly string[];
}

export interface PaymentBatchBookingOption {
    readonly mode: PaymentBatchBookingMode;
}

export interface PaymentCapabilityCriteria {
    readonly connected_account_id: string;
    readonly business_type: PaymentBusinessType;
    readonly currency?: string;
    readonly destination_country_code?: string;
    readonly requested_execution_date?: string;
    readonly transfer_count?: number;
    readonly total_money?: ExactMoney;
    readonly required_option_kinds: readonly PaymentOptionKind[];
}

export interface PaymentCapabilityGetInput {
    readonly account_capability_id: string;
    readonly capability_revision?: string;
}

export interface PaymentCapabilityGetResult {
    readonly context: OperationContext;
    readonly capability: PaymentCapabilityResource;
}

export interface PaymentCapabilityHandle {
    readonly account_capability_id: string;
    readonly capability_revision: string;
    readonly connected_account_id: string;
}

export interface PaymentCapabilityListInput {
    readonly connected_account_id?: string;
    readonly business_type?: PaymentBusinessType;
    readonly currency?: string;
    readonly destination_country_code?: string;
    readonly effective_at?: string;
    readonly page: PageRequest;
}

export interface PaymentCapabilityListResult {
    readonly context: OperationContext;
    readonly capabilities: readonly PaymentCapabilityResource[];
    readonly page: PageResult;
}

export interface PaymentCapabilityResolution {
    readonly context: OperationContext;
    readonly outcome: PaymentCapabilityResolutionOutcome;
    readonly selected?: PaymentCapabilityHandle;
    readonly candidates: readonly PaymentCapabilityHandle[];
    readonly issues: readonly OperationIssue[];
}

export interface PaymentCapabilityResource {
    readonly handle: PaymentCapabilityHandle;
    readonly business_type: PaymentBusinessType;
    readonly variant_id: string;
    readonly availability: AccountCapabilityAvailability;
    readonly destination_scope: PaymentDestinationScope;
    readonly supported_currencies: readonly string[];
    readonly destination_country_codes: readonly string[];
    readonly account_schemes: readonly PaymentAccountScheme[];
    readonly remittance_kinds: readonly PaymentRemittanceKind[];
    readonly priorities: readonly PaymentPriority[];
    readonly option_kinds: readonly PaymentOptionKind[];
    readonly limits: readonly PaymentCapabilityLimit[];
    readonly limitation_codes: readonly string[];
    readonly effective_from: string;
    readonly effective_to?: string;
}

export interface PaymentCategoryPurposeOption {
    readonly category_purpose_id: string;
}

export interface PaymentChargeBearerOption {
    readonly charge_bearer: PaymentChargeBearer;
}

export interface PaymentCountLimit {
    readonly limit_kind_id: string;
    readonly maximum_count: number;
}

export interface PaymentCreditor {
    readonly name: string;
    readonly identifiers: readonly PaymentPartyIdentifier[];
    readonly postal_address?: PaymentPostalAddress;
}

export interface PaymentCurrencyTotal {
    readonly currency: string;
    readonly amount: string;
    readonly transfer_count: number;
}

export interface PaymentExecutionSummary {
    readonly state: PaymentExecutionSummaryState;
    readonly current_attempt?: AttemptReference;
    readonly latest_task?: TaskReference;
    readonly transitioned_at?: string;
}

export interface PaymentExportContentResult {
    readonly context: OperationContext;
    readonly artifact_id: string;
    readonly artifact_digest: string;
    readonly artifact_byte_length: string;
    readonly artifact_media_type: string;
}

export interface PaymentExportGetInput {
    readonly payment_export_id: string;
}

export interface PaymentExportGetResult {
    readonly context: OperationContext;
    readonly payment_export: PaymentExportResource;
}

export interface PaymentExportProfileCatalogEntry {
    readonly bank_profile_id: string;
    readonly bank_id: string;
    readonly bank_name: string;
    readonly country_code: string;
    readonly payment_type: string;
    readonly message_definition: string;
    readonly profile_version: number;
    readonly qualification_status: PaymentExportProfileQualificationStatus;
    readonly availability_status: PaymentExportProfileAvailabilityStatus;
}

export interface PaymentExportProfileCatalogListInput {

}

export interface PaymentExportProfileCatalogListResult {
    readonly context: OperationContext;
    readonly profiles: readonly PaymentExportProfileCatalogEntry[];
    readonly catalog_digest: string;
    readonly issues: readonly OperationIssue[];
}

export interface PaymentExportProfileGetInput {

}

export interface PaymentExportProfileResource {
    readonly payment_export_profile_id: string;
    readonly profile_revision: string;
    readonly resource_version: string;
    readonly debtor_account_id: string;
    readonly debtor_account_identifier: string;
    readonly debtor_account_scheme: PaymentAccountScheme;
    readonly debtor_account_currency?: string;
    readonly initiating_party_name: string;
    readonly initiating_party_customer_id: string;
    readonly debtor_name: string;
    readonly debtor_bank_agreement_id: string;
    readonly debtor_country_code: string;
    readonly debtor_agent_bic: string;
    readonly bank_profile_id: string;
    readonly renderer_profile_id: string;
    readonly renderer_profile_version: number;
    readonly renderer_catalog_digest: string;
    readonly qualification_contract_digest: string;
    readonly message_definition: string;
    readonly xml_namespace: string;
    readonly exact_revision_digest: string;
    readonly state: PaymentExportProfileLifecycleState;
    readonly effective_from: string;
    readonly effective_to?: string;
    readonly approved_at: string;
}

export interface PaymentExportProfileResult {
    readonly context: OperationContext;
    readonly payment_export_profile: PaymentExportProfileResource;
    readonly issues: readonly OperationIssue[];
}

export interface PaymentExportReleaseResult {
    readonly context: OperationContext;
    readonly payment_export: PaymentExportResource;
    readonly issues: readonly OperationIssue[];
}

export interface PaymentExportResource {
    readonly payment_export_id: string;
    readonly payment_order_id: string;
    readonly order_revision_id: string;
    readonly order_revision_digest: string;
    readonly payment_export_profile_id: string;
    readonly profile_revision: string;
    readonly profile_revision_digest: string;
    readonly artifact_id: string;
    readonly artifact_digest: string;
    readonly artifact_byte_length: string;
    readonly artifact_media_type: string;
    readonly approval_request_id: string;
    readonly exact_approval_subject_digest: string;
    readonly state: PaymentExportState;
    readonly prepared_at: string;
    readonly released_at?: string;
}

export interface PaymentGroupingPreview {
    readonly authoritative: boolean;
    readonly feasibility: PaymentGroupingFeasibility;
    readonly groups: readonly PaymentGroupingPreviewGroup[];
    readonly issues: readonly OperationIssue[];
}

export interface PaymentGroupingPreviewGroup {
    readonly preview_group_digest: string;
    readonly payment_transfer_ids: readonly string[];
    readonly currency_total: PaymentCurrencyTotal;
}

export interface PaymentIssues {
    readonly issues: readonly OperationIssue[];
    readonly recovery: readonly PaymentRecoveryGuidance[];
}

export interface PaymentLocalInstrumentOption {
    readonly local_instrument_id: string;
}

export interface PaymentMoneyLimit {
    readonly limit_kind_id: string;
    readonly minimum?: ExactMoney;
    readonly maximum: ExactMoney;
}

export interface PaymentOrderDraftInput {
    readonly capability: PaymentCapabilityHandle;
    readonly external_id?: string;
    readonly requested_execution_date: string;
    readonly options: readonly PaymentOrderOption[];
    readonly transfers: readonly PaymentTransferInput[];
}

export interface PaymentOrderExecuteResult {
    readonly context: OperationContext;
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly execution_attempt: AttemptReference;
    readonly task: TaskReference;
    readonly workflow_state: PaymentOrderWorkflowState;
    readonly required_actions: readonly RequiredAction[];
    readonly issues: readonly OperationIssue[];
}

export interface PaymentOrderFinalizationResult {
    readonly context: OperationContext;
    readonly mutation: PaymentOrderMutationResult;
    readonly grouping_preview: PaymentGroupingPreview;
}

export interface PaymentOrderGetInput {
    readonly payment_order_id: string;
    readonly revision_id?: string;
}

export interface PaymentOrderGetResult {
    readonly context: OperationContext;
    readonly payment_order: PaymentOrderResource;
}

export interface PaymentOrderListInput {
    readonly connected_account_id?: string;
    readonly workflow_state?: PaymentOrderWorkflowState;
    readonly validation_outcome?: PaymentValidationOutcome;
    readonly bank_outcome_state?: PaymentBankOutcomeState;
    readonly created_from?: string;
    readonly created_to?: string;
    readonly page: PageRequest;
}

export interface PaymentOrderListResult {
    readonly context: OperationContext;
    readonly payment_orders: readonly PaymentOrderSummary[];
    readonly page: PageResult;
}

export interface PaymentOrderMutationResult {
    readonly context: OperationContext;
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly revision_digest: string;
    readonly resource_version: string;
    readonly payment_transfer_ids: readonly string[];
    readonly currency_totals: readonly PaymentCurrencyTotal[];
    readonly workflow_state: PaymentOrderWorkflowState;
    readonly validation_outcome: PaymentValidationOutcome;
    readonly approval_state: PaymentApprovalBundleState;
    readonly required_actions: readonly RequiredAction[];
    readonly issues: readonly OperationIssue[];
}

export interface PaymentOrderResource {
    readonly payment_order_id: string;
    readonly resource_version: string;
    readonly revision: PaymentOrderRevision;
    readonly current_revision_id: string;
    readonly workflow_state: PaymentOrderWorkflowState;
    readonly validation: PaymentValidationSummary;
    readonly currency_totals: readonly PaymentCurrencyTotal[];
    readonly approval_summary: PaymentApprovalSummary;
    readonly authorization: PaymentAuthorizationSummary;
    readonly execution: PaymentExecutionSummary;
    readonly bank_outcome: PaymentBankOutcomeSummary;
    readonly next_operations: readonly NextOperation[];
    readonly created_at: string;
    readonly transitioned_at: string;
}

export interface PaymentOrderReviewSubmissionResult {
    readonly context: OperationContext;
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly revision_digest: string;
    readonly resource_version: string;
    readonly payment_transfer_ids: readonly string[];
    readonly currency_totals: readonly PaymentCurrencyTotal[];
    readonly workflow_state: PaymentOrderWorkflowState;
    readonly validation_outcome: PaymentValidationOutcome;
    readonly approval_state: PaymentApprovalBundleState;
    readonly required_actions: readonly RequiredAction[];
    readonly payment_export?: PaymentExportResource;
    readonly approval_request?: PaymentApprovalRequestResource;
    readonly issues: readonly OperationIssue[];
}

export interface PaymentOrderRevision {
    readonly payment_order_id: string;
    readonly revision_id: string;
    readonly revision_number: string;
    readonly revision_digest: string;
    readonly supersedes_revision_id?: string;
    readonly capability: PaymentCapabilityHandle;
    readonly external_id?: string;
    readonly requested_execution_date: string;
    readonly options: readonly PaymentOrderOption[];
    readonly transfers: readonly PaymentTransferRevision[];
    readonly created_at: string;
}

export interface PaymentOrderRevisionInput {
    readonly payment_order_id: string;
    readonly revision_id: string;
}

export interface PaymentOrderSimulationResult {
    readonly context: OperationContext;
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly predicted_workflow_state: PaymentOrderWorkflowState;
    readonly validation: PaymentValidationSummary;
    readonly predicted_approval_state: PaymentApprovalBundleState;
    readonly predicted_authorization_state: PaymentAuthorizationState;
    readonly transfers: readonly PaymentTransferValidationSummary[];
    readonly currency_totals: readonly PaymentCurrencyTotal[];
    readonly required_actions: readonly RequiredAction[];
    readonly issues: readonly OperationIssue[];
}

export interface PaymentOrderSummary {
    readonly payment_order_id: string;
    readonly resource_version: string;
    readonly current_revision_id: string;
    readonly workflow_state: PaymentOrderWorkflowState;
    readonly validation_outcome: PaymentValidationOutcome;
    readonly approval_state: PaymentApprovalBundleState;
    readonly authorization_state: PaymentAuthorizationState;
    readonly execution_state: PaymentExecutionSummaryState;
    readonly bank_outcome_state: PaymentBankOutcomeState;
    readonly transfer_count: number;
    readonly created_at: string;
    readonly transitioned_at: string;
}

export interface PaymentOrderTransitionInput {
    readonly payment_order_id: string;
}

export interface PaymentOrderValidationResult {
    readonly context: OperationContext;
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly validation: PaymentValidationSummary;
    readonly transfers: readonly PaymentTransferValidationSummary[];
    readonly currency_totals: readonly PaymentCurrencyTotal[];
    readonly required_actions: readonly RequiredAction[];
    readonly issues: readonly OperationIssue[];
}

export interface PaymentPartyIdentifier {
    readonly identifier_scheme_id: string;
    readonly identifier: string;
}

export interface PaymentPostalAddress {
    readonly country_code: string;
    readonly town_name?: string;
    readonly address_lines: readonly string[];
}

export interface PaymentPriorityOption {
    readonly priority: PaymentPriority;
}

export interface PaymentPurposeOption {
    readonly purpose_id: string;
}

export interface PaymentRecoveryGuidance {
    readonly recovery_kind: PaymentRecoveryKind;
    readonly subject_reference: ResourceReference;
    readonly required_action?: RequiredAction;
    readonly next_operations: readonly NextOperation[];
}

export interface PaymentRegulatoryReportingOption {
    readonly authority_country_code: string;
    readonly reporting_code_id: string;
    readonly reporting_information?: string;
}

export interface PaymentRemittanceDocument {
    readonly document_type_id: string;
    readonly document_reference: string;
    readonly related_date?: string;
    readonly related_amount?: ExactMoney;
}

export interface PaymentServiceLevelOption {
    readonly service_level_id: string;
}

export interface PaymentTransferInput {
    readonly external_id?: string;
    readonly money: ExactMoney;
    readonly creditor: PaymentCreditor;
    readonly creditor_account: PaymentCreditorAccount;
    readonly creditor_agent?: PaymentCreditorAgent;
    readonly remittance?: PaymentRemittance;
    readonly options: readonly PaymentTransferOption[];
}

export interface PaymentTransferRevision {
    readonly payment_transfer_id: string;
    readonly transfer_position: number;
    readonly transfer: PaymentTransferInput;
}

export interface PaymentTransferValidationSummary {
    readonly payment_transfer_id: string;
    readonly outcome: PaymentValidationOutcome;
    readonly issue_codes: readonly string[];
}

export interface PaymentValidationSummary {
    readonly outcome: PaymentValidationOutcome;
    readonly validated_revision_id: string;
    readonly issue_count: number;
    readonly validated_at: string;
}

export interface ReleasePaymentExportInput {
    readonly payment_export_id: string;
    readonly exact_approval_subject_digest: string;
}

export interface RevisePaymentOrderInput {
    readonly payment_order_id: string;
    readonly draft: PaymentOrderDraftInput;
}

export interface RevokePaymentExportProfileInput {
    readonly payment_export_profile_id: string;
    readonly profile_revision: string;
}

export interface StructuredCreditorReferenceRemittance {
    readonly reference_scheme_id: string;
    readonly reference: string;
}

export interface StructuredDocumentRemittance {
    readonly documents: readonly PaymentRemittanceDocument[];
}

export interface UnstructuredPaymentRemittance {
    readonly text_lines: readonly string[];
}

export type RequiredAction =
    (HumanReviewAction & { readonly action_type: "human_review" })
    | (StrongAuthenticationAction & { readonly action_type: "strong_authentication" })
    | (ConfigurationAction & { readonly action_type: "configuration" })
    | (RetryLaterAction & { readonly action_type: "retry_later" });

export type PaymentCapabilityLimit =
    (PaymentMoneyLimit & { readonly limit_type: "money" })
    | (PaymentCountLimit & { readonly limit_type: "count" });

export type PaymentCreditorAccount =
    (IbanPaymentAccount & { readonly account_type: "iban" })
    | (DomesticPaymentAccount & { readonly account_type: "domestic" });

export type PaymentCreditorAgent =
    (BicPaymentAgent & { readonly agent_type: "bic" })
    | (ClearingMemberPaymentAgent & { readonly agent_type: "clearing_member" });

export type PaymentOrderOption =
    (PaymentBatchBookingOption & { readonly option_type: "batch_booking" })
    | (PaymentCategoryPurposeOption & { readonly option_type: "category_purpose" })
    | (PaymentServiceLevelOption & { readonly option_type: "service_level" })
    | (PaymentLocalInstrumentOption & { readonly option_type: "local_instrument" })
    | (PaymentChargeBearerOption & { readonly option_type: "charge_bearer" });

export type PaymentRemittance =
    (UnstructuredPaymentRemittance & { readonly remittance_type: "unstructured" })
    | (StructuredCreditorReferenceRemittance & { readonly remittance_type: "structured_creditor_reference" })
    | (StructuredDocumentRemittance & { readonly remittance_type: "structured_document" });

export type PaymentTransferOption =
    (PaymentPurposeOption & { readonly option_type: "purpose" })
    | (PaymentPriorityOption & { readonly option_type: "priority" })
    | (PaymentAdviceOption & { readonly option_type: "advice" })
    | (PaymentRegulatoryReportingOption & { readonly option_type: "regulatory_reporting" });

export interface ProcessingRequestMetadata {
    readonly contractVersion: number;
    readonly idempotencyKey?: string;
    readonly expectedResourceVersion?: string;
}

export interface ProcessingCommandOptions {
    readonly idempotencyKey: string;
}

export interface ProcessingRevisionCommandOptions extends ProcessingCommandOptions {
    readonly expectedResourceVersion: string;
}

export const iso20022Operations = {
  "balances.explain": {
    "method": "GET",
    "path": "/v1/balances/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:9a23cd4786bbcccd7d5847a536ae1ec4a64974eb14672ba05a4614c4a62a9734",
    "input": "isecure.bankfiles.observations.ObservationExplainInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "balances.get": {
    "method": "GET",
    "path": "/v1/balances/{resource_id}",
    "version": 1,
    "contractDigest": "sha256:213e3f72f29fbf60192e0f6be6eaa85f9386ae6ccf78a996b7ee573d1f1eb979",
    "input": "isecure.bankfiles.observations.ObservationGetInput",
    "result": "isecure.bankfiles.observations.BalanceGetResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "balances.list": {
    "method": "GET",
    "path": "/v1/balances",
    "version": 2,
    "contractDigest": "sha256:9c35b653028dcc468bc88101df2fd639e05bc2f08cc957bada60e5ed58a733d8",
    "input": "isecure.bankfiles.observations.BalanceListInput",
    "result": "isecure.bankfiles.observations.BalanceListResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "balance_type_code",
        "location": "query",
        "inputField": "balance_type_code",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "currency",
        "location": "query",
        "inputField": "currency",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "balance_date_from",
        "location": "query",
        "inputField": "balance_date_from",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "balance_date_to",
        "location": "query",
        "inputField": "balance_date_to",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "entries.explain": {
    "method": "GET",
    "path": "/v1/entries/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:0b3180437372f28691a9c90465c2fdbcb59e85039178881c1b20eb6e534b4da8",
    "input": "isecure.bankfiles.observations.ObservationExplainInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "entries.get": {
    "method": "GET",
    "path": "/v1/entries/{resource_id}",
    "version": 1,
    "contractDigest": "sha256:e243bcce2460b84de79f7914a9dcd0957728a95dcf59ac7e324ad6b461112708",
    "input": "isecure.bankfiles.observations.ObservationGetInput",
    "result": "isecure.bankfiles.observations.EntryGetResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "entries.list": {
    "method": "GET",
    "path": "/v1/entries",
    "version": 2,
    "contractDigest": "sha256:e68cd3da6a753203a161d240ff659872c8d7a3416d281fb4ae93c03b24b55203",
    "input": "isecure.bankfiles.observations.EntryListInput",
    "result": "isecure.bankfiles.observations.EntryListResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "status_code",
        "location": "query",
        "inputField": "status_code",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "debit_credit",
        "location": "query",
        "inputField": "debit_credit",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "currency",
        "location": "query",
        "inputField": "currency",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "booking_date_from",
        "location": "query",
        "inputField": "booking_date_from",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "booking_date_to",
        "location": "query",
        "inputField": "booking_date_to",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "payment_approval_requests.decide": {
    "method": "POST",
    "path": "/v1/payment-approval-requests:decide",
    "version": 1,
    "contractDigest": "sha256:5ab90e67325ab3a39a95e29628ebaa19d29c669fcdb1e63828eaa81c6ce1b7d7",
    "input": "isecure.bankfiles.payments_api.DecidePaymentApprovalRequestInput",
    "result": "isecure.bankfiles.payments_api.PaymentApprovalDecisionResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_capabilities.explain": {
    "method": "GET",
    "path": "/v1/payment-capabilities/{account_capability_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:6fa22b380da3cbf75d8f4ea4dd930957bae7467361c05f13206192324ed4b607",
    "input": "isecure.bankfiles.payments_api.PaymentCapabilityGetInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "account_capability_id",
        "location": "path",
        "inputField": "account_capability_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      },
      {
        "name": "capability_revision",
        "location": "query",
        "inputField": "capability_revision",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "payment_capabilities.get": {
    "method": "GET",
    "path": "/v1/payment-capabilities/{account_capability_id}",
    "version": 1,
    "contractDigest": "sha256:c90346fc85073d6bb924adcfa8132bef1300c11637f17b6143986af9fdd12068",
    "input": "isecure.bankfiles.payments_api.PaymentCapabilityGetInput",
    "result": "isecure.bankfiles.payments_api.PaymentCapabilityGetResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "account_capability_id",
        "location": "path",
        "inputField": "account_capability_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      },
      {
        "name": "capability_revision",
        "location": "query",
        "inputField": "capability_revision",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "payment_capabilities.list": {
    "method": "GET",
    "path": "/v1/payment-capabilities",
    "version": 1,
    "contractDigest": "sha256:aaaaa4cc383855ab04337a4a9eef6262bb12330e8c6a2505c213e662ab706765",
    "input": "isecure.bankfiles.payments_api.PaymentCapabilityListInput",
    "result": "isecure.bankfiles.payments_api.PaymentCapabilityListResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "connected_account_id",
        "location": "query",
        "inputField": "connected_account_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "business_type",
        "location": "query",
        "inputField": "business_type",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "currency",
        "location": "query",
        "inputField": "currency",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "destination_country_code",
        "location": "query",
        "inputField": "destination_country_code",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "effective_at",
        "location": "query",
        "inputField": "effective_at",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "page",
        "location": "query",
        "inputField": "page",
        "required": true,
        "style": "deepObject",
        "objectFields": [
          "page_size",
          "cursor"
        ]
      }
    ]
  },
  "payment_capabilities.resolve": {
    "method": "POST",
    "path": "/v1/payment-capabilities:resolve",
    "version": 1,
    "contractDigest": "sha256:15dc4c7169d02a11a7334b44002298ad0726e70dddc4c6d437c42bcea04cebdf",
    "input": "isecure.bankfiles.payments_api.PaymentCapabilityCriteria",
    "result": "isecure.bankfiles.payments_api.PaymentCapabilityResolution",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_export_profile_catalog.list": {
    "method": "GET",
    "path": "/v1/payment-export-profile-catalog",
    "version": 1,
    "contractDigest": "sha256:52608f6a88fc8fe1d0c81396572590e8200f9af1689ce8a11be472e8650f7f02",
    "input": "isecure.bankfiles.payments_api.PaymentExportProfileCatalogListInput",
    "result": "isecure.bankfiles.payments_api.PaymentExportProfileCatalogListResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_export_profiles.configure": {
    "method": "POST",
    "path": "/v1/payment-export-profiles:configure",
    "version": 1,
    "contractDigest": "sha256:d1dfea42aaa194db43101014f3aba331aca6a0e44ef05f06d85c7078d8c7790b",
    "input": "isecure.bankfiles.payments_api.ConfigurePaymentExportProfileInput",
    "result": "isecure.bankfiles.payments_api.PaymentExportProfileResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "none",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": null,
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_export_profiles.get": {
    "method": "GET",
    "path": "/v1/payment-export-profiles",
    "version": 1,
    "contractDigest": "sha256:2e29d42f293d6a5dc4ca041424c2965612edc24a95eff13ac526026d3cabf064",
    "input": "isecure.bankfiles.payments_api.PaymentExportProfileGetInput",
    "result": "isecure.bankfiles.payments_api.PaymentExportProfileResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_export_profiles.revoke": {
    "method": "POST",
    "path": "/v1/payment-export-profiles:revoke",
    "version": 1,
    "contractDigest": "sha256:de9e12f5bfcc83240eee01cc7f7a894f76ccfe1df7dc8d3d18a8e5f09b82c232",
    "input": "isecure.bankfiles.payments_api.RevokePaymentExportProfileInput",
    "result": "isecure.bankfiles.payments_api.PaymentExportProfileResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_exports.download_content": {
    "method": "POST",
    "path": "/v1/payment-exports:download-content",
    "version": 1,
    "contractDigest": "sha256:c7bc845d103b087e9714cb51261a56f512520d99c5394c63c8b6ef9a65bbe4dd",
    "input": "isecure.bankfiles.payments_api.DownloadPaymentExportContentInput",
    "result": "isecure.bankfiles.payments_api.PaymentExportContentResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "none",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": null,
    "requestBody": true,
    "successResponse": {
      "kind": "binary",
      "status": 200,
      "mediaType": "application/xml",
      "maximumBytes": 16777216,
      "headers": {
        "artifactId": "ISECure-Artifact-Id",
        "artifactDigest": "ISECure-Artifact-Sha256",
        "contentLength": "Content-Length"
      }
    },
    "parameters": []
  },
  "payment_exports.get": {
    "method": "GET",
    "path": "/v1/payment-exports/{payment_export_id}",
    "version": 1,
    "contractDigest": "sha256:4948c65e5610a2b8770b63bea703263baab60e41069ef05b73dbdb8525fe2122",
    "input": "isecure.bankfiles.payments_api.PaymentExportGetInput",
    "result": "isecure.bankfiles.payments_api.PaymentExportGetResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "payment_export_id",
        "location": "path",
        "inputField": "payment_export_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "payment_exports.release": {
    "method": "POST",
    "path": "/v1/payment-exports:release",
    "version": 1,
    "contractDigest": "sha256:e572d8b0feb3eada5d396be036cf816411fc3773c8264fcb892eb90387a0b87a",
    "input": "isecure.bankfiles.payments_api.ReleasePaymentExportInput",
    "result": "isecure.bankfiles.payments_api.PaymentExportReleaseResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.cancel_draft": {
    "method": "POST",
    "path": "/v1/payment-orders:cancel-draft",
    "version": 1,
    "contractDigest": "sha256:14976041ee01abe2f7ba0a9b2294f5294976f9b497d8a43598d63a75345314ed",
    "input": "isecure.bankfiles.payments_api.PaymentOrderTransitionInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderMutationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.create_draft": {
    "method": "POST",
    "path": "/v1/payment-orders:create-draft",
    "version": 1,
    "contractDigest": "sha256:cb1ab14ad98f98172b75edd69c1a0db92371aed66beffac568c1c40c3c7f839e",
    "input": "isecure.bankfiles.payments_api.PaymentOrderDraftInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderMutationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "none",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": null,
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.execute": {
    "method": "POST",
    "path": "/v1/payment-orders:execute",
    "version": 1,
    "contractDigest": "sha256:2ffdb320acc24b98d352b0b3554335d305d1d786eafa802e8333d5f0ea3890c2",
    "input": "isecure.bankfiles.payments_api.PaymentOrderTransitionInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderExecuteResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 202,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.explain": {
    "method": "GET",
    "path": "/v1/payment-orders/{payment_order_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:67ae1c8eb3c0b955a7991d3272a4e756cfec31eddab2111befe1db401551a760",
    "input": "isecure.bankfiles.payments_api.PaymentOrderGetInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "payment_order_id",
        "location": "path",
        "inputField": "payment_order_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      },
      {
        "name": "revision_id",
        "location": "query",
        "inputField": "revision_id",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "payment_orders.finalize_draft": {
    "method": "POST",
    "path": "/v1/payment-orders:finalize-draft",
    "version": 1,
    "contractDigest": "sha256:e8c22ad4b5dae182cefa00329de60625d382371b90452890952b4aa69dcec268",
    "input": "isecure.bankfiles.payments_api.PaymentOrderTransitionInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderFinalizationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.get": {
    "method": "GET",
    "path": "/v1/payment-orders/{payment_order_id}",
    "version": 1,
    "contractDigest": "sha256:662bc78d1ba71acbca206a4004ccef039ca7a6b5bd199e4a308e48b50e21e367",
    "input": "isecure.bankfiles.payments_api.PaymentOrderGetInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderGetResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "payment_order_id",
        "location": "path",
        "inputField": "payment_order_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      },
      {
        "name": "revision_id",
        "location": "query",
        "inputField": "revision_id",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "payment_orders.list": {
    "method": "GET",
    "path": "/v1/payment-orders",
    "version": 1,
    "contractDigest": "sha256:da80266be8672929f2ee0d21973f83badd65306566c5e2434851aec37365f6ae",
    "input": "isecure.bankfiles.payments_api.PaymentOrderListInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderListResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "connected_account_id",
        "location": "query",
        "inputField": "connected_account_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "workflow_state",
        "location": "query",
        "inputField": "workflow_state",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "validation_outcome",
        "location": "query",
        "inputField": "validation_outcome",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "bank_outcome_state",
        "location": "query",
        "inputField": "bank_outcome_state",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "created_from",
        "location": "query",
        "inputField": "created_from",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "created_to",
        "location": "query",
        "inputField": "created_to",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "page",
        "location": "query",
        "inputField": "page",
        "required": true,
        "style": "deepObject",
        "objectFields": [
          "page_size",
          "cursor"
        ]
      }
    ]
  },
  "payment_orders.revise_draft": {
    "method": "POST",
    "path": "/v1/payment-orders:revise-draft",
    "version": 1,
    "contractDigest": "sha256:4f4f717f9a34ba59e99d070b02f9ccc589ea96d85c17ce3b1e037baa823112eb",
    "input": "isecure.bankfiles.payments_api.RevisePaymentOrderInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderMutationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.simulate": {
    "method": "POST",
    "path": "/v1/payment-orders:simulate",
    "version": 1,
    "contractDigest": "sha256:2b1b8f92c01c1ce001c51cad03e9b5f8b7f11eb0d2fddd6bec40b17494a25fb1",
    "input": "isecure.bankfiles.payments_api.PaymentOrderRevisionInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderSimulationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.submit_for_review": {
    "method": "POST",
    "path": "/v1/payment-orders:submit-for-review",
    "version": 1,
    "contractDigest": "sha256:a3a3e08d56f17e44a91667a1b1beb5f56ec7e07289da0d332ae2c4f193eee58d",
    "input": "isecure.bankfiles.payments_api.PaymentOrderTransitionInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderReviewSubmissionResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "required",
    "expectedVersion": "required",
    "idempotencyKeySchema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[!-~]+(?![\\s\\S])"
    },
    "expectedResourceVersionSchema": {
      "type": "string",
      "minLength": null,
      "maxLength": null,
      "pattern": "^\"(?:0|[1-9][0-9]*)\"$"
    },
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "payment_orders.validate": {
    "method": "POST",
    "path": "/v1/payment-orders:validate",
    "version": 1,
    "contractDigest": "sha256:6d91419100ea2b95abf52467f476b092fa14886eaeaa25d93556b27458d59f3e",
    "input": "isecure.bankfiles.payments_api.PaymentOrderRevisionInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderValidationResult",
    "issues": "isecure.bankfiles.payments_api.PaymentIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": true,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "statements.explain": {
    "method": "GET",
    "path": "/v1/statements/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:8634f3bf634e612ec48c6f02d41382914114226236767f60926766cb4ab0bdc2",
    "input": "isecure.bankfiles.observations.ObservationExplainInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "statements.get": {
    "method": "GET",
    "path": "/v1/statements/{resource_id}",
    "version": 1,
    "contractDigest": "sha256:cd1e305749c6edc8790468ff3a55deffee411c50f43e1f16aa915dc7ce20197e",
    "input": "isecure.bankfiles.observations.ObservationGetInput",
    "result": "isecure.bankfiles.observations.StatementGetResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "statements.list": {
    "method": "GET",
    "path": "/v1/statements",
    "version": 1,
    "contractDigest": "sha256:ea7b9634ff6c58dcc8179f0918b8ba03e97580ad41003a8180241094f95ec2c8",
    "input": "isecure.bankfiles.observations.StatementListInput",
    "result": "isecure.bankfiles.observations.StatementListResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "observed_from",
        "location": "query",
        "inputField": "observed_from",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "observed_to",
        "location": "query",
        "inputField": "observed_to",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "transactions.explain": {
    "method": "GET",
    "path": "/v1/transactions/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:1ac123ec35f79340a86bf8a8fa6bd3033e4efd5b12dd18f498f869d8da5f1123",
    "input": "isecure.bankfiles.observations.ObservationExplainInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "transactions.get": {
    "method": "GET",
    "path": "/v1/transactions/{resource_id}",
    "version": 1,
    "contractDigest": "sha256:2d7e9781bb688c6a4a89542ab09cd9f80933a9eab6f38b2287d618434b0c44ae",
    "input": "isecure.bankfiles.observations.ObservationGetInput",
    "result": "isecure.bankfiles.observations.TransactionGetResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "transactions.list": {
    "method": "GET",
    "path": "/v1/transactions",
    "version": 2,
    "contractDigest": "sha256:0a79f8c673b89f35529e6bdf7a32ab35c4c81e537a32ab67d6694ee6ffb15fc2",
    "input": "isecure.bankfiles.observations.TransactionListInput",
    "result": "isecure.bankfiles.observations.TransactionListResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "end_to_end_id",
        "location": "query",
        "inputField": "end_to_end_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "uetr",
        "location": "query",
        "inputField": "uetr",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "purpose_code",
        "location": "query",
        "inputField": "purpose_code",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  },
  "validations.explain": {
    "method": "GET",
    "path": "/v1/validations/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:22d55330cfba44ff7a3b5b8fed9a2a5799945c33c6f93132ba89ca7897a2e40a",
    "input": "isecure.bankfiles.observations.ObservationExplainInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "validations.get": {
    "method": "GET",
    "path": "/v1/validations/{resource_id}",
    "version": 1,
    "contractDigest": "sha256:a206e8d12a5b6cf9c17cfcc4840865d22390139ee5f018e6050f8890c4b688c1",
    "input": "isecure.bankfiles.observations.ObservationGetInput",
    "result": "isecure.bankfiles.observations.ValidationGetResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "validations.list": {
    "method": "GET",
    "path": "/v1/validations",
    "version": 1,
    "contractDigest": "sha256:e0322ef33c1b7f47fd627295df16b91074e4d257a96ac2a699ab2c7ad8787d40",
    "input": "isecure.bankfiles.observations.ValidationListInput",
    "result": "isecure.bankfiles.observations.ValidationListResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "idempotency": "none",
    "expectedVersion": "none",
    "idempotencyKeySchema": null,
    "expectedResourceVersionSchema": null,
    "requestBody": false,
    "successResponse": {
      "kind": "json",
      "status": 200,
      "mediaType": "application/json"
    },
    "parameters": [
      {
        "name": "run_kind",
        "location": "query",
        "inputField": "run_kind",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "outcome",
        "location": "query",
        "inputField": "outcome",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "started_from",
        "location": "query",
        "inputField": "started_from",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "started_to",
        "location": "query",
        "inputField": "started_to",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false,
        "style": "form",
        "objectFields": []
      }
    ]
  }
} as const;

export type Iso20022OperationId = keyof typeof iso20022Operations;
