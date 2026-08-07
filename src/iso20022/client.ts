import {
  iso20022ObservationOperations,
  type BalanceGetResult,
  type BalanceListInput,
  type BalanceListResult,
  type EntryGetResult,
  type EntryListInput,
  type EntryListResult,
  type ExplanationResult,
  type ObservationExplainInput,
  type ObservationGetInput,
  type ProcessingRequestMetadata,
  type StatementGetResult,
  type StatementListInput,
  type StatementListResult,
  type TransactionGetResult,
  type TransactionListInput,
  type TransactionListResult,
  type ValidationGetResult,
  type ValidationListInput,
  type ValidationListResult,
} from "../generated/iso20022-observations.js";
import type { Iso20022Transport } from "./transport.js";

/**
 * Creates the experimental, read-only ISO 20022 observation surface.
 *
 * The methods are a thin projection of the generated platform operations. All
 * authorization, qualification, validation, lineage, and financial semantics
 * remain server-side.
 */
export function createIso20022Client(transport: Iso20022Transport) {
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
  operationId: keyof typeof iso20022ObservationOperations,
  input: Input,
): Promise<Result> {
  const metadata: ProcessingRequestMetadata = {
    contractVersion: iso20022ObservationOperations[operationId].version,
  };
  return transport.invoke<Input, Result>(operationId, input, metadata);
}
