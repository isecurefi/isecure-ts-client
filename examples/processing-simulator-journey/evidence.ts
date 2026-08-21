const MAX_XML_BYTES = 4 * 1_024 * 1_024;

export const SIMULATOR_OUTPUT_TYPES = ["pain.002.001.10", "camt.054.001.02", "camt.053.001.02"] as const;
export type SimulatorOutputType = (typeof SIMULATOR_OUTPUT_TYPES)[number];

const NAMESPACES: Readonly<Record<"pain.001.001.09" | SimulatorOutputType, string>> = {
  "pain.001.001.09": "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09",
  "pain.002.001.10": "urn:iso:std:iso:20022:tech:xsd:pain.002.001.10",
  "camt.054.001.02": "urn:iso:std:iso:20022:tech:xsd:camt.054.001.02",
  "camt.053.001.02": "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02",
};

export interface PaymentCorrelation {
  readonly messageId: string;
  readonly paymentInformationId: string;
  readonly instructionId: string | null;
  readonly endToEndId: string;
  readonly debtorIban: string;
  readonly amount: string;
  readonly currency: string;
}

export interface StatementBalance {
  readonly accountIban: string;
  readonly currency: string;
  readonly openingAmount: string;
  readonly openingDirection: "CRDT" | "DBIT";
  readonly closingAmount: string;
  readonly closingDirection: "CRDT" | "DBIT";
}

export class EvidenceCorrelationMismatchError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EvidenceCorrelationMismatchError";
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function exactXml(bytes: Uint8Array, messageDefinition: keyof typeof NAMESPACES): string {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_XML_BYTES) {
    throw new Error(`${messageDefinition} bytes are empty or exceed the example bound`);
  }
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY|<!--|<!\[CDATA\[|<\?(?!xml\s)/iu.test(xml)) {
    throw new Error(`${messageDefinition} contains a forbidden declaration or alternate text form`);
  }
  const namespace = escapeRegExp(NAMESPACES[messageDefinition]);
  const root = new RegExp(
    `^\\s*(?:<\\?xml[^?]*\\?>\\s*)?<Document\\b(?=[^>]*\\bxmlns=["']${namespace}["'])[^>]*>`,
    "u",
  );
  if (!root.test(xml) || !/<\/Document>\s*$/u.test(xml)) {
    throw new Error(`${messageDefinition} has the wrong root or exact namespace`);
  }
  if ((xml.match(/\sxmlns(?::[A-Za-z_][\w.-]*)?=/gu) ?? []).length !== 1 || /<\/?[A-Za-z_][\w.-]*:/u.test(xml)) {
    throw new Error(`${messageDefinition} contains an alternate namespace binding`);
  }
  return xml;
}

function decodeXmlText(value: string): string {
  const decoded = value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
  if (decoded.includes("&")) throw new Error("Unsupported XML character reference in synthetic evidence");
  return decoded;
}

function blocks(xml: string, tag: string): string[] {
  const name = escapeRegExp(tag);
  return [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gu"))].map(
    (match) => match[1] ?? "",
  );
}

function texts(xml: string, tag: string): string[] {
  return blocks(xml, tag).map((value) => decodeXmlText(value.trim()));
}

function exactlyOne(values: readonly string[], field: string): string {
  if (values.length !== 1 || values[0] === undefined || values[0].length === 0) {
    throw new Error(`Expected exactly one ${field}`);
  }
  return values[0];
}

function optionalOne(values: readonly string[], field: string): string | null {
  if (values.length > 1 || values.some((value) => value.length === 0)) {
    throw new Error(`Expected at most one ${field}`);
  }
  return values[0] ?? null;
}

function oneBlock(xml: string, tag: string): string {
  return exactlyOne(blocks(xml, tag), tag);
}

function exactAmount(block: string, tag: string): { readonly amount: string; readonly currency: string } {
  const name = escapeRegExp(tag);
  const matches = [...block.matchAll(new RegExp(`<${name}\\s+Ccy=["']([A-Z]{3})["']>([^<]+)</${name}>`, "gu"))];
  if (matches.length !== 1) throw new Error(`Expected exactly one ${tag} with currency`);
  const currency = matches[0]?.[1];
  const amount = matches[0]?.[2];
  if (!currency || !amount || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(amount)) {
    throw new Error(`Invalid ${tag} amount`);
  }
  return { amount, currency };
}

function entryAmountAndDirection(entry: string): {
  readonly amount: string;
  readonly currency: string;
  readonly direction: "CRDT" | "DBIT";
} {
  const match =
    /^\s*(?:<NtryRef>[^<]*<\/NtryRef>\s*)?<Amt\s+Ccy=["']([A-Z]{3})["']>([^<]+)<\/Amt>\s*<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/u.exec(
      entry,
    );
  const currency = match?.[1];
  const amount = match?.[2];
  const direction = match?.[3];
  if (
    !currency ||
    !amount ||
    (direction !== "CRDT" && direction !== "DBIT") ||
    !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(amount)
  ) {
    throw new Error("Expected direct entry amount, currency, and direction");
  }
  return { amount, currency, direction };
}

export function paymentCorrelation(bytes: Uint8Array): PaymentCorrelation {
  const xml = exactXml(bytes, "pain.001.001.09");
  const header = oneBlock(xml, "GrpHdr");
  const payment = oneBlock(xml, "PmtInf");
  const transfer = oneBlock(payment, "CdtTrfTxInf");
  const debtorAccount = oneBlock(payment, "DbtrAcct");
  const instructed = exactAmount(transfer, "InstdAmt");
  return {
    messageId: exactlyOne(texts(header, "MsgId"), "payment message ID"),
    paymentInformationId: exactlyOne(texts(payment, "PmtInfId"), "payment information ID"),
    instructionId: optionalOne(texts(transfer, "InstrId"), "instruction ID"),
    endToEndId: exactlyOne(texts(transfer, "EndToEndId"), "end-to-end ID"),
    debtorIban: exactlyOne(texts(debtorAccount, "IBAN"), "debtor IBAN"),
    amount: instructed.amount,
    currency: instructed.currency,
  };
}

function simulatorInstructionId(expected: PaymentCorrelation): string {
  return expected.instructionId ?? expected.endToEndId;
}

export function verifyPain002(bytes: Uint8Array, expected: PaymentCorrelation): void {
  const xml = exactXml(bytes, "pain.002.001.10");
  const originalGroup = oneBlock(xml, "OrgnlGrpInfAndSts");
  const payment = oneBlock(xml, "OrgnlPmtInfAndSts");
  const transfer = oneBlock(payment, "TxInfAndSts");
  if (
    exactlyOne(texts(originalGroup, "OrgnlMsgId"), "original message ID") !== expected.messageId ||
    exactlyOne(texts(payment, "OrgnlPmtInfId"), "original payment information ID") !== expected.paymentInformationId ||
    exactlyOne(texts(transfer, "OrgnlInstrId"), "original instruction ID") !== simulatorInstructionId(expected) ||
    exactlyOne(texts(transfer, "OrgnlEndToEndId"), "original end-to-end ID") !== expected.endToEndId
  ) {
    throw new EvidenceCorrelationMismatchError("pain.002 does not correlate to the exact payment");
  }
  if (exactlyOne(texts(transfer, "TxSts"), "transaction status") !== "ACSC") {
    throw new Error("The simulator did not report the transaction as completed");
  }
}

function correlatedEntry(xml: string, expected: PaymentCorrelation): void {
  const matching = blocks(xml, "Ntry").filter((entry) => {
    const references = blocks(entry, "Refs");
    return references.some(
      (reference) =>
        optionalOne(texts(reference, "MsgId"), "message reference") === expected.messageId &&
        optionalOne(texts(reference, "PmtInfId"), "payment-information reference") === expected.paymentInformationId &&
        optionalOne(texts(reference, "InstrId"), "instruction reference") === simulatorInstructionId(expected) &&
        optionalOne(texts(reference, "EndToEndId"), "end-to-end reference") === expected.endToEndId,
    );
  });
  if (matching.length === 0) {
    throw new EvidenceCorrelationMismatchError("No cash entry correlates to the exact payment");
  }
  if (matching.length !== 1 || matching[0] === undefined) {
    throw new Error("Expected exactly one cash entry correlated to the payment");
  }
  const amount = entryAmountAndDirection(matching[0]);
  if (
    !equal(decimal(amount.amount), decimal(expected.amount)) ||
    amount.currency !== expected.currency ||
    amount.direction !== "DBIT"
  ) {
    throw new Error("The correlated cash entry has the wrong amount, currency, or direction");
  }
}

export function verifyCamt054(bytes: Uint8Array, expected: PaymentCorrelation): void {
  const xml = exactXml(bytes, "camt.054.001.02");
  correlatedEntry(xml, expected);
}

interface BalanceObservation {
  readonly amount: string;
  readonly currency: string;
  readonly direction: "CRDT" | "DBIT";
}

function balance(block: string, code: "OPBD" | "CLBD"): BalanceObservation {
  const matching = blocks(block, "Bal").filter((candidate) => texts(candidate, "Cd").includes(code));
  if (matching.length !== 1 || matching[0] === undefined) throw new Error(`Expected exactly one ${code} balance`);
  const amount = exactAmount(matching[0], "Amt");
  const direction = exactlyOne(texts(matching[0], "CdtDbtInd"), `${code} direction`);
  if (direction !== "CRDT" && direction !== "DBIT") throw new Error(`Invalid ${code} balance direction`);
  return { amount: amount.amount, currency: amount.currency, direction };
}

export function statementBalance(bytes: Uint8Array, accountIban: string): StatementBalance {
  const xml = exactXml(bytes, "camt.053.001.02");
  const matching = blocks(xml, "Stmt").filter((statement) => {
    const accounts = blocks(statement, "Acct");
    if (accounts.length !== 1 || accounts[0] === undefined) throw new Error("Expected exactly one statement account");
    const ibans = texts(accounts[0], "IBAN");
    if (ibans.length > 1) throw new Error("Expected at most one statement IBAN");
    return ibans[0] === accountIban;
  });
  if (matching.length !== 1 || matching[0] === undefined) {
    throw new EvidenceCorrelationMismatchError("Expected exactly one statement for the debtor account");
  }
  const opening = balance(matching[0], "OPBD");
  const closing = balance(matching[0], "CLBD");
  if (opening.currency !== closing.currency) throw new Error("Statement balance currencies differ");
  return {
    accountIban,
    currency: opening.currency,
    openingAmount: opening.amount,
    openingDirection: opening.direction,
    closingAmount: closing.amount,
    closingDirection: closing.direction,
  };
}

interface Decimal {
  readonly coefficient: bigint;
  readonly scale: number;
}

function decimal(value: string, direction: "CRDT" | "DBIT" = "CRDT"): Decimal {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/u.exec(value);
  if (!match) throw new Error("Invalid exact decimal");
  const fraction = match[2] ?? "";
  const magnitude = BigInt(`${match[1] ?? "0"}${fraction}`);
  return { coefficient: direction === "DBIT" ? -magnitude : magnitude, scale: fraction.length };
}

function align(value: Decimal, scale: number): bigint {
  return value.coefficient * 10n ** BigInt(scale - value.scale);
}

function equal(left: Decimal, right: Decimal): boolean {
  const scale = Math.max(left.scale, right.scale);
  return align(left, scale) === align(right, scale);
}

export function verifyCamt053Transition(
  bytes: Uint8Array,
  expected: PaymentCorrelation,
  before: StatementBalance,
): StatementBalance {
  const xml = exactXml(bytes, "camt.053.001.02");
  correlatedEntry(xml, expected);
  const after = statementBalance(bytes, expected.debtorIban);
  if (before.currency !== expected.currency || after.currency !== expected.currency) {
    throw new Error("The statement transition currency does not match the payment");
  }
  const beforeClosing = decimal(before.closingAmount, before.closingDirection);
  const afterOpening = decimal(after.openingAmount, after.openingDirection);
  if (!equal(beforeClosing, afterOpening)) throw new Error("The updated statement does not open at the prior balance");
  const payment = decimal(expected.amount);
  const scale = Math.max(beforeClosing.scale, payment.scale);
  const expectedClosing: Decimal = {
    coefficient: align(beforeClosing, scale) - align(payment, scale),
    scale,
  };
  if (!equal(expectedClosing, decimal(after.closingAmount, after.closingDirection))) {
    throw new Error("The updated statement closing balance does not reflect the exact payment debit");
  }
  return after;
}
