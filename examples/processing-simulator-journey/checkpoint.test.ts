import { chmod, lstat, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { paymentCorrelation } from "./evidence.js";
import { IDS, pain001 } from "./fixtures.js";
import { readCheckpoint, withPhase, writeCheckpoint } from "./checkpoint.js";
import type { JourneyCheckpoint } from "./journey.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryFile(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "isecure-paymentsim-"));
  directories.push(directory);
  return path.join(directory, "checkpoint.json");
}

const value = (): JourneyCheckpoint => ({
  version: 1,
  runId: "synthetic-run",
  phase: "upload_started",
  correlation: paymentCorrelation(pain001()),
  priorReferences: {
    "pain.002.001.10": ["prior-status"],
    "camt.054.001.02": ["prior-notification"],
    "camt.053.001.02": ["prior-statement"],
  },
  before: {
    accountIban: IDS.account,
    currency: "EUR",
    openingAmount: "100.00",
    openingDirection: "CRDT",
    closingAmount: "100.00",
    closingDirection: "CRDT",
  },
});

describe("private simulator journey checkpoint", () => {
  it("round-trips only bounded restart state in a private regular file", async () => {
    const file = await temporaryFile();
    await writeCheckpoint(file, value());
    expect((await lstat(file)).mode & 0o077).toBe(0);
    await expect(readCheckpoint(file, "synthetic-run")).resolves.toEqual(value());
    await writeCheckpoint(file, withPhase(value(), "upload_uncertain"));
    await expect(readCheckpoint(file, "synthetic-run")).resolves.toMatchObject({ phase: "upload_uncertain" });
    const withoutInstruction = {
      ...value(),
      correlation: { ...value().correlation, instructionId: null },
    };
    await writeCheckpoint(file, withoutInstruction);
    await expect(readCheckpoint(file, "synthetic-run")).resolves.toEqual(withoutInstruction);
  });

  it("rejects a different run, corrupt content, duplicate references, and non-private files", async () => {
    const file = await temporaryFile();
    await writeCheckpoint(file, value());
    await expect(readCheckpoint(file, "other-run")).rejects.toThrow("version, run, or phase");
    await writeFile(file, "not-json", { mode: 0o600 });
    await expect(readCheckpoint(file, "synthetic-run")).rejects.toThrow();
    await writeFile(
      file,
      `${JSON.stringify({ ...value(), priorReferences: { ...value().priorReferences, "pain.002.001.10": ["same", "same"] } })}\n`,
      { mode: 0o600 },
    );
    await expect(readCheckpoint(file, "synthetic-run")).rejects.toThrow("Duplicate checkpoint references");
    if (process.platform !== "win32") {
      await writeFile(file, `${JSON.stringify(value())}\n`, { mode: 0o644 });
      await chmod(file, 0o644);
      await expect(readCheckpoint(file, "synthetic-run")).rejects.toThrow("must not be accessible");
    }
  });

  it("rejects symbolic-link substitution", async () => {
    const file = await temporaryFile();
    const target = path.join(path.dirname(file), "target.json");
    await writeFile(target, `${JSON.stringify(value())}\n`, { mode: 0o600 });
    await symlink(target, file);
    await expect(readCheckpoint(file, "synthetic-run")).rejects.toThrow("regular file");
  });

  it("rejects a symbolic-link checkpoint directory", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "isecure-paymentsim-target-"));
    directories.push(directory);
    const linkRoot = await mkdtemp(path.join(os.tmpdir(), "isecure-paymentsim-link-"));
    directories.push(linkRoot);
    const linkedDirectory = path.join(linkRoot, "checkpoint-dir");
    await symlink(directory, linkedDirectory);
    await expect(writeCheckpoint(path.join(linkedDirectory, "checkpoint.json"), value())).rejects.toThrow(
      "regular directory",
    );
  });
});
