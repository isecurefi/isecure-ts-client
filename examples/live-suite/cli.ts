import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupInterrupted, requireSettledRuns, PrerequisiteUnavailable, runSuite, type Adapter } from "./runner.js";

async function command(script: string, args: string[], milliseconds: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: "ignore", env: process.env });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, milliseconds);
    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, milliseconds + 5000);
    child.once("error", () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      reject(new Error("Child process failed"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  if (process.versions.node.split(".")[0] !== "24") throw new Error("Node.js 24 is required");
  const args = process.argv.slice(2);
  const recover = args[0] === "cleanup";
  const scheduled = args[0] === "scheduled";
  const values = recover || scheduled ? args.slice(1) : args;
  if (values.length !== (recover ? 3 : 2))
    throw new Error(
      "Usage: test:live [cleanup|scheduled] <ws-channel-api-root> <private-fixture-config.json> [run-directory]",
    );
  const [backendRoot, config] = values as [string, string];
  if (!path.isAbsolute(backendRoot) || !path.isAbsolute(config)) throw new Error("Absolute paths are required");
  const operator = path.join(backendRoot, "scripts/live-suite-fixture.mjs");
  if (!(await lstat(operator)).isFile()) throw new Error("The guarded backend fixture adapter is required");
  const root = path.resolve(".isecure-live-suite");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || (rootInfo.mode & 0o077) !== 0)
    throw new Error("Run root must be a private directory");
  if (scheduled) await requireSettledRuns(root);
  const directory = recover ? path.resolve(values[2] ?? "") : path.join(root, `run-${randomUUID()}`);
  const driver = async (action: string) => {
    const code = await command(operator, [action, config, directory], 240000);
    if (code === 42 && action === "preflight") throw new PrerequisiteUnavailable();
    if (code !== 0) throw new Error("Fixture action failed");
  };
  const worker = fileURLToPath(new URL("./worker.js", import.meta.url));
  let workerExit = 1;
  const runWorker = async () => {
    workerExit = await command(worker, [directory], 600000);
  };
  // One worker retains its authenticated sessions across the three API checks.
  // Worker receipts contain fixed stage names only, never responses or exception messages.
  const receiptPassed = async (name: string) => {
    const receipt = JSON.parse(await readFile(path.join(directory, "workflow.json"), "utf8")) as { passed?: string[] };
    if (!receipt.passed?.includes(name)) throw new Error("Workflow stage did not pass");
  };
  const adapter: Adapter = {
    preflight: () => driver("preflight"),
    prepare: () => driver("prepare"),
    authenticate: async () => {
      await runWorker();
      await receiptPassed("shared-authentication");
    },
    simulator: () => receiptPassed("simulator-access"),
    journey: async () => {
      await receiptPassed("payment-feedback-statement");
      if (workerExit !== 0) throw new Error("Live workflow failed");
    },
    cleanup: () => driver("cleanup"),
  };
  if (recover) {
    await cleanupInterrupted(adapter, directory);
    console.log("Interrupted-run cleanup passed.");
    return;
  }
  const report = await runSuite(adapter, directory);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: report.checks,
        cleanup: report.cleanup,
        report: path.join(directory, "report.json"),
      },
      null,
      2,
    ),
  );
  process.exitCode = report.status === "passed" ? 0 : report.status === "blocked" ? 2 : 1;
}
main().catch(() => {
  console.error(
    "Live suite stopped safely. Check configuration or the private run report; no automatic retry was attempted.",
  );
  process.exitCode = 1;
});
