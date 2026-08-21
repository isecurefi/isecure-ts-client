import { describe, expect, it } from "vitest";
import {
  EvidenceCorrelationMismatchError,
  paymentCorrelation,
  statementBalance,
  verifyCamt053Transition,
  verifyCamt054,
  verifyPain002,
} from "./evidence.js";
import { baseline, camt053, camt054, entry, IDS, pain001, pain002 } from "./fixtures.js";

describe("synthetic Processing-to-simulator evidence", () => {
  it("correlates all exact identifiers and verifies the exact balance transition without floats", () => {
    const correlation = paymentCorrelation(pain001());
    expect(correlation).toEqual({
      messageId: IDS.message,
      paymentInformationId: IDS.payment,
      instructionId: IDS.instruction,
      endToEndId: IDS.endToEnd,
      debtorIban: IDS.account,
      amount: "12.34",
      currency: "EUR",
    });
    expect(() => {
      verifyPain002(pain002(), correlation);
    }).not.toThrow();
    expect(() => {
      verifyCamt054(camt054(), correlation);
    }).not.toThrow();
    expect(verifyCamt053Transition(camt053(), correlation, statementBalance(baseline(), IDS.account))).toMatchObject({
      openingAmount: "100.00",
      closingAmount: "87.66",
    });
  });

  it("fails closed on identifier substitution, duplicate entries, and an incorrect balance", () => {
    const correlation = paymentCorrelation(pain001());
    expect(() => {
      verifyPain002(pain002("OTHER-MSG"), correlation);
    }).toThrow(EvidenceCorrelationMismatchError);
    const duplicated = new TextDecoder().decode(camt054()).replace("</Ntfctn>", `${entry()}</Ntfctn>`);
    expect(() => {
      verifyCamt054(new TextEncoder().encode(duplicated), correlation);
    }).toThrow("Expected exactly one cash entry");
    expect(() =>
      verifyCamt053Transition(camt053("100.00", "87.67"), correlation, statementBalance(baseline(), IDS.account)),
    ).toThrow("closing balance");
  });

  it("rejects wrong namespaces, entity declarations, malformed UTF-8, and multiple transactions", () => {
    expect(() => paymentCorrelation(pain001()).messageId).not.toThrow();
    expect(() =>
      paymentCorrelation(
        new TextEncoder().encode(
          '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"><CstmrCdtTrfInitn/></Document>',
        ),
      ),
    ).toThrow("wrong root");
    expect(() =>
      paymentCorrelation(
        new TextEncoder().encode(
          '<!DOCTYPE x [<!ENTITY y "z">]><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"/>',
        ),
      ),
    ).toThrow("forbidden declaration");
    expect(() => paymentCorrelation(Uint8Array.from([0xff, 0xfe]))).toThrow();
    const namespaceReset = new TextDecoder().decode(pain001()).replace("<MsgId>", '<MsgId xmlns="">');
    expect(() => paymentCorrelation(new TextEncoder().encode(namespaceReset))).toThrow("alternate namespace");
    const duplicate = new TextDecoder().decode(pain001()).replace("</PmtInf>", "<CdtTrfTxInf></CdtTrfTxInf></PmtInf>");
    expect(() => paymentCorrelation(new TextEncoder().encode(duplicate))).toThrow("exactly one CdtTrfTxInf");
  });
});
