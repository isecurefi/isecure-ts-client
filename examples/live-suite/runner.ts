import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const CHECKS = [
  "fixture-preflight",
  "fixture-prepare",
  "shared-authentication",
  "simulator-access",
  "payment-feedback-statement",
] as const;
export type Check = (typeof CHECKS)[number];
export interface Report {
  version: 1;
  environment: "test";
  startedAt: string;
  finishedAt: string;
  status: "passed" | "failed" | "blocked";
  checks: { name: Check; status: "passed" | "failed" | "blocked" | "not-run" }[];
  cleanup: "passed" | "failed" | "not-needed";
}
export interface Adapter {
  preflight: () => Promise<void>;
  prepare: () => Promise<void>;
  authenticate: () => Promise<void>;
  simulator: () => Promise<void>;
  journey: () => Promise<void>;
  cleanup: () => Promise<void>;
}
export class PrerequisiteUnavailable extends Error {}

/** One invocation is one run. No retries of financial mutations or of the whole journey. */
export async function runSuite(adapter: Adapter, directory: string): Promise<Report> {
  await mkdir(directory, { mode: 0o700 }); // Refuse reusing an existing run directory.
  const report: Report = {
    version: 1,
    environment: "test",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    status: "failed",
    checks: CHECKS.map((name) => ({ name, status: "not-run" })),
    cleanup: "not-needed",
  };
  let preparationStarted = false;
  const persist = async () =>
    writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await persist();
  try {
    const actions = [
      () => adapter.preflight(),
      async () => {
        // Persist intent before any provisioning mutation; cleanup must accept partial preparation.
        await writeFile(path.join(directory, "cleanup-required.json"), '{"version":1}\n', { flag: "wx", mode: 0o600 });
        preparationStarted = true;
        await adapter.prepare();
      },
      () => adapter.authenticate(),
      () => adapter.simulator(),
      () => adapter.journey(),
    ];
    for (let index = 0; index < CHECKS.length; index += 1) {
      const action = actions[index];
      const check = report.checks[index];
      if (!action || !check) throw new Error("Invalid suite stage");
      try {
        await action();
        check.status = "passed";
      } catch (error) {
        check.status = index === 0 && error instanceof PrerequisiteUnavailable ? "blocked" : "failed";
        report.status = check.status === "blocked" ? "blocked" : "failed";
        return report;
      } finally {
        await persist();
      }
    }
    report.status = "passed";
    return report;
  } finally {
    if (preparationStarted) {
      try {
        await adapter.cleanup();
        report.cleanup = "passed";
      } catch {
        report.cleanup = "failed";
        report.status = "failed";
      }
    }
    report.finishedAt = new Date().toISOString();
    await persist();
  }
}

export async function cleanupInterrupted(adapter: Adapter, directory: string): Promise<void> {
  const marker = JSON.parse(await readFile(path.join(directory, "cleanup-required.json"), "utf8")) as {
    version?: number;
  };
  if (marker.version !== 1) throw new Error("Invalid cleanup marker");
  await adapter.cleanup();
  await writeFile(
    path.join(directory, "cleanup-recovery.json"),
    JSON.stringify({ version: 1, status: "passed", finishedAt: new Date().toISOString() }) + "\n",
    { mode: 0o600 },
  );
}
