// GENERATED FILE: DO NOT EDIT.
// source: isecurefi/bankfiles-platform@3795299a2a506b27bc17c69ffbffad9cd3647f9f
// model: Bankfiles@0.104.0
// source-digest: sha256:c147608d5514c3e3d3586becb62ca13d13cb9326134a50df5878a9235fbbcde0
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

export type PaymentExecutionObservationOutcome = "submitted" | "refused" | "indeterminate";

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

export type PaymentExecutionFulfillmentState = "awaiting_claim" | "claimed" | "submitted" | "refused" | "indeterminate" | "expired";

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

export type PaymentTransferOutcomeState = "not_observed" | "pending" | "accepted" | "rejected" | "settled" | "returned" | "reversed" | "indeterminate" | "contradictory";

export type PaymentValidationOutcome = "not_evaluated" | "valid" | "invalid" | "indeterminate";

export type SimulationArtifactAccessMode = "file_exchange";

export type SimulationArtifactRole = "input" | "status_report" | "debit_credit_notification" | "statement" | "validation_report";

export type SimulationBehaviorScope = "synthetic_only";

export type SimulationClockControlKind = "pause" | "use_real_time_pacing" | "set_acceleration" | "step_duration" | "step_event" | "advance_to_instant";

export type SimulationClockMode = "paused" | "real_time" | "accelerated";

export type SimulationDataAdmissionMode = "synthetic";

export type SimulationEventKind = "run_accepted" | "payment_accepted" | "payment_rejected" | "payment_booked" | "payment_returned" | "payment_reversed" | "artifact_produced" | "clock_advanced" | "run_completed" | "run_indeterminate";

export type SimulationFaultKind = "duplicate_evidence" | "out_of_order_evidence" | "missing_response" | "malformed_response" | "timeout_after_acceptance" | "contradictory_status";

export type SimulationFileDirection = "customer_to_bank" | "bank_to_customer";

export type SimulationRunState = "accepted" | "running" | "paused" | "succeeded" | "failed" | "indeterminate" | "cancelled";

export type SimulationRuntimeAvailability = "contract_only";

export type SimulationRuntimeTimeZone = "utc" | "europe_helsinki" | "europe_tallinn" | "europe_stockholm" | "europe_oslo" | "europe_copenhagen" | "europe_berlin";

export type SimulationRuntimeWeekendRule = "saturday_and_sunday";

export type SimulationScenarioOutcome = "accept" | "reject" | "partially_reject" | "delay" | "return" | "reverse" | "cancel" | "indeterminate";

export type SimulationScenarioState = "draft" | "active" | "superseded";

export type SimulationTopologySubjectKind = "bank" | "legal_entity" | "account" | "currency" | "counterparty";

export type SimulationWorkspaceResetScope = "runtime_state" | "runtime_state_and_balances" | "runtime_state_balances_and_active_scenarios";

export type SimulationWorkspaceState = "draft" | "active" | "suspended" | "closed";

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

export interface LifecycleTransition {
    readonly transition_id: string;
    readonly transition_ordinal: number;
    readonly from_state?: string;
    readonly to_state: string;
    readonly reason_code: string;
    readonly occurred_at: string;
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

export interface PlatformIssues {
    readonly issues: readonly OperationIssue[];
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

export interface AppendPaymentOrderTransfersInput {
    readonly payment_order_id: string;
    readonly transfers: readonly PaymentTransferInput[];
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

export interface PaymentExecutionArtifactBinding {
    readonly payment_export_id: string;
    readonly release_id: string;
    readonly artifact_id: string;
    readonly artifact_digest: string;
    readonly artifact_byte_length: string;
    readonly artifact_media_type: string;
}

export interface PaymentExecutionAttemptGetInput {
    readonly execution_attempt_id: string;
}

export interface PaymentExecutionAttemptGetResult {
    readonly context: OperationContext;
    readonly execution_attempt: PaymentExecutionAttemptResource;
}

export interface PaymentExecutionAttemptListInput {
    readonly payment_order_id?: string;
    readonly state?: PaymentExecutionSummaryState;
    readonly page: PageRequest;
}

export interface PaymentExecutionAttemptListResult {
    readonly context: OperationContext;
    readonly execution_attempts: readonly PaymentExecutionAttemptResource[];
    readonly page: PageResult;
}

export interface PaymentExecutionAttemptResource {
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly attempt: AttemptReference;
    readonly state: PaymentExecutionSummaryState;
    readonly task: TaskReference;
    readonly fulfillment: PaymentExecutionFulfillmentResource;
    readonly connector_observation?: PaymentExecutionConnectorObservationResource;
    readonly authorization_state: PaymentAuthorizationState;
    readonly bank_outcome_state: PaymentBankOutcomeState;
    readonly started_at?: string;
    readonly completed_at?: string;
    readonly issue_codes: readonly string[];
}

export interface PaymentExecutionConnectorBinding {
    readonly connector_id: string;
    readonly connector_configuration_revision: string;
    readonly connector_configuration_digest: string;
    readonly connector_type_id: string;
    readonly plugin_version: string;
    readonly package_digest: string;
    readonly manifest_digest: string;
    readonly required_credential_evidence_digest?: string;
}

export interface PaymentExecutionConnectorObservationInput {
    readonly execution_attempt_id: string;
    readonly fulfillment_claim_id: string;
    readonly outcome: PaymentExecutionObservationOutcome;
    readonly provider_reference?: string;
    readonly signing_key_fingerprint?: string;
    readonly declared_credential_evidence_digest?: string;
}

export interface PaymentExecutionConnectorObservationResource {
    readonly connector_observation_id: string;
    readonly execution_attempt_id: string;
    readonly fulfillment_claim_id: string;
    readonly outcome: PaymentExecutionObservationOutcome;
    readonly provider_reference?: string;
    readonly signing_key_fingerprint?: string;
    readonly declared_credential_evidence_digest?: string;
    readonly observed_at: string;
}

export interface PaymentExecutionConnectorObservationResult {
    readonly context: OperationContext;
    readonly fulfillment: PaymentExecutionFulfillmentResource;
    readonly observation: PaymentExecutionConnectorObservationResource;
    readonly issues: readonly OperationIssue[];
}

export interface PaymentExecutionFulfillmentClaimInput {
    readonly execution_attempt_id: string;
}

export interface PaymentExecutionFulfillmentResource {
    readonly fulfillment_id: string;
    readonly attempt: AttemptReference;
    readonly state: PaymentExecutionFulfillmentState;
    readonly artifact: PaymentExecutionArtifactBinding;
    readonly connector: PaymentExecutionConnectorBinding;
    readonly fulfillment_claim_id?: string;
    readonly created_at: string;
    readonly claim_expires_at: string;
    readonly claimed_at?: string;
    readonly observed_at?: string;
}

export interface PaymentExecutionFulfillmentResult {
    readonly context: OperationContext;
    readonly fulfillment: PaymentExecutionFulfillmentResource;
    readonly issues: readonly OperationIssue[];
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
    readonly fulfillment: PaymentExecutionFulfillmentResource;
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

export interface PaymentOrderOutcomeGetInput {
    readonly payment_order_outcome_id: string;
}

export interface PaymentOrderOutcomeGetResult {
    readonly context: OperationContext;
    readonly payment_order_outcome: PaymentOrderOutcomeResource;
}

export interface PaymentOrderOutcomeListInput {
    readonly payment_order_id?: string;
    readonly bank_outcome_state?: PaymentBankOutcomeState;
    readonly observed_from?: string;
    readonly observed_to?: string;
    readonly page: PageRequest;
}

export interface PaymentOrderOutcomeListResult {
    readonly context: OperationContext;
    readonly payment_order_outcomes: readonly PaymentOrderOutcomeSummary[];
    readonly page: PageResult;
}

export interface PaymentOrderOutcomeResource {
    readonly payment_order_outcome_id: string;
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly bank_outcome: PaymentBankOutcomeSummary;
    readonly transfer_outcomes: readonly PaymentTransferOutcomeSummary[];
    readonly evidence_references: readonly ResourceReference[];
    readonly observed_at: string;
}

export interface PaymentOrderOutcomeSummary {
    readonly payment_order_outcome_id: string;
    readonly payment_order_reference: ResourceReference;
    readonly revision_id: string;
    readonly bank_outcome_state: PaymentBankOutcomeState;
    readonly transfer_outcome_count: number;
    readonly observed_at: string;
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

export interface PaymentTransferOutcomeSummary {
    readonly payment_transfer_id: string;
    readonly state: PaymentTransferOutcomeState;
    readonly bank_reference?: string;
    readonly observed_at?: string;
    readonly issue_codes: readonly string[];
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

export interface RemovePaymentOrderTransfersInput {
    readonly payment_order_id: string;
    readonly payment_transfer_ids: readonly string[];
}

export interface RevisePaymentOrderInput {
    readonly payment_order_id: string;
    readonly draft: PaymentOrderDraftInput;
}

export interface RevisePaymentOrderTransferInput {
    readonly payment_order_id: string;
    readonly payment_transfer_id: string;
    readonly transfer: PaymentTransferInput;
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

export interface ControlSimulationClockInput {
    readonly workspace_reference: ResourceReference;
    readonly branch_reference?: ResourceReference;
    readonly expected_clock_revision: string;
    readonly control_kind: SimulationClockControlKind;
    readonly acceleration_multiplier?: string;
    readonly step_seconds?: string;
    readonly advance_to_virtual_instant?: string;
}

export interface CreateSimulationBranchInput {
    readonly checkpoint_reference: ResourceReference;
    readonly scenario_revision_reference: ResourceReference;
}

export interface CreateSimulationCheckpointInput {
    readonly run_reference: ResourceReference;
    readonly expected_resource_version: string;
}

export interface CreateSimulationScenarioInput {
    readonly workspace_revision_reference: ResourceReference;
    readonly scenario_profile_id: string;
    readonly scenario_profile_version: string;
    readonly name: string;
    readonly directives: readonly SimulationScenarioDirective[];
}

export interface CreateSimulationWorkspaceInput {
    readonly capability_reference: ResourceReference;
    readonly data_admission_mode: SimulationDataAdmissionMode;
    readonly topology: SimulationTopology;
    readonly service_setup: SimulationServiceSetup;
}

export interface ResetSimulationWorkspaceInput {
    readonly workspace_reference: ResourceReference;
    readonly branch_reference?: ResourceReference;
    readonly expected_resource_version: string;
    readonly reset_scope: SimulationWorkspaceResetScope;
    readonly reason_code: string;
}

export interface ReviseSimulationScenarioInput {
    readonly scenario_reference: ResourceReference;
    readonly expected_resource_version: string;
    readonly scenario_profile_id: string;
    readonly scenario_profile_version: string;
    readonly name: string;
    readonly directives: readonly SimulationScenarioDirective[];
}

export interface ReviseSimulationWorkspaceInput {
    readonly workspace_reference: ResourceReference;
    readonly expected_resource_version: string;
    readonly capability_reference: ResourceReference;
    readonly data_admission_mode: SimulationDataAdmissionMode;
    readonly topology: SimulationTopology;
    readonly service_setup: SimulationServiceSetup;
}

export interface SimulationArtifactListInput {
    readonly run_reference: ResourceReference;
    readonly role?: SimulationArtifactRole;
    readonly page: PageRequest;
}

export interface SimulationArtifactListResult {
    readonly context: OperationContext;
    readonly artifacts: readonly SimulationArtifactReference[];
    readonly page: PageResult;
}

export interface SimulationArtifactReference {
    readonly artifact_reference: ResourceReference;
    readonly file_exchange_occurrence_reference: ResourceReference;
    readonly role: SimulationArtifactRole;
    readonly media_type: string;
    readonly schema_namespace?: string;
    readonly profile_id: string;
    readonly profile_version: string;
    readonly produced_at_virtual_instant?: string;
}

export interface SimulationBranchResource {
    readonly branch_id: string;
    readonly parent_checkpoint_reference: ResourceReference;
    readonly scenario_revision_reference: ResourceReference;
    readonly initial_run_reference?: ResourceReference;
    readonly created_at: string;
}

export interface SimulationBranchResult {
    readonly context: OperationContext;
    readonly branch: SimulationBranchResource;
}

export interface SimulationCapability {
    readonly capability_id: string;
    readonly capability_version: string;
    readonly available_data_admission_modes: readonly SimulationDataAdmissionMode[];
    readonly clock_modes: readonly SimulationClockMode[];
    readonly profile_capabilities: readonly SimulationProfileCapability[];
    readonly runtime_policy_profiles: readonly SimulationRuntimePolicyProfile[];
    readonly quota: SimulationQuota;
    readonly exact_artifact_access: SimulationArtifactAccessMode;
    readonly runtime_availability: SimulationRuntimeAvailability;
    readonly behavior_scope: SimulationBehaviorScope;
}

export interface SimulationCapabilityListInput {
    readonly data_admission_mode?: SimulationDataAdmissionMode;
    readonly page: PageRequest;
}

export interface SimulationCapabilityListResult {
    readonly context: OperationContext;
    readonly capabilities: readonly SimulationCapability[];
    readonly page: PageResult;
}

export interface SimulationCheckpointResource {
    readonly checkpoint_id: string;
    readonly run_reference: ResourceReference;
    readonly checkpoint_ordinal: number;
    readonly clock: SimulationClockSnapshot;
    readonly pending_event_count: number;
    readonly created_at: string;
}

export interface SimulationCheckpointResult {
    readonly context: OperationContext;
    readonly checkpoint: SimulationCheckpointResource;
}

export interface SimulationClockControlResult {
    readonly context: OperationContext;
    readonly clock: SimulationClockSnapshot;
    readonly lifecycle: LifecycleTransition;
}

export interface SimulationClockSnapshot {
    readonly clock_revision: string;
    readonly mode: SimulationClockMode;
    readonly virtual_instant: string;
    readonly acceleration_multiplier?: string;
    readonly next_event_instant?: string;
    readonly pending_event_count: number;
}

export interface SimulationEventListInput {
    readonly workspace_reference: ResourceReference;
    readonly run_reference?: ResourceReference;
    readonly event_kind?: SimulationEventKind;
    readonly page: PageRequest;
}

export interface SimulationEventListResult {
    readonly context: OperationContext;
    readonly events: readonly SimulationEventResource[];
    readonly page: PageResult;
}

export interface SimulationEventResource {
    readonly event_id: string;
    readonly event_sequence: string;
    readonly event_kind: SimulationEventKind;
    readonly workspace_reference: ResourceReference;
    readonly run_reference?: ResourceReference;
    readonly subject_reference?: ResourceReference;
    readonly artifact_references: readonly SimulationArtifactReference[];
    readonly reason_code?: string;
    readonly virtual_occurred_at?: string;
    readonly recorded_at: string;
}

export interface SimulationExactArtifactInput {
    readonly artifact: SimulationArtifactReference;
}

export interface SimulationFileServicePermission {
    readonly permission_key: string;
    readonly connection_key: string;
    readonly file_type_code: string;
    readonly direction: SimulationFileDirection;
    readonly message_namespace: string;
    readonly profile_id: string;
    readonly profile_version: string;
}

export interface SimulationLifecycleTransition {
    readonly transition_id: string;
    readonly transition_ordinal: number;
    readonly from_state?: SimulationRunState;
    readonly to_state: SimulationRunState;
    readonly reason_code: string;
    readonly virtual_occurred_at?: string;
    readonly recorded_at: string;
}

export interface SimulationPaymentOrderInput {
    readonly payment_order_revision_reference: ResourceReference;
}

export interface SimulationProfileCapability {
    readonly profile_id: string;
    readonly profile_version: string;
    readonly message_namespace: string;
    readonly accepted_input_media_types: readonly string[];
    readonly generated_output_media_types: readonly string[];
}

export interface SimulationQuota {
    readonly maximum_banks: number;
    readonly maximum_legal_entities: number;
    readonly maximum_accounts: number;
    readonly maximum_counterparties: number;
    readonly maximum_currencies: number;
    readonly maximum_scenarios: number;
    readonly maximum_runs: number;
    readonly maximum_artifacts_per_run: number;
    readonly maximum_pending_events: number;
    readonly maximum_agreements: number;
    readonly maximum_service_users: number;
    readonly maximum_certificates: number;
    readonly maximum_connections: number;
    readonly maximum_file_permissions: number;
    readonly maximum_schedules: number;
    readonly maximum_cutoffs: number;
    readonly maximum_acceleration_multiplier: string;
    readonly maximum_step_seconds: string;
}

export interface SimulationResourceGetInput {
    readonly resource_reference: ResourceReference;
}

export interface SimulationRunGetResult {
    readonly context: OperationContext;
    readonly run: SimulationRunResource;
}

export interface SimulationRunListInput {
    readonly workspace_reference: ResourceReference;
    readonly scenario_reference?: ResourceReference;
    readonly state?: SimulationRunState;
    readonly page: PageRequest;
}

export interface SimulationRunListResult {
    readonly context: OperationContext;
    readonly runs: readonly SimulationRunResource[];
    readonly page: PageResult;
}

export interface SimulationRunMutationResult {
    readonly context: OperationContext;
    readonly task: TaskReference;
    readonly run: SimulationRunResource;
}

export interface SimulationRunResource {
    readonly run_id: string;
    readonly resource_version: string;
    readonly revision_id: string;
    readonly revision_number: string;
    readonly state: SimulationRunState;
    readonly workspace_revision_reference: ResourceReference;
    readonly scenario_revision_reference: ResourceReference;
    readonly branch_reference?: ResourceReference;
    readonly data_admission_mode: SimulationDataAdmissionMode;
    readonly input: SimulationRunInput;
    readonly clock: SimulationClockSnapshot;
    readonly input_artifacts: readonly SimulationArtifactReference[];
    readonly output_artifacts: readonly SimulationArtifactReference[];
    readonly transitions: readonly SimulationLifecycleTransition[];
    readonly simulator_release_reference: ResourceReference;
    readonly accepted_at: string;
    readonly completed_at?: string;
}

export interface SimulationRuntimeCurrencyPolicy {
    readonly currency: string;
    readonly booking_cutoff: SimulationRuntimePolicyLocalTime;
    readonly fixed_charge: ExactMoney;
}

export interface SimulationRuntimeFxRate {
    readonly source_currency: string;
    readonly target_currency: string;
    readonly target_units_per_source_unit: string;
}

export interface SimulationRuntimePolicyLocalTime {
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
}

export interface SimulationRuntimePolicyProfile {
    readonly runtime_policy_profile_id: string;
    readonly runtime_policy_profile_version: string;
    readonly calendar_profile_id: string;
    readonly calendar_profile_version: string;
    readonly holiday_release_id: string;
    readonly holiday_release_version: string;
    readonly holiday_release_digest_algorithm: string;
    readonly holiday_release_digest: string;
    readonly business_timezone: SimulationRuntimeTimeZone;
    readonly calendar_valid_from: string;
    readonly calendar_valid_until: string;
    readonly weekend_rule: SimulationRuntimeWeekendRule;
    readonly holiday_dates: readonly string[];
    readonly currency_policies: readonly SimulationRuntimeCurrencyPolicy[];
    readonly directional_fx_pairs: readonly SimulationRuntimeFxPair[];
}

export interface SimulationRuntimeUnsupportedFxPair {
    readonly source_currency: string;
    readonly target_currency: string;
    readonly reason_code: string;
}

export interface SimulationScenarioDirective {
    readonly directive_ordinal: number;
    readonly outcome: SimulationScenarioOutcome;
    readonly fault_kind?: SimulationFaultKind;
    readonly target_reference?: SimulationTopologyReference;
    readonly scheduled_virtual_instant?: string;
    readonly delay_seconds?: string;
    readonly reason_code?: string;
}

export interface SimulationScenarioGetResult {
    readonly context: OperationContext;
    readonly scenario: SimulationScenarioResource;
}

export interface SimulationScenarioListInput {
    readonly workspace_reference: ResourceReference;
    readonly state?: SimulationScenarioState;
    readonly page: PageRequest;
}

export interface SimulationScenarioListResult {
    readonly context: OperationContext;
    readonly scenarios: readonly SimulationScenarioResource[];
    readonly page: PageResult;
}

export interface SimulationScenarioMutationResult {
    readonly context: OperationContext;
    readonly scenario: SimulationScenarioResource;
    readonly lifecycle: LifecycleTransition;
}

export interface SimulationScenarioResource {
    readonly scenario_id: string;
    readonly resource_version: string;
    readonly revision_id: string;
    readonly revision_number: string;
    readonly state: SimulationScenarioState;
    readonly workspace_revision_reference: ResourceReference;
    readonly scenario_profile_id: string;
    readonly scenario_profile_version: string;
    readonly name: string;
    readonly directives: readonly SimulationScenarioDirective[];
    readonly created_at: string;
}

export interface SimulationServiceCutoffDefinition {
    readonly cutoff_key: string;
    readonly permission_key: string;
    readonly cutoff_profile_id: string;
    readonly cutoff_profile_version: string;
    readonly business_timezone: string;
    readonly currency?: string;
}

export interface SimulationServiceScheduleDefinition {
    readonly schedule_key: string;
    readonly permission_key: string;
    readonly schedule_profile_id: string;
    readonly schedule_profile_version: string;
    readonly business_timezone: string;
}

export interface SimulationServiceSetup {
    readonly agreements: readonly SyntheticBankAgreementDefinition[];
    readonly users: readonly SyntheticWebServicesUserDefinition[];
    readonly certificates: readonly SyntheticCertificateDefinition[];
    readonly connections: readonly SyntheticBankConnectionDefinition[];
    readonly file_permissions: readonly SimulationFileServicePermission[];
    readonly schedules: readonly SimulationServiceScheduleDefinition[];
    readonly cutoffs: readonly SimulationServiceCutoffDefinition[];
}

export interface SimulationTopology {
    readonly banks: readonly SyntheticBankDefinition[];
    readonly legal_entities: readonly SyntheticLegalEntityDefinition[];
    readonly currencies: readonly SyntheticCurrencyDefinition[];
    readonly accounts: readonly SyntheticAccountDefinition[];
    readonly counterparties: readonly SyntheticCounterpartyDefinition[];
}

export interface SimulationTopologyReference {
    readonly subject_kind: SimulationTopologySubjectKind;
    readonly subject_key: string;
}

export interface SimulationWorkspaceGetResult {
    readonly context: OperationContext;
    readonly workspace: SimulationWorkspaceResource;
}

export interface SimulationWorkspaceListInput {
    readonly state?: SimulationWorkspaceState;
    readonly page: PageRequest;
}

export interface SimulationWorkspaceListResult {
    readonly context: OperationContext;
    readonly workspaces: readonly SimulationWorkspaceResource[];
    readonly page: PageResult;
}

export interface SimulationWorkspaceMutationResult {
    readonly context: OperationContext;
    readonly workspace: SimulationWorkspaceResource;
    readonly lifecycle: LifecycleTransition;
}

export interface SimulationWorkspaceResetResource {
    readonly reset_id: string;
    readonly source_workspace_revision_reference: ResourceReference;
    readonly result_workspace_revision_reference: ResourceReference;
    readonly reset_scope: SimulationWorkspaceResetScope;
    readonly reason_code: string;
    readonly superseded_scenario_revision_references: readonly ResourceReference[];
    readonly recorded_at: string;
}

export interface SimulationWorkspaceResetResult {
    readonly context: OperationContext;
    readonly workspace: SimulationWorkspaceResource;
    readonly reset: SimulationWorkspaceResetResource;
    readonly lifecycle: LifecycleTransition;
}

export interface SimulationWorkspaceResource {
    readonly workspace_id: string;
    readonly resource_version: string;
    readonly revision_id: string;
    readonly revision_number: string;
    readonly state: SimulationWorkspaceState;
    readonly data_admission_mode: SimulationDataAdmissionMode;
    readonly capability_reference: ResourceReference;
    readonly topology: SimulationTopology;
    readonly service_setup: SimulationServiceSetup;
    readonly created_at: string;
    readonly transitioned_at: string;
}

export interface StartSimulationRunInput {
    readonly workspace_revision_reference: ResourceReference;
    readonly scenario_revision_reference: ResourceReference;
    readonly branch_reference?: ResourceReference;
    readonly data_admission_mode: SimulationDataAdmissionMode;
    readonly input: SimulationRunInput;
}

export interface SyntheticAccountDefinition {
    readonly account_key: string;
    readonly bank_key: string;
    readonly legal_entity_key: string;
    readonly currency: string;
    readonly starting_balance: ExactMoney;
}

export interface SyntheticBankAgreementDefinition {
    readonly agreement_key: string;
    readonly bank_key: string;
    readonly legal_entity_key: string;
    readonly agreement_profile_id: string;
    readonly agreement_profile_version: string;
    readonly valid_from?: string;
    readonly valid_until?: string;
}

export interface SyntheticBankConnectionDefinition {
    readonly connection_key: string;
    readonly agreement_key: string;
    readonly user_key: string;
    readonly certificate_key: string;
    readonly connection_profile_id: string;
    readonly connection_profile_version: string;
}

export interface SyntheticBankDefinition {
    readonly bank_key: string;
    readonly display_name: string;
    readonly domicile_country: string;
    readonly runtime_policy_profile_id: string;
    readonly runtime_policy_profile_version: string;
    readonly supported_currencies: readonly string[];
}

export interface SyntheticCertificateDefinition {
    readonly certificate_key: string;
    readonly user_key: string;
    readonly certificate_profile_id: string;
    readonly certificate_profile_version: string;
    readonly valid_from: string;
    readonly valid_until: string;
}

export interface SyntheticCounterpartyDefinition {
    readonly counterparty_key: string;
    readonly display_name: string;
    readonly domicile_country: string;
    readonly settlement_account_key?: string;
}

export interface SyntheticCurrencyDefinition {
    readonly currency: string;
    readonly fraction_digits: number;
}

export interface SyntheticLegalEntityDefinition {
    readonly legal_entity_key: string;
    readonly display_name: string;
    readonly domicile_country: string;
}

export interface SyntheticWebServicesUserDefinition {
    readonly user_key: string;
    readonly agreement_key: string;
    readonly display_name: string;
    readonly user_profile_id: string;
    readonly user_profile_version: string;
}

export interface TransitionSimulationWorkspaceInput {
    readonly workspace_reference: ResourceReference;
    readonly expected_resource_version: string;
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

export type SimulationRunInput =
    (SimulationPaymentOrderInput & { readonly input_type: "payment_order_revision" })
    | (SimulationExactArtifactInput & { readonly input_type: "exact_artifact" });

export type SimulationRuntimeFxPair =
    (SimulationRuntimeFxRate & { readonly support_status: "supported" })
    | (SimulationRuntimeUnsupportedFxPair & { readonly support_status: "unsupported" });

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
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "approve",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
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
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "validate",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
  "payment_execution_attempts.explain": {
    "method": "GET",
    "path": "/v1/payment-execution-attempts/{execution_attempt_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:f4eaace0bde412782c037a13ecae73b2afc3bd0e3281bcc24779521be0b779ec",
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentExecutionAttemptGetInput",
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
        "name": "execution_attempt_id",
        "location": "path",
        "inputField": "execution_attempt_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "payment_execution_attempts.get": {
    "method": "GET",
    "path": "/v1/payment-execution-attempts/{execution_attempt_id}",
    "version": 1,
    "contractDigest": "sha256:6fd1d3f1693b933c10db70342d16723b8aad27dd45aebeb0d4a55427728f4cd2",
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentExecutionAttemptGetInput",
    "result": "isecure.bankfiles.payments_api.PaymentExecutionAttemptGetResult",
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
        "name": "execution_attempt_id",
        "location": "path",
        "inputField": "execution_attempt_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "payment_execution_attempts.list": {
    "method": "GET",
    "path": "/v1/payment-execution-attempts",
    "version": 1,
    "contractDigest": "sha256:d2c8f0a377be5274584d30495e803474f92d54596ed6231d86ec616bc146fcbf",
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentExecutionAttemptListInput",
    "result": "isecure.bankfiles.payments_api.PaymentExecutionAttemptListResult",
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
        "location": "query",
        "inputField": "payment_order_id",
        "required": false,
        "style": "form",
        "objectFields": []
      },
      {
        "name": "state",
        "location": "query",
        "inputField": "state",
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
  "payment_execution_fulfillments.claim": {
    "method": "POST",
    "path": "/v1/payment-execution-fulfillments:claim",
    "version": 1,
    "contractDigest": "sha256:2d4bf454343f38ad3d19be57e55595d17e40df650a59a2841e724d0683d2b414",
    "permission": "fulfill_execution",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentExecutionFulfillmentClaimInput",
    "result": "isecure.bankfiles.payments_api.PaymentExecutionFulfillmentResult",
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
  "payment_execution_observations.report": {
    "method": "POST",
    "path": "/v1/payment-execution-observations:report",
    "version": 1,
    "contractDigest": "sha256:a5acc23d3344a94fa3388bbf6af781e9f51146d1d5487ef4bf8894e42ed63d82",
    "permission": "fulfill_execution",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentExecutionConnectorObservationInput",
    "result": "isecure.bankfiles.payments_api.PaymentExecutionConnectorObservationResult",
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
  "payment_export_profile_catalog.list": {
    "method": "GET",
    "path": "/v1/payment-export-profile-catalog",
    "version": 1,
    "contractDigest": "sha256:52608f6a88fc8fe1d0c81396572590e8200f9af1689ce8a11be472e8650f7f02",
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "approve",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "approve",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "approve",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
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
  "payment_order_outcomes.explain": {
    "method": "GET",
    "path": "/v1/payment-order-outcomes/{payment_order_outcome_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:f3827ded84cef37e72babac0e5289b444546de41d3a7444f96dae0826d3104cd",
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentOrderOutcomeGetInput",
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
        "name": "payment_order_outcome_id",
        "location": "path",
        "inputField": "payment_order_outcome_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "payment_order_outcomes.get": {
    "method": "GET",
    "path": "/v1/payment-order-outcomes/{payment_order_outcome_id}",
    "version": 1,
    "contractDigest": "sha256:473050fa821d372034a88bf1fc8c0f2b387019d426584b99cb90cb18ade19faa",
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentOrderOutcomeGetInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderOutcomeGetResult",
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
        "name": "payment_order_outcome_id",
        "location": "path",
        "inputField": "payment_order_outcome_id",
        "required": true,
        "style": "simple",
        "objectFields": []
      }
    ]
  },
  "payment_order_outcomes.list": {
    "method": "GET",
    "path": "/v1/payment-order-outcomes",
    "version": 1,
    "contractDigest": "sha256:41b17169ad0b0285aa5ae9a3fe20ef1bf4467701634211b1c686c279cc1e04ab",
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.PaymentOrderOutcomeListInput",
    "result": "isecure.bankfiles.payments_api.PaymentOrderOutcomeListResult",
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
        "location": "query",
        "inputField": "payment_order_id",
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
  "payment_orders.append_transfers": {
    "method": "POST",
    "path": "/v1/payment-orders:append-transfers",
    "version": 1,
    "contractDigest": "sha256:6b9cd39e3f7e11cdf13c229fff00cd678fa3cf1d9859a3cd97d4b6089e18cdf6",
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.AppendPaymentOrderTransfersInput",
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
  "payment_orders.cancel_draft": {
    "method": "POST",
    "path": "/v1/payment-orders:cancel-draft",
    "version": 1,
    "contractDigest": "sha256:14976041ee01abe2f7ba0a9b2294f5294976f9b497d8a43598d63a75345314ed",
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
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
  "payment_orders.correct": {
    "method": "POST",
    "path": "/v1/payment-orders:correct",
    "version": 1,
    "contractDigest": "sha256:4b88a7d1738a796f51f8eb4f5297f2bc33d5a59a4f757931d179bdff2bfcd10e",
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "contractDigest": "sha256:ac6a4e5f6998e141f7303ab9e3d2047c39cc4bce801df6a3ba63da991770b96c",
    "permission": "execute",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
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
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
  "payment_orders.remove_transfers": {
    "method": "POST",
    "path": "/v1/payment-orders:remove-transfers",
    "version": 1,
    "contractDigest": "sha256:9e6e2ca12abbc6e09b6274cc359cdff9c9b856ffaa0de7393d25ba860f4d716b",
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.RemovePaymentOrderTransfersInput",
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
  "payment_orders.revise_draft": {
    "method": "POST",
    "path": "/v1/payment-orders:revise-draft",
    "version": 1,
    "contractDigest": "sha256:4f4f717f9a34ba59e99d070b02f9ccc589ea96d85c17ce3b1e037baa823112eb",
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
  "payment_orders.revise_transfer": {
    "method": "POST",
    "path": "/v1/payment-orders:revise-transfer",
    "version": 1,
    "contractDigest": "sha256:2577dd0e163120a35f7506125b767b048b210d18c372237ce1e9237c5bf35638",
    "permission": "propose",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
    "input": "isecure.bankfiles.payments_api.RevisePaymentOrderTransferInput",
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
    "permission": "simulate",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "submit_for_review",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "validate",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
  "simulation_artifacts.list": {
    "method": "GET",
    "path": "/v1/simulation-artifacts",
    "version": 3,
    "contractDigest": "sha256:d1812e62ef688b7c85570774600e775d9ba8bc9522fd43e1299c98ca42aadce3",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationArtifactListInput",
    "result": "isecure.bankfiles.simulation.SimulationArtifactListResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "run_reference",
        "location": "query",
        "inputField": "run_reference",
        "required": true,
        "style": "deepObject",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      },
      {
        "name": "role",
        "location": "query",
        "inputField": "role",
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
  "simulation_branches.create": {
    "method": "POST",
    "path": "/v1/simulation-branches:create",
    "version": 4,
    "contractDigest": "sha256:0269ca0f855c23a90212cc8ca2c1869b371cb8833d6f2bfb0c63fec61aa9c20a",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.CreateSimulationBranchInput",
    "result": "isecure.bankfiles.simulation.SimulationBranchResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_capabilities.list": {
    "method": "GET",
    "path": "/v1/simulation-capabilities",
    "version": 4,
    "contractDigest": "sha256:1d1f9fd27e61c91e2c8908147fe27741e1f47d008a37ef6af6fb44e647c46b14",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationCapabilityListInput",
    "result": "isecure.bankfiles.simulation.SimulationCapabilityListResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "data_admission_mode",
        "location": "query",
        "inputField": "data_admission_mode",
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
  "simulation_checkpoints.create": {
    "method": "POST",
    "path": "/v1/simulation-checkpoints:create",
    "version": 4,
    "contractDigest": "sha256:97fdef985c5897e19f0b43aec41a0e539cb5edc8aa292740c777efe14029d5ac",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.CreateSimulationCheckpointInput",
    "result": "isecure.bankfiles.simulation.SimulationCheckpointResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_clocks.control": {
    "method": "POST",
    "path": "/v1/simulation-clocks:control",
    "version": 4,
    "contractDigest": "sha256:d683043752ece7bd18c0c834bdeccd3a75ffee86177a0579b4babb2ef0b776e5",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.ControlSimulationClockInput",
    "result": "isecure.bankfiles.simulation.SimulationClockControlResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_events.list": {
    "method": "GET",
    "path": "/v1/simulation-events",
    "version": 3,
    "contractDigest": "sha256:5d1e2eaa5d72e5d5baadf070dd6fdb14f1c97ea4f9bd01fd33a6b7c7c99c9412",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationEventListInput",
    "result": "isecure.bankfiles.simulation.SimulationEventListResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "workspace_reference",
        "location": "query",
        "inputField": "workspace_reference",
        "required": true,
        "style": "deepObject",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      },
      {
        "name": "run_reference",
        "location": "query",
        "inputField": "run_reference",
        "required": false,
        "style": "deepObject",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      },
      {
        "name": "event_kind",
        "location": "query",
        "inputField": "event_kind",
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
  "simulation_runs.get": {
    "method": "GET",
    "path": "/v1/simulation-runs/{resource_reference}",
    "version": 4,
    "contractDigest": "sha256:2d90360c4ad64bdd8cd35c1aadc4e8bddd1e00304412a4896c191f4cc87c691a",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationResourceGetInput",
    "result": "isecure.bankfiles.simulation.SimulationRunGetResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "resource_reference",
        "location": "path",
        "inputField": "resource_reference",
        "required": true,
        "style": "simple",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      }
    ]
  },
  "simulation_runs.list": {
    "method": "GET",
    "path": "/v1/simulation-runs",
    "version": 4,
    "contractDigest": "sha256:cf3c94d2af1a0bfd15a8b2a31899b3fc9003cf614d5d4556d56f6d2bed18a0ca",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationRunListInput",
    "result": "isecure.bankfiles.simulation.SimulationRunListResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "workspace_reference",
        "location": "query",
        "inputField": "workspace_reference",
        "required": true,
        "style": "deepObject",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      },
      {
        "name": "scenario_reference",
        "location": "query",
        "inputField": "scenario_reference",
        "required": false,
        "style": "deepObject",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      },
      {
        "name": "state",
        "location": "query",
        "inputField": "state",
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
  "simulation_runs.start": {
    "method": "POST",
    "path": "/v1/simulation-runs:start",
    "version": 4,
    "contractDigest": "sha256:4431e600655c7d1fd79e9434f846ead09783dbb6aa512d6c9db2dad9ecfc06be",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.StartSimulationRunInput",
    "result": "isecure.bankfiles.simulation.SimulationRunMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
      "status": 202,
      "mediaType": "application/json"
    },
    "parameters": []
  },
  "simulation_scenarios.create": {
    "method": "POST",
    "path": "/v1/simulation-scenarios:create",
    "version": 4,
    "contractDigest": "sha256:25c2467181466e705ce673083355d784670873b779dcc2d29abebfab100b7667",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.CreateSimulationScenarioInput",
    "result": "isecure.bankfiles.simulation.SimulationScenarioMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_scenarios.get": {
    "method": "GET",
    "path": "/v1/simulation-scenarios/{resource_reference}",
    "version": 3,
    "contractDigest": "sha256:60e576c8a33bca289e8d8bd8d2410bbed37a1a4ace14cc852b1bd141764cc1d3",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationResourceGetInput",
    "result": "isecure.bankfiles.simulation.SimulationScenarioGetResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "resource_reference",
        "location": "path",
        "inputField": "resource_reference",
        "required": true,
        "style": "simple",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      }
    ]
  },
  "simulation_scenarios.list": {
    "method": "GET",
    "path": "/v1/simulation-scenarios",
    "version": 3,
    "contractDigest": "sha256:fed6e0dda70a1ce7e0ce4d92cfe2d3e7ba4f510dc45e77afe296d509e07e780e",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationScenarioListInput",
    "result": "isecure.bankfiles.simulation.SimulationScenarioListResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "workspace_reference",
        "location": "query",
        "inputField": "workspace_reference",
        "required": true,
        "style": "deepObject",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      },
      {
        "name": "state",
        "location": "query",
        "inputField": "state",
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
  "simulation_scenarios.revise": {
    "method": "POST",
    "path": "/v1/simulation-scenarios:revise",
    "version": 4,
    "contractDigest": "sha256:964dbf7234178c1a70f679afadc7cca15a3be538ac97a14f6e4a27488bf24767",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.ReviseSimulationScenarioInput",
    "result": "isecure.bankfiles.simulation.SimulationScenarioMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_workspaces.activate": {
    "method": "POST",
    "path": "/v1/simulation-workspaces:activate",
    "version": 4,
    "contractDigest": "sha256:be864cfd6800ab2068c844c4ef1dbe0767184d6073bcaed0291ce24679a9086f",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.TransitionSimulationWorkspaceInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_workspaces.close": {
    "method": "POST",
    "path": "/v1/simulation-workspaces:close",
    "version": 4,
    "contractDigest": "sha256:1fcc04f9ab15e4c46c1e8d44a30cc374f8b1c243d3e455586dfa9bca49254282",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.TransitionSimulationWorkspaceInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_workspaces.create": {
    "method": "POST",
    "path": "/v1/simulation-workspaces:create",
    "version": 4,
    "contractDigest": "sha256:f5ead670aa55bdd04c26c3a5dc9bf3f2807d2a8dbcaaf014f39d2ff82809fe34",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.CreateSimulationWorkspaceInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_workspaces.get": {
    "method": "GET",
    "path": "/v1/simulation-workspaces/{resource_reference}",
    "version": 4,
    "contractDigest": "sha256:9f02dd9041a9571cba758cb375bf40e762f66f5512d68a8875e2ba6aaae3d5b3",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationResourceGetInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceGetResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "resource_reference",
        "location": "path",
        "inputField": "resource_reference",
        "required": true,
        "style": "simple",
        "objectFields": [
          "resource_type",
          "resource_id",
          "resource_version",
          "revision_id"
        ]
      }
    ]
  },
  "simulation_workspaces.list": {
    "method": "GET",
    "path": "/v1/simulation-workspaces",
    "version": 4,
    "contractDigest": "sha256:44198d17e8c85bb22c36c68ddf35c2789ca96d345588a67118a0d9c227efcf16",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.SimulationWorkspaceListInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceListResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
        "name": "state",
        "location": "query",
        "inputField": "state",
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
  "simulation_workspaces.reset": {
    "method": "POST",
    "path": "/v1/simulation-workspaces:reset",
    "version": 4,
    "contractDigest": "sha256:04236b103473b279c6a42a83294c98227e7761836631471e7ba45cf2b54ddab3",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.ResetSimulationWorkspaceInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceResetResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_workspaces.revise": {
    "method": "POST",
    "path": "/v1/simulation-workspaces:revise",
    "version": 4,
    "contractDigest": "sha256:838ec9b30941405400f26fbbaa7623048b31ad4dc2cf2fee3914a27f799cc1ef",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.ReviseSimulationWorkspaceInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "simulation_workspaces.suspend": {
    "method": "POST",
    "path": "/v1/simulation-workspaces:suspend",
    "version": 4,
    "contractDigest": "sha256:1255a220d8695cfb46dcdb442aadaf310456d05468b0a915b4641b4740ba5b40",
    "permission": "manage_simulation",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "typescript"
    ],
    "input": "isecure.bankfiles.simulation.TransitionSimulationWorkspaceInput",
    "result": "isecure.bankfiles.simulation.SimulationWorkspaceMutationResult",
    "issues": "isecure.bankfiles.operations.PlatformIssues",
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
  "statements.explain": {
    "method": "GET",
    "path": "/v1/statements/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:8634f3bf634e612ec48c6f02d41382914114226236767f60926766cb4ab0bdc2",
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "explain",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
    "permission": "read",
    "audiences": [
      "admin",
      "cli",
      "rest",
      "runtime_mcp",
      "typescript"
    ],
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
