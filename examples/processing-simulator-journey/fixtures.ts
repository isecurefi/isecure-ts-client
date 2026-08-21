export const IDS = {
  message: "SYNTH-MSG-1",
  payment: "SYNTH-PMT-1",
  instruction: "SYNTH-INSTR-1",
  endToEnd: "SYNTH-E2E-1",
  account: "FI2112345600000785",
} as const;

const document = (namespace: string, body: string): Uint8Array =>
  new TextEncoder().encode(`<?xml version="1.0"?><Document xmlns="${namespace}">${body}</Document>`);

const instruction = (tag: "InstrId" | "OrgnlInstrId", value: string | null): string =>
  value === null ? "" : `<${tag}>${value}</${tag}>`;

export const pain001 = (messageId = IDS.message, instructionId: string | null = IDS.instruction): Uint8Array =>
  document(
    "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09",
    `<CstmrCdtTrfInitn><GrpHdr><MsgId>${messageId}</MsgId></GrpHdr><PmtInf><PmtInfId>${IDS.payment}</PmtInfId><DbtrAcct><Id><IBAN>${IDS.account}</IBAN></Id></DbtrAcct><CdtTrfTxInf><PmtId>${instruction("InstrId", instructionId)}<EndToEndId>${IDS.endToEnd}</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">12.34</InstdAmt></Amt></CdtTrfTxInf></PmtInf></CstmrCdtTrfInitn>`,
  );

export const pain002 = (messageId = IDS.message, instructionId: string | null = IDS.instruction): Uint8Array =>
  document(
    "urn:iso:std:iso:20022:tech:xsd:pain.002.001.10",
    `<CstmrPmtStsRpt><OrgnlGrpInfAndSts><OrgnlMsgId>${messageId}</OrgnlMsgId></OrgnlGrpInfAndSts><OrgnlPmtInfAndSts><OrgnlPmtInfId>${IDS.payment}</OrgnlPmtInfId><TxInfAndSts>${instruction("OrgnlInstrId", instructionId)}<OrgnlEndToEndId>${IDS.endToEnd}</OrgnlEndToEndId><TxSts>ACSC</TxSts></TxInfAndSts></OrgnlPmtInfAndSts></CstmrPmtStsRpt>`,
  );

export const entry = (messageId = IDS.message, instructionId: string | null = IDS.instruction): string =>
  `<Ntry><Amt Ccy="EUR">12.3400</Amt><CdtDbtInd>DBIT</CdtDbtInd><NtryDtls><TxDtls><Refs><MsgId>${messageId}</MsgId><PmtInfId>${IDS.payment}</PmtInfId>${instruction("InstrId", instructionId)}<EndToEndId>${IDS.endToEnd}</EndToEndId></Refs><AmtDtls><InstdAmt><Amt Ccy="EUR">12.34</Amt></InstdAmt></AmtDtls><Chrgs><Amt Ccy="EUR">0.00</Amt><CdtDbtInd>CRDT</CdtDbtInd></Chrgs></TxDtls></NtryDtls></Ntry>`;

export const camt054 = (messageId = IDS.message, instructionId: string | null = IDS.instruction): Uint8Array =>
  document(
    "urn:iso:std:iso:20022:tech:xsd:camt.054.001.02",
    `<BkToCstmrDbtCdtNtfctn><Ntfctn>${entry(messageId, instructionId)}</Ntfctn></BkToCstmrDbtCdtNtfctn>`,
  );

const balance = (code: "OPBD" | "CLBD", amount: string): string =>
  `<Bal><Tp><CdOrPrtry><Cd>${code}</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${amount}</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>`;

export const camt053 = (
  opening = "100.00",
  closing = "87.66",
  messageId = IDS.message,
  instructionId: string | null = IDS.instruction,
): Uint8Array =>
  document(
    "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02",
    `<BkToCstmrStmt><Stmt><Acct><Id><IBAN>${IDS.account}</IBAN></Id></Acct>${balance("OPBD", opening)}${balance("CLBD", closing)}${entry(messageId, instructionId)}</Stmt></BkToCstmrStmt>`,
  );

export const baseline = (amount = "100.00"): Uint8Array =>
  document(
    "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02",
    `<BkToCstmrStmt><Stmt><Acct><Id><IBAN>${IDS.account}</IBAN></Id></Acct>${balance("OPBD", amount)}${balance("CLBD", amount)}</Stmt></BkToCstmrStmt>`,
  );
