// GENERATED FILE: DO NOT EDIT.
// source: isecurefi/bankfiles-platform@2c286b40a77d33e608a797dedf21c427eb62be5b
// model: Bankfiles@0.66.0
// source-digest: sha256:0576509d1d8bd4123999416ecbb73681fb567357871e096d15070ead51b335b9
// Exact decimals and 64-bit integers are JSON decimal strings.

export type BalanceBoundary = "opening" | "closing" | "intraday" | "available" | "expected" | "forward_available" | "other";

export type CashReportKind = "camt_052" | "camt_053" | "camt_054";

export type DebitCredit = "debit" | "credit";

export type IntegrityOutcome = "succeeded" | "failed" | "indeterminate" | "quarantined";

export type TemporalPrecision = "date" | "minute" | "second" | "millisecond" | "microsecond" | "nanosecond";

export type ProcessingRunKind = "detect" | "transform" | "parse" | "validate" | "map" | "render" | "project" | "reconcile";

export type ProfileResolutionOutcome = "selected" | "no_match" | "ambiguous" | "rejected" | "human_resolved";

export type IdempotencyOutcome = "applied" | "replayed" | "in_progress" | "mismatch" | "expired";

export type OperationIssueCategory = "validation" | "authorization" | "policy" | "conflict" | "unsupported" | "external" | "internal";

export type OperationIssueSeverity = "error" | "warning" | "information";

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

export type RequiredAction =
    (HumanReviewAction & { readonly action_type: "human_review" })
    | (StrongAuthenticationAction & { readonly action_type: "strong_authentication" })
    | (ConfigurationAction & { readonly action_type: "configuration" })
    | (RetryLaterAction & { readonly action_type: "retry_later" });

export interface ProcessingRequestMetadata {
    readonly contractVersion: number;
    readonly idempotencyKey?: string;
    readonly expectedResourceVersion?: string;
}

export const iso20022ObservationOperations = {
  "balances.explain": {
    "method": "GET",
    "path": "/v1/balances/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:9a23cd4786bbcccd7d5847a536ae1ec4a64974eb14672ba05a4614c4a62a9734",
    "input": "isecure.bankfiles.observations.ObservationExplainInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false
      },
      {
        "name": "balance_type_code",
        "location": "query",
        "inputField": "balance_type_code",
        "required": false
      },
      {
        "name": "currency",
        "location": "query",
        "inputField": "currency",
        "required": false
      },
      {
        "name": "balance_date_from",
        "location": "query",
        "inputField": "balance_date_from",
        "required": false
      },
      {
        "name": "balance_date_to",
        "location": "query",
        "inputField": "balance_date_to",
        "required": false
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false
      },
      {
        "name": "status_code",
        "location": "query",
        "inputField": "status_code",
        "required": false
      },
      {
        "name": "debit_credit",
        "location": "query",
        "inputField": "debit_credit",
        "required": false
      },
      {
        "name": "currency",
        "location": "query",
        "inputField": "currency",
        "required": false
      },
      {
        "name": "booking_date_from",
        "location": "query",
        "inputField": "booking_date_from",
        "required": false
      },
      {
        "name": "booking_date_to",
        "location": "query",
        "inputField": "booking_date_to",
        "required": false
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false
      }
    ]
  },
  "statements.explain": {
    "method": "GET",
    "path": "/v1/statements/{resource_id}/explanation",
    "version": 1,
    "contractDigest": "sha256:8634f3bf634e612ec48c6f02d41382914114226236767f60926766cb4ab0bdc2",
    "input": "isecure.bankfiles.observations.ObservationExplainInput",
    "result": "isecure.bankfiles.observations.ExplanationResult",
    "issues": "isecure.bankfiles.observations.ObservationIssues",
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false
      },
      {
        "name": "observed_from",
        "location": "query",
        "inputField": "observed_from",
        "required": false
      },
      {
        "name": "observed_to",
        "location": "query",
        "inputField": "observed_to",
        "required": false
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "bank_account_id",
        "location": "query",
        "inputField": "bank_account_id",
        "required": false
      },
      {
        "name": "end_to_end_id",
        "location": "query",
        "inputField": "end_to_end_id",
        "required": false
      },
      {
        "name": "uetr",
        "location": "query",
        "inputField": "uetr",
        "required": false
      },
      {
        "name": "purpose_code",
        "location": "query",
        "inputField": "purpose_code",
        "required": false
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "resource_id",
        "location": "path",
        "inputField": "resource_id",
        "required": true
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
    "parameters": [
      {
        "name": "run_kind",
        "location": "query",
        "inputField": "run_kind",
        "required": false
      },
      {
        "name": "outcome",
        "location": "query",
        "inputField": "outcome",
        "required": false
      },
      {
        "name": "started_from",
        "location": "query",
        "inputField": "started_from",
        "required": false
      },
      {
        "name": "started_to",
        "location": "query",
        "inputField": "started_to",
        "required": false
      },
      {
        "name": "page_size",
        "location": "query",
        "inputField": "page_size",
        "required": false
      },
      {
        "name": "cursor",
        "location": "query",
        "inputField": "cursor",
        "required": false
      }
    ]
  }
} as const;

export type Iso20022ObservationOperationId = keyof typeof iso20022ObservationOperations;
