import type { PaymentCorrelation, SimulatorOutputType, StatementBalance } from "./evidence.js";
import {
  EvidenceCorrelationMismatchError,
  SIMULATOR_OUTPUT_TYPES,
  statementBalance,
  verifyCamt053Transition,
  verifyCamt054,
  verifyPain002,
} from "./evidence.js";

const MAX_DOWNLOAD_BYTES = 4 * 1_024 * 1_024;
const MAX_LISTED_FILES_PER_TYPE = 256;
const MAX_BASELINE_CANDIDATES = 16;
const MAX_EVIDENCE_CANDIDATES = 32;

export type JourneyPhase = "upload_started" | "upload_accepted" | "upload_refused" | "upload_uncertain" | "complete";

export interface JourneyCheckpoint {
  readonly version: 1;
  readonly runId: string;
  readonly phase: JourneyPhase;
  readonly correlation: PaymentCorrelation;
  readonly priorReferences: Readonly<Record<SimulatorOutputType, readonly string[]>>;
  readonly before: StatementBalance;
}

export interface FileDescriptor {
  readonly FileReference: string;
  readonly FileTimestamp: string;
  readonly FileType: string;
  readonly Status: string;
}

interface ResponseEnvelope {
  readonly ResponseCode: string;
  readonly ResponseText?: string;
}

export interface SimulatorFilesClient {
  listFiles(query: {
    readonly FileType: string;
    readonly Status: string;
  }): Promise<ResponseEnvelope & { readonly FileDescriptors: readonly FileDescriptor[] }>;
  downloadFile(fileType: string, fileReference: string): Promise<ResponseEnvelope & { readonly Content: string }>;
}

export interface CollectedSimulatorEvidence {
  readonly files: Readonly<Record<SimulatorOutputType, Uint8Array>>;
  readonly after: StatementBalance;
}

function assertSuccess<T extends ResponseEnvelope>(response: T, operation: string): T {
  if (response.ResponseCode !== "00") throw new Error(`${operation} was refused with code ${response.ResponseCode}`);
  return response;
}

function exactBase64(content: string): Uint8Array {
  if (
    content.length === 0 ||
    content.length > Math.ceil(MAX_DOWNLOAD_BYTES / 3) * 4 ||
    content.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(content)
  ) {
    throw new Error("Downloaded simulator evidence is empty, truncated, oversized, or not canonical Base64");
  }
  const bytes = Buffer.from(content, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOWNLOAD_BYTES || bytes.toString("base64") !== content) {
    throw new Error("Downloaded simulator evidence failed exact Base64 verification");
  }
  return bytes;
}

async function downloadExact(client: SimulatorFilesClient, descriptor: FileDescriptor): Promise<Uint8Array> {
  const response = assertSuccess(
    await client.downloadFile(descriptor.FileType, descriptor.FileReference),
    `download ${descriptor.FileType}`,
  );
  return exactBase64(response.Content);
}

async function listed(client: SimulatorFilesClient, fileType: SimulatorOutputType): Promise<readonly FileDescriptor[]> {
  const response = assertSuccess(await client.listFiles({ FileType: fileType, Status: "ALL" }), `list ${fileType}`);
  if (response.FileDescriptors.length > MAX_LISTED_FILES_PER_TYPE) {
    throw new Error(`The ${fileType} listing exceeds the example bound`);
  }
  const references = new Set<string>();
  for (const descriptor of response.FileDescriptors) {
    if (descriptor.FileType !== fileType || descriptor.FileReference.length === 0) {
      throw new Error(`The ${fileType} listing contains a mismatched descriptor`);
    }
    if (references.has(descriptor.FileReference)) throw new Error(`The ${fileType} listing contains a duplicate`);
    references.add(descriptor.FileReference);
  }
  return response.FileDescriptors;
}

export async function captureBaseline(
  client: SimulatorFilesClient,
  debtorIban: string,
): Promise<Pick<JourneyCheckpoint, "priorReferences" | "before">> {
  const listings = await Promise.all(
    SIMULATOR_OUTPUT_TYPES.map(async (fileType) => [fileType, await listed(client, fileType)] as const),
  );
  const byType = new Map(listings);
  const references = (fileType: SimulatorOutputType): readonly string[] =>
    (byType.get(fileType) ?? []).map((value) => value.FileReference);
  const priorReferences: Record<SimulatorOutputType, readonly string[]> = {
    "pain.002.001.10": references("pain.002.001.10"),
    "camt.054.001.02": references("camt.054.001.02"),
    "camt.053.001.02": references("camt.053.001.02"),
  };
  const statements = listings.find(([fileType]) => fileType === "camt.053.001.02")?.[1] ?? [];
  const ordered = [...statements].sort((left, right) => {
    const leftTime = Date.parse(left.FileTimestamp);
    const rightTime = Date.parse(right.FileTimestamp);
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) throw new Error("A statement timestamp is invalid");
    return rightTime - leftTime || right.FileReference.localeCompare(left.FileReference);
  });
  for (const candidate of ordered.slice(0, MAX_BASELINE_CANDIDATES)) {
    try {
      return { priorReferences, before: statementBalance(await downloadExact(client, candidate), debtorIban) };
    } catch (error) {
      if (!(error instanceof EvidenceCorrelationMismatchError)) throw error;
    }
  }
  throw new Error("No simulator statement exists for the debtor account before the payment upload");
}

function verify(
  fileType: SimulatorOutputType,
  bytes: Uint8Array,
  checkpoint: JourneyCheckpoint,
): StatementBalance | undefined {
  switch (fileType) {
    case "pain.002.001.10":
      verifyPain002(bytes, checkpoint.correlation);
      return undefined;
    case "camt.054.001.02":
      verifyCamt054(bytes, checkpoint.correlation);
      return undefined;
    case "camt.053.001.02":
      return verifyCamt053Transition(bytes, checkpoint.correlation, checkpoint.before);
  }
}

export async function collectSimulatorEvidence(
  client: SimulatorFilesClient,
  checkpoint: JourneyCheckpoint,
  options: {
    readonly timeoutMs?: number;
    readonly pollIntervalMs?: number;
    readonly now?: () => number;
    readonly sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<CollectedSimulatorEvidence> {
  if (
    checkpoint.before.accountIban !== checkpoint.correlation.debtorIban ||
    checkpoint.before.currency !== checkpoint.correlation.currency
  ) {
    throw new Error("The checkpoint balance scope does not match the exact payment");
  }
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs <= 0
  ) {
    throw new Error("Polling bounds must be positive safe integers");
  }
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = now() + timeoutMs;
  const prior = new Map(
    SIMULATOR_OUTPUT_TYPES.map((fileType) => [fileType, new Set(checkpoint.priorReferences[fileType])]),
  );
  const examined = new Map(SIMULATOR_OUTPUT_TYPES.map((fileType) => [fileType, new Set<string>()]));
  const matched = new Map<SimulatorOutputType, Uint8Array>();
  let after: StatementBalance | undefined;
  let downloadedCandidates = 0;

  while (now() <= deadline) {
    for (const fileType of SIMULATOR_OUTPUT_TYPES) {
      const candidates = (await listed(client, fileType)).filter(
        (descriptor) =>
          !prior.get(fileType)?.has(descriptor.FileReference) && !examined.get(fileType)?.has(descriptor.FileReference),
      );
      for (const descriptor of candidates) {
        downloadedCandidates += 1;
        if (downloadedCandidates > MAX_EVIDENCE_CANDIDATES) {
          throw new Error("The new simulator evidence candidate count exceeds the example bound");
        }
        examined.get(fileType)?.add(descriptor.FileReference);
        const bytes = await downloadExact(client, descriptor);
        try {
          const statement = verify(fileType, bytes, checkpoint);
          if (matched.has(fileType)) throw new Error(`More than one ${fileType} file correlates to the payment`);
          matched.set(fileType, bytes);
          if (statement) after = statement;
        } catch (error) {
          if (!(error instanceof EvidenceCorrelationMismatchError)) throw error;
        }
      }
    }
    if (SIMULATOR_OUTPUT_TYPES.every((fileType) => matched.has(fileType)) && after) {
      return {
        files: Object.fromEntries(
          SIMULATOR_OUTPUT_TYPES.map((fileType) => [fileType, matched.get(fileType)]),
        ) as Record<SimulatorOutputType, Uint8Array>,
        after,
      };
    }
    if (now() >= deadline) break;
    await sleep(pollIntervalMs);
  }
  throw new Error(
    checkpoint.phase === "upload_uncertain" || checkpoint.phase === "upload_started"
      ? "The upload outcome remains uncertain; no upload retry was attempted"
      : "The simulator did not publish every exact correlated output before the deadline",
  );
}
