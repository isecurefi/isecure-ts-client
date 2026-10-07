import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verificationFixture, verifyVerificationReport } from "./verification.js";
import { blocks, texts } from "../processing-simulator-journey/evidence.js";

const input = verificationFixture(
  readFileSync("examples/bank-simulator/synthetic-pain.001.001.09.xml", "utf8"),
  "run-12345678-1234-1234-1234-123456789abc",
);
const encode = (xml: string) => new TextEncoder().encode(xml);
function report(pending = false): string {
  const original = new TextDecoder().decode(input);
  const outcomes = pending ? Array<string>(6).fill("RVNC") : ["RCVC", "RVMC", "RVNM", "RVNA", "RJCT", "SYST"];
  let ordinal = 0;
  const payments = blocks(original, "PmtInf")
    .map(
      (payment) =>
        `<OrgnlPmtInfAndSts><OrgnlPmtInfId>${texts(payment, "PmtInfId")[0]}</OrgnlPmtInfId><OrgnlNbOfTxs>2</OrgnlNbOfTxs>${blocks(
          payment,
          "CdtTrfTxInf",
        )
          .map((tx) => {
            const status = outcomes[ordinal];
            ordinal += 1;
            const optional = [
              ["InstrId", "OrgnlInstrId"],
              ["UETR", "OrgnlUETR"],
            ]
              .map(([source, target]) =>
                texts(tx, source ?? "")
                  .map((text) => `<${target}>${text}</${target}>`)
                  .join(""),
              )
              .join("");
            const reason =
              status === "RVMC"
                ? "Invented Verified Creditor"
                : status === "RJCT" || status === "SYST"
                  ? "Synthetic diagnostic"
                  : null;
            return `<TxInfAndSts><StsId>STATUS-${ordinal}</StsId>${optional}<OrgnlEndToEndId>NOTPROVIDED</OrgnlEndToEndId><TxSts>${status}</TxSts>${reason ? `<StsRsnInf><Rsn><Cd>NARR</Cd></Rsn><AddtlInf>${reason}</AddtlInf></StsRsnInf>` : ""}</TxInfAndSts>`;
          })
          .join("")}</OrgnlPmtInfAndSts>`,
    )
    .join("");
  return `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.10"><CstmrPmtStsRpt><GrpHdr><MsgId>REPORT</MsgId><CreDtTm>2026-10-08T00:00:00Z</CreDtTm></GrpHdr><OrgnlGrpInfAndSts><OrgnlMsgId>${texts(original, "MsgId")[0]}</OrgnlMsgId><OrgnlMsgNmId>pain.001.001.09</OrgnlMsgNmId><OrgnlNbOfTxs>6</OrgnlNbOfTxs></OrgnlGrpInfAndSts>${payments}</CstmrPmtStsRpt></Document>`;
}

describe("live verification evidence", () => {
  it("keeps repeated identifiers as six ordered grains across three blocks", () => {
    const source = new TextDecoder().decode(input);
    expect(texts(source, "NbOfTxs")).toEqual(["6", "2", "2", "2"]);
    expect(texts(source, "CtrlSum")).toEqual(["4350.15", "1450.05", "1450.05", "1450.05"]);
    expect(texts(source, "EndToEndId")).toEqual(Array<string>(6).fill("NOTPROVIDED"));
    expect(verifyVerificationReport(input, encode(report(true)))).toBe("pending");
    expect(verifyVerificationReport(input, encode(report()))).toBe("final");
  });
  it.each([
    ["wrong namespace", (xml: string) => xml.replace("pain.002.001.10", "pain.002.001.03")],
    ["wrong message", (xml: string) => xml.replace(/<OrgnlMsgId>[^<]+/u, "<OrgnlMsgId>OTHER")],
    ["wrong block", (xml: string) => xml.replace("VOP-BLOCK-2", "OTHER")],
    ["lost item", (xml: string) => xml.replace(/<TxInfAndSts>[\s\S]*?<\/TxInfAndSts>/u, "")],
    ["collapsed identity", (xml: string) => xml.replace("STATUS-2", "STATUS-1")],
    ["missing UETR", (xml: string) => xml.replace(/<OrgnlUETR>[^<]+<\/OrgnlUETR>/u, "")],
    [
      "fabricated instruction",
      (xml: string) =>
        xml.replace("<StsId>STATUS-2</StsId>", "<StsId>STATUS-2</StsId><OrgnlInstrId>FABRICATED</OrgnlInstrId>"),
    ],
    ["payment status", (xml: string) => xml.replace("RCVC", "ACSC")],
    ["missing suggestion", (xml: string) => xml.replace("Invented Verified Creditor", "")],
    ["wrong reason placement", (xml: string) => xml.replace("<Cd>NARR</Cd>", "<Cd>RVMC</Cd>")],
    [
      "payment acceptance",
      (xml: string) => xml.replace("<StsId>", "<AccptncDtTm>2026-10-08T00:00:00Z</AccptncDtTm><StsId>"),
    ],
    ["group status", (xml: string) => xml.replace("<OrgnlMsgNmId>", "<GrpSts>ACCP</GrpSts><OrgnlMsgNmId>")],
    ["entity declaration", (xml: string) => "<!DOCTYPE Document>" + xml],
    ["alternate namespace", (xml: string) => xml.replace("<TxInfAndSts>", '<TxInfAndSts xmlns="other">')],
  ] as const)("rejects %s without returning a successful result", (_name, mutate) => {
    expect(() => verifyVerificationReport(input, encode(mutate(report())))).toThrow();
  });
});
