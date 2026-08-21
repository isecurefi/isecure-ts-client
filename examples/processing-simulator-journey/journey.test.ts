import { describe, expect, it, vi } from "vitest";
import { paymentCorrelation, type SimulatorOutputType } from "./evidence.js";
import { baseline, camt053, camt054, IDS, pain001, pain002 } from "./fixtures.js";
import {
  captureBaseline,
  collectSimulatorEvidence,
  type FileDescriptor,
  type JourneyCheckpoint,
  type SimulatorFilesClient,
} from "./journey.js";

const descriptor = (
  fileType: SimulatorOutputType,
  reference: string,
  timestamp = "2026-08-21T12:00:00Z",
): FileDescriptor => ({
  FileReference: reference,
  FileTimestamp: timestamp,
  FileType: fileType,
  Status: "NEW",
});

class FakeFiles implements SimulatorFilesClient {
  public readonly downloads = vi.fn(async (fileType: string, reference: string) => {
    const bytes = this.contents.get(`${fileType}:${reference}`);
    if (!bytes) return { ResponseCode: "04", ResponseText: "not found", Content: "" };
    return { ResponseCode: "00", ResponseText: "ok", Content: Buffer.from(bytes).toString("base64") };
  });

  public readonly lists = vi.fn(async ({ FileType }: { readonly FileType: string; readonly Status: string }) => ({
    ResponseCode: "00",
    ResponseText: "ok",
    FileDescriptors: this.descriptors.filter((value) => value.FileType === FileType),
  }));

  public constructor(
    public readonly descriptors: FileDescriptor[],
    public readonly contents: Map<string, Uint8Array>,
  ) {}

  public listFiles(query: { readonly FileType: string; readonly Status: string }) {
    return this.lists(query);
  }

  public downloadFile(fileType: string, fileReference: string) {
    return this.downloads(fileType, fileReference);
  }
}

const prior = {
  "pain.002.001.10": ["old-pain002"],
  "camt.054.001.02": ["old-camt054"],
  "camt.053.001.02": ["old-camt053"],
} as const;

const checkpoint = (phase: JourneyCheckpoint["phase"] = "upload_accepted"): JourneyCheckpoint => ({
  version: 1,
  runId: "synthetic-run",
  phase,
  correlation: paymentCorrelation(pain001()),
  priorReferences: prior,
  before: {
    accountIban: IDS.account,
    currency: "EUR",
    openingAmount: "100.00",
    openingDirection: "CRDT",
    closingAmount: "100.00",
    closingDirection: "CRDT",
  },
});

function completeFiles(extra: readonly [SimulatorOutputType, string, Uint8Array][] = []): FakeFiles {
  const values: readonly [SimulatorOutputType, string, Uint8Array][] = [
    ["pain.002.001.10", "new-pain002", pain002()],
    ["camt.054.001.02", "new-camt054", camt054()],
    ["camt.053.001.02", "new-camt053", camt053()],
    ...extra,
  ];
  return new FakeFiles(
    values.map(([fileType, reference]) => descriptor(fileType, reference)),
    new Map(values.map(([fileType, reference, bytes]) => [`${fileType}:${reference}`, bytes])),
  );
}

describe("synthetic simulator evidence collection", () => {
  it("accepts exact correlated outputs regardless of publication order", async () => {
    const client = completeFiles();
    client.descriptors.reverse();
    await expect(collectSimulatorEvidence(client, checkpoint())).resolves.toMatchObject({
      after: { closingAmount: "87.66" },
    });
    expect(client.downloads).toHaveBeenCalledTimes(3);
  });

  it("ignores a valid output from another scope but refuses duplicate exact evidence", async () => {
    const other = pain002("OTHER-TENANT-MESSAGE");
    const client = completeFiles([["pain.002.001.10", "other-pain002", other]]);
    await expect(collectSimulatorEvidence(client, checkpoint())).resolves.toBeDefined();

    const duplicate = completeFiles([["pain.002.001.10", "duplicate-pain002", pain002()]]);
    await expect(collectSimulatorEvidence(duplicate, checkpoint())).rejects.toThrow("More than one pain.002");
  });

  it("never turns an uncertain restart into an upload and reports bounded uncertainty on timeout", async () => {
    const client = new FakeFiles([], new Map());
    let time = 0;
    await expect(
      collectSimulatorEvidence(client, checkpoint("upload_uncertain"), {
        timeoutMs: 2,
        pollIntervalMs: 1,
        now: () => time,
        sleep: async (milliseconds) => {
          time += milliseconds;
        },
      }),
    ).rejects.toThrow("remains uncertain; no upload retry");
    expect(client.downloads).not.toHaveBeenCalled();
  });

  it("refuses a checkpoint whose statement scope was substituted", async () => {
    const current = checkpoint();
    const substituted: JourneyCheckpoint = {
      ...current,
      before: { ...current.before, accountIban: "FI4912345600000786" },
    };
    await expect(collectSimulatorEvidence(completeFiles(), substituted)).rejects.toThrow("balance scope");
  });

  it("fails on truncated Base64, mismatched descriptors, and duplicate listing references", async () => {
    const truncated = completeFiles();
    truncated.downloadFile = vi.fn(async () => ({ ResponseCode: "00", Content: "eA" }));
    await expect(collectSimulatorEvidence(truncated, checkpoint())).rejects.toThrow("truncated");

    const mismatch: SimulatorFilesClient = {
      listFiles: vi.fn(async ({ FileType }) => ({
        ResponseCode: "00",
        FileDescriptors:
          FileType === "pain.002.001.10"
            ? [{ ...descriptor("pain.002.001.10", "wrong-type"), FileType: "camt.054.001.02" }]
            : [],
      })),
      downloadFile: vi.fn(),
    };
    await expect(collectSimulatorEvidence(mismatch, checkpoint())).rejects.toThrow("mismatched descriptor");

    const duplicate = completeFiles();
    const first = duplicate.descriptors[0];
    if (!first) throw new Error("Synthetic fixture is incomplete");
    duplicate.descriptors.push(first);
    await expect(collectSimulatorEvidence(duplicate, checkpoint())).rejects.toThrow("listing contains a duplicate");
  });

  it("captures the latest exact statement as the pre-upload balance", async () => {
    const client = new FakeFiles(
      [
        descriptor("camt.053.001.02", "older", "2026-08-20T12:00:00Z"),
        descriptor("camt.053.001.02", "latest", "2026-08-21T12:00:00Z"),
      ],
      new Map([
        ["camt.053.001.02:older", baseline("90.00")],
        ["camt.053.001.02:latest", baseline("100.00")],
      ]),
    );
    await expect(captureBaseline(client, IDS.account)).resolves.toMatchObject({
      before: { closingAmount: "100.00" },
      priorReferences: { "camt.053.001.02": ["older", "latest"] },
    });
  });

  it("skips a newer statement for another account and refuses maximum-plus-one listings", async () => {
    const otherAccount = new TextEncoder().encode(
      new TextDecoder().decode(baseline("110.00")).replace(IDS.account, "FI4912345600000786"),
    );
    const client = new FakeFiles(
      [
        descriptor("camt.053.001.02", "correct", "2026-08-20T12:00:00Z"),
        descriptor("camt.053.001.02", "other-account", "2026-08-21T12:00:00Z"),
      ],
      new Map([
        ["camt.053.001.02:correct", baseline("100.00")],
        ["camt.053.001.02:other-account", otherAccount],
      ]),
    );
    await expect(captureBaseline(client, IDS.account)).resolves.toMatchObject({
      before: { closingAmount: "100.00" },
    });

    const oversized = new FakeFiles(
      Array.from({ length: 257 }, (_, index) => descriptor("pain.002.001.10", `reference-${index}`)),
      new Map(),
    );
    await expect(collectSimulatorEvidence(oversized, checkpoint())).rejects.toThrow("exceeds the example bound");
  });
});
