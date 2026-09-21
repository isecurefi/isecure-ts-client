import { describe, expect, it, vi } from "vitest";
import { assertRetainedFileTimes, snapshotFileTimes, verifyStableFileTimes } from "./timestamps.js";
import type { SimulatorFilesClient } from "../processing-simulator-journey/journey.js";

function fixture() {
  let timestamp = "2026-09-20T12:00:00Z";
  const download = vi.fn(async () => ({ ResponseCode: "00", Content: "eA==" }));
  const client: SimulatorFilesClient = {
    listFiles: vi.fn(async ({ FileType }: { FileType: string }) => ({
      ResponseCode: "00",
      FileDescriptors:
        FileType === "camt.053.001.02"
          ? [
              {
                FileType,
                FileReference: "retained",
                FileTimestamp: timestamp,
                Status: "NEW",
              },
            ]
          : null,
    })),
    downloadFile: download,
  };
  return {
    client,
    download,
    change: (value: string) => {
      timestamp = value;
    },
  };
}

describe("live timestamp regression", () => {
  it("checks repeated lists across a clock tick and after download, allowing empty feedback types", async () => {
    const { client, download } = fixture();
    const sleep = vi.fn(() => Promise.resolve());
    const result = await verifyStableFileTimes(client, sleep);
    expect(result.size).toBe(1);
    expect(sleep).toHaveBeenCalledWith(2200);
    expect(download).toHaveBeenCalledTimes(1);
  });
  it("detects the original request-time timestamp defect", async () => {
    const { client, change, download } = fixture();
    await expect(
      verifyStableFileTimes(client, async () => {
        change("2026-09-21T12:00:00Z");
      }),
    ).rejects.toThrow("TIMESTAMP_RETAINED_FILE_CHANGED");
    expect(download).not.toHaveBeenCalled();
  });
  it("detects timestamps changed by downloading", async () => {
    const { client, change } = fixture();
    client.downloadFile = vi.fn(async () => {
      change("2026-09-21T12:00:00Z");
      return { ResponseCode: "00", Content: "eA==" };
    });
    await expect(verifyStableFileTimes(client, () => Promise.resolve())).rejects.toThrow(
      "TIMESTAMP_RETAINED_FILE_CHANGED",
    );
  });
  it("allows new payment files while refusing changed or missing retained files", () => {
    const before = new Map([["retained", "2026-09-20T12:00:00Z"]]);
    expect(() => {
      assertRetainedFileTimes(before, new Map([...before, ["new", "2026-09-21T12:00:00Z"]]));
    }).not.toThrow();
    expect(() => {
      assertRetainedFileTimes(before, new Map());
    }).toThrow("TIMESTAMP_RETAINED_FILE_CHANGED");
  });
  it("refuses invalid timestamp evidence and failed bank responses", async () => {
    const { client, change } = fixture();
    change("invalid");
    await expect(snapshotFileTimes(client)).rejects.toThrow("TIMESTAMP_DESCRIPTOR_INVALID");
    client.listFiles = async () => ({ ResponseCode: "01", FileDescriptors: null });
    await expect(snapshotFileTimes(client)).rejects.toThrow("TIMESTAMP_LIST_REFUSED");
    client.listFiles = async () => ({ ResponseCode: "00", FileDescriptors: null });
    await expect(snapshotFileTimes(client)).rejects.toThrow("TIMESTAMP_EVIDENCE_MISSING");
  });
});
