import type { SimulatorFilesClient } from "../processing-simulator-journey/journey.js";
import { SIMULATOR_OUTPUT_TYPES } from "../processing-simulator-journey/evidence.js";

export type FileTimes = ReadonlyMap<string, string>;

/** Check only file metadata; never log file identities, timestamps or downloaded bytes. */
export async function snapshotFileTimes(client: SimulatorFilesClient): Promise<FileTimes> {
  const times = new Map<string, string>();
  for (const fileType of SIMULATOR_OUTPUT_TYPES) {
    const response = await client.listFiles({ FileType: fileType, Status: "ALL" });
    if (response.ResponseCode !== "00") throw new Error("TIMESTAMP_LIST_REFUSED");
    const observed: unknown = response.FileDescriptors;
    if (observed !== null && (!Array.isArray(observed) || observed.length > 256))
      throw new Error("TIMESTAMP_LIST_INVALID");
    for (const file of response.FileDescriptors ?? []) {
      if (
        file.FileType !== fileType ||
        typeof file.FileReference !== "string" ||
        !file.FileReference ||
        typeof file.FileTimestamp !== "string" ||
        !Number.isFinite(Date.parse(file.FileTimestamp))
      )
        throw new Error("TIMESTAMP_DESCRIPTOR_INVALID");
      const key = JSON.stringify([fileType, file.FileReference]);
      if (times.has(key)) throw new Error("TIMESTAMP_DUPLICATE_FILE");
      times.set(key, file.FileTimestamp);
    }
  }
  if (!times.size) throw new Error("TIMESTAMP_EVIDENCE_MISSING");
  return times;
}

export function assertRetainedFileTimes(before: FileTimes, after: FileTimes): void {
  for (const [key, timestamp] of before) {
    if (after.get(key) !== timestamp) throw new Error("TIMESTAMP_RETAINED_FILE_CHANGED");
  }
}

export async function verifyStableFileTimes(
  client: SimulatorFilesClient,
  sleep: (milliseconds: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<FileTimes> {
  const first = await snapshotFileTimes(client);
  // Cross the wire clock's whole-second resolution, so a request-time timestamp cannot pass.
  await sleep(2200);
  assertRetainedFileTimes(first, await snapshotFileTimes(client));
  const downloadedTypes = new Set<string>();
  for (const key of first.keys()) {
    const [fileType, reference] = JSON.parse(key) as [string, string];
    if (downloadedTypes.has(fileType)) continue;
    const response = await client.downloadFile(fileType, reference);
    if (response.ResponseCode !== "00") throw new Error("TIMESTAMP_DOWNLOAD_REFUSED");
    downloadedTypes.add(fileType);
  }
  assertRetainedFileTimes(first, await snapshotFileTimes(client));
  return first;
}
