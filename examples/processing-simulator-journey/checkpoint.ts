import crypto from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { SIMULATOR_OUTPUT_TYPES } from "./evidence.js";
import type { JourneyCheckpoint, JourneyPhase } from "./journey.js";

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/u;
const PHASES: readonly JourneyPhase[] = [
  "upload_started",
  "upload_accepted",
  "upload_refused",
  "upload_uncertain",
  "complete",
];

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid journey checkpoint");
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512)
    throw new Error(`Invalid checkpoint ${field}`);
  return value;
}

function direction(value: unknown, field: string): "CRDT" | "DBIT" {
  const resolved = text(value, field);
  if (resolved !== "CRDT" && resolved !== "DBIT") throw new Error(`Invalid checkpoint ${field}`);
  return resolved;
}

function checkpoint(value: unknown, expectedRunId: string): JourneyCheckpoint {
  const root = record(value);
  if (root.version !== 1 || root.runId !== expectedRunId || !PHASES.includes(root.phase as JourneyPhase)) {
    throw new Error("The journey checkpoint version, run, or phase is invalid");
  }
  const correlation = record(root.correlation);
  const before = record(root.before);
  const prior = record(root.priorReferences);
  const references = (fileType: (typeof SIMULATOR_OUTPUT_TYPES)[number]): readonly string[] => {
    const values = prior[fileType];
    if (!Array.isArray(values) || values.some((entry) => typeof entry !== "string" || entry.length === 0)) {
      throw new Error(`Invalid checkpoint references for ${fileType}`);
    }
    if (new Set(values).size !== values.length) throw new Error(`Duplicate checkpoint references for ${fileType}`);
    return values as string[];
  };
  const priorReferences: JourneyCheckpoint["priorReferences"] = {
    "pain.002.001.10": references("pain.002.001.10"),
    "camt.054.001.02": references("camt.054.001.02"),
    "camt.053.001.02": references("camt.053.001.02"),
  };
  return {
    version: 1,
    runId: expectedRunId,
    phase: root.phase as JourneyPhase,
    correlation: {
      messageId: text(correlation.messageId, "message ID"),
      paymentInformationId: text(correlation.paymentInformationId, "payment information ID"),
      instructionId: text(correlation.instructionId, "instruction ID"),
      endToEndId: text(correlation.endToEndId, "end-to-end ID"),
      debtorIban: text(correlation.debtorIban, "debtor IBAN"),
      amount: text(correlation.amount, "amount"),
      currency: text(correlation.currency, "currency"),
    },
    priorReferences,
    before: {
      accountIban: text(before.accountIban, "statement account"),
      currency: text(before.currency, "statement currency"),
      openingAmount: text(before.openingAmount, "opening amount"),
      openingDirection: direction(before.openingDirection, "opening direction"),
      closingAmount: text(before.closingAmount, "closing amount"),
      closingDirection: direction(before.closingDirection, "closing direction"),
    },
  };
}

async function requirePrivateRegularFile(filePath: string): Promise<void> {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("The journey checkpoint must be a regular file");
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    throw new Error("The journey checkpoint must not be accessible by group or other users");
  }
}

async function requirePrivateDirectory(directory: string): Promise<void> {
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("The journey checkpoint directory must be a regular directory");
  }
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    throw new Error("The journey checkpoint directory must not be accessible by group or other users");
  }
}

export function checkpointPath(runId: string): string {
  if (!RUN_ID.test(runId)) throw new Error("ISECURE_EXAMPLE_RUN_ID is invalid");
  const directory = path.resolve(
    process.env.ISECURE_SIMULATOR_JOURNEY_CHECKPOINT_DIR ?? ".isecure-processing-simulator",
  );
  return path.join(directory, `${runId}.json`);
}

export async function readCheckpoint(filePath: string, runId: string): Promise<JourneyCheckpoint | undefined> {
  try {
    await requirePrivateRegularFile(filePath);
    return checkpoint(JSON.parse(await readFile(filePath, "utf8")) as unknown, runId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeCheckpoint(filePath: string, value: JourneyCheckpoint): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await requirePrivateDirectory(directory);
  try {
    await requirePrivateRegularFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, filePath);
  await requirePrivateRegularFile(filePath);
}

export function withPhase(value: JourneyCheckpoint, phase: JourneyPhase): JourneyCheckpoint {
  return { ...value, phase };
}
