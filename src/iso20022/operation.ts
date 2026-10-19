import { iso20022Operations, type ProcessingRequestMetadata } from "../generated/iso20022-contracts.js";
import type { Iso20022Transport } from "./transport.js";

export function invoke<Input, Result>(
  transport: Pick<Iso20022Transport, "invoke">,
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
