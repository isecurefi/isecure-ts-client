import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PublicKey, PrivateKey } from "openpgp";
import { detachedSignature, type ManualUploadClient } from "../processing-manual-upload/security.js";
import { blocks, texts, exactXml } from "../processing-simulator-journey/evidence.js";
import type { SimulatorFilesClient, FileDescriptor } from "../processing-simulator-journey/journey.js";
import { snapshotFileTimes, assertRetainedFileTimes } from "./timestamps.js";

export const VOP_INPUT = "pain.001.001.09 VOP";
export const VOP_OUTPUT = "pain.002.001.10 VOP";
const FINAL = ["RCVC", "RVMC", "RVNM", "RVNA", "RJCT", "SYST"];
function fail(): never {
  throw new Error("VOP_EVIDENCE_INVALID");
}

/** Qualification-only synthetic fixture: three blocks, six ordered items, repeated identifiers. */
export function verificationFixture(template: string, runId: string): Uint8Array {
  if (!/^run-[a-f0-9-]{36}$/u.test(runId)) fail();
  const original = blocks(template, "PmtInf");
  if (original.length !== 1 || blocks(original[0] ?? "", "CdtTrfTxInf").length !== 2) fail();
  const payment = original[0] ?? "";
  const payments = [1, 2, 3]
    .map(
      (index) =>
        `<PmtInf>${payment
          .replace(/<PmtInfId>[^<]+<\/PmtInfId>/u, `<PmtInfId>VOP-BLOCK-${index}</PmtInfId>`)
          .replace(/<EndToEndId>[^<]+<\/EndToEndId>/gu, "<EndToEndId>NOTPROVIDED</EndToEndId>")}</PmtInf>`,
    )
    .join("");
  const xml = template
    .replace(/<MsgId>[^<]+<\/MsgId>/u, `<MsgId>VOP-${runId.slice(4).replaceAll("-", "").slice(0, 31)}</MsgId>`)
    .replace("<NbOfTxs>2</NbOfTxs>", "<NbOfTxs>6</NbOfTxs>")
    .replace("<CtrlSum>1450.05</CtrlSum>", "<CtrlSum>4350.15</CtrlSum>")
    .replace(/<PmtInf>[\s\S]*<\/PmtInf>/u, payments);
  return new TextEncoder().encode(xml);
}

function same(actual: readonly string[], expected: readonly string[]): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail();
}

/** Bounded synthetic evidence inspector, not a general ISO validator or bank qualification. */
export function verifyVerificationReport(input: Uint8Array, output: Uint8Array): "pending" | "final" {
  const source = exactXml(input, "pain.001.001.09");
  const report = exactXml(output, "pain.002.001.10");
  same(texts(report, "OrgnlMsgId"), texts(source, "MsgId"));
  same(texts(report, "OrgnlMsgNmId"), ["pain.001.001.09"]);
  same(texts(report, "OrgnlNbOfTxs"), ["6", "2", "2", "2"]);
  if (/<(?:GrpSts|PmtInfSts|ChrgsInf|AccptncDtTm|AcctSvcrRef|ClrSysRef)\b/u.test(report)) fail();
  const payments = blocks(report, "OrgnlPmtInfAndSts"),
    originalPayments = blocks(source, "PmtInf");
  if (payments.length !== 3 || originalPayments.length !== 3) fail();
  const statuses: string[] = [],
    statusIds: string[] = [];
  for (const [index, payment] of payments.entries()) {
    const original = originalPayments[index] ?? fail();
    same(texts(payment, "OrgnlPmtInfId"), texts(original, "PmtInfId"));
    const transactions = blocks(payment, "TxInfAndSts"),
      originalTransactions = blocks(original, "CdtTrfTxInf");
    if (transactions.length !== 2 || originalTransactions.length !== 2) fail();
    for (const [ordinal, transaction] of transactions.entries()) {
      const originalTransaction = originalTransactions[ordinal] ?? fail();
      for (const [actual, expected] of [
        ["OrgnlInstrId", "InstrId"],
        ["OrgnlEndToEndId", "EndToEndId"],
        ["OrgnlUETR", "UETR"],
      ] as const)
        same(texts(transaction, actual), texts(originalTransaction, expected));
      const status = texts(transaction, "TxSts"),
        identity = texts(transaction, "StsId");
      if (status.length !== 1 || identity.length !== 1 || !identity[0]) fail();
      statuses.push(status[0] ?? fail());
      statusIds.push(identity[0] ?? fail());
      const reasons = blocks(transaction, "StsRsnInf");
      if (status[0] === "RVMC") {
        if (reasons.length !== 1) fail();
        same(texts(reasons[0] ?? "", "Cd"), ["NARR"]);
        same(texts(reasons[0] ?? "", "AddtlInf"), ["Invented Verified Creditor"]);
      } else if (status[0] === "RJCT" || status[0] === "SYST") {
        if (reasons.length !== 1 || texts(reasons[0] ?? "", "AddtlInf").length !== 1) fail();
        same(texts(reasons[0] ?? "", "Cd"), ["NARR"]);
      } else if (reasons.length !== 0) fail();
    }
  }
  if (new Set(statusIds).size !== 6) fail();
  if (statuses.every((status) => status === "RVNC")) return "pending";
  same(statuses, FINAL);
  return "final";
}

async function list(client: SimulatorFilesClient): Promise<readonly FileDescriptor[]> {
  const response = await client.listFiles({ FileType: VOP_OUTPUT, Status: "ALL" });
  const observed: unknown = response.FileDescriptors;
  if (response.ResponseCode !== "00" || (observed !== null && !Array.isArray(observed))) fail();
  const files = response.FileDescriptors ?? [];
  if (
    files.length > 256 ||
    new Set(files.map((file) => file.FileReference)).size !== files.length ||
    files.some(
      (file) => file.FileType !== VOP_OUTPUT || !file.FileReference || !Number.isFinite(Date.parse(file.FileTimestamp)),
    )
  )
    fail();
  return files;
}

export async function runVerificationJourney(
  client: SimulatorFilesClient & ManualUploadClient,
  material: { publicKey: PublicKey; privateKey: PrivateKey },
  runId: string,
): Promise<void> {
  const before = await snapshotFileTimes(client);
  const prior = new Set((await list(client)).map((file) => file.FileReference));
  const input = verificationFixture(
    await readFile(path.resolve("examples/bank-simulator/synthetic-pain.001.001.09.xml"), "utf8"),
    runId,
  );
  const signature = await detachedSignature(input, material.publicKey, material.privateKey);
  // Exactly one signed upload. A transport error is uncertain and must not cause a retry.
  const uploaded = await client.uploadFile({
    FileContents: Buffer.from(input).toString("base64"),
    FileName: "synthetic-vop.xml",
    FileType: VOP_INPUT,
    Signature: signature,
  });
  if (uploaded.ResponseCode !== "00") fail();
  const files = (await list(client)).filter((file) => !prior.has(file.FileReference));
  if (files.length !== 2) fail();
  const observations = new Map<string, number>();
  for (const file of files) {
    const response = await client.downloadFile(VOP_OUTPUT, file.FileReference);
    if (response.ResponseCode !== "00" || response.Content.length > 4 * 1024 * 1024) fail();
    const bytes = Buffer.from(response.Content, "base64");
    if (bytes.toString("base64") !== response.Content) fail();
    const outcome = verifyVerificationReport(input, bytes);
    if (observations.has(outcome)) fail();
    observations.set(outcome, Date.parse(texts(exactXml(bytes, "pain.002.001.10"), "CreDtTm")[0] ?? ""));
    const replay = await client.downloadFile(VOP_OUTPUT, file.FileReference);
    if (replay.ResponseCode !== "00" || replay.Content !== response.Content) fail();
    await requireWrongServiceDenial(client, file.FileReference);
  }
  if ((observations.get("final") ?? NaN) - (observations.get("pending") ?? NaN) !== 30000) fail();
  const after = await snapshotFileTimes(client);
  assertRetainedFileTimes(before, after);
  if (before.size !== after.size) fail();
  const retained = await list(client);
  for (const file of files)
    if (
      !retained.some(
        (other) => other.FileReference === file.FileReference && other.FileTimestamp === file.FileTimestamp,
      )
    )
      fail();
}

/** Only the explicit File Exchange refusal counts; a network or authentication error does not. */
export async function requireWrongServiceDenial(
  client: Pick<SimulatorFilesClient, "downloadFile">,
  reference: string,
): Promise<void> {
  let result: unknown;
  try {
    result = await client.downloadFile("pain.002.001.10", reference);
  } catch (error: unknown) {
    if (error === null || typeof error !== "object" || !("response" in error)) fail();
    const response = error.response;
    if (response === null || typeof response !== "object" || !("data" in response)) fail();
    result = response.data;
  }
  if (result === null || typeof result !== "object" || !("ResponseCode" in result) || result.ResponseCode !== "01")
    fail();
}
