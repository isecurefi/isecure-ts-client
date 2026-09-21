import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupInterrupted, requireSettledRuns, PrerequisiteUnavailable, runSuite, type Adapter } from "./runner.js";
const roots: string[] = [];
async function location() {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-suite-test-"));
  roots.push(root);
  return path.join(root, "run");
}
function adapter(): Adapter {
  return {
    preflight: vi.fn(async () => {
      return;
    }),
    prepare: vi.fn(async () => {
      return;
    }),
    authenticate: vi.fn(async () => {
      return;
    }),
    simulator: vi.fn(async () => {
      return;
    }),
    journey: vi.fn(async () => {
      return;
    }),
    cleanup: vi.fn(async () => {
      return;
    }),
  };
}
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
describe("live suite orchestration", () => {
  it("executes one journey per invocation, with independent directories on a second invocation", async () => {
    const a = adapter();
    const first = await location(),
      second = await location();
    expect((await runSuite(a, first)).status).toBe("passed");
    expect(a.journey).toHaveBeenCalledTimes(1);
    expect((await runSuite(a, second)).status).toBe("passed");
    expect(a.journey).toHaveBeenCalledTimes(2);
    expect(a.cleanup).toHaveBeenCalledTimes(2);
  });
  it("reports missing admission as blocked without any provisioning or cleanup mutation", async () => {
    const a = adapter();
    a.preflight = vi.fn(async () => {
      throw new PrerequisiteUnavailable("secret-token");
    });
    const dir = await location();
    const report = await runSuite(a, dir);
    expect(report.status).toBe("blocked");
    expect(a.prepare).not.toHaveBeenCalled();
    expect(a.cleanup).not.toHaveBeenCalled();
    expect(await readFile(path.join(dir, "report.json"), "utf8")).not.toContain("secret-token");
  });
  it("persists cleanup intent before prepare, and cleans partial preparation", async () => {
    const dir = await location(),
      a = adapter();
    a.prepare = vi.fn(async () => {
      expect(JSON.parse(await readFile(path.join(dir, "cleanup-required.json"), "utf8"))).toEqual({ version: 1 });
      throw new Error("partial mutation");
    });
    const report = await runSuite(a, dir);
    expect(report.status).toBe("failed");
    expect(report.cleanup).toBe("passed");
    expect(a.cleanup).toHaveBeenCalledTimes(1);
    expect(a.journey).not.toHaveBeenCalled();
  });
  it("does not retry an uncertain payment and still cleans its fixture", async () => {
    const a = adapter();
    a.journey = vi.fn(async () => {
      throw new Error("uncertain response");
    });
    const report = await runSuite(a, await location());
    expect(report.status).toBe("failed");
    expect(a.journey).toHaveBeenCalledTimes(1);
    expect(a.cleanup).toHaveBeenCalledTimes(1);
  });
  it("cannot report success when cleanup fails, and supports a separate cleanup recovery", async () => {
    const a = adapter(),
      dir = await location();
    a.cleanup = vi.fn(async () => {
      throw new Error("cleanup unavailable");
    });
    const report = await runSuite(a, dir);
    expect(report.status).toBe("failed");
    expect(report.cleanup).toBe("failed");
    a.cleanup = vi.fn(async () => {
      return;
    });
    await cleanupInterrupted(a, dir);
    expect(a.journey).toHaveBeenCalledTimes(1);
    expect(a.cleanup).toHaveBeenCalledTimes(1);
  });
  it("refuses an existing run directory before executing anything", async () => {
    const a = adapter(),
      dir = await location();
    await runSuite(a, dir);
    await expect(runSuite(a, dir)).rejects.toThrow();
    expect(a.prepare).toHaveBeenCalledTimes(1);
  });
  it("does not include raw error messages or responses in the report", async () => {
    const a = adapter(),
      dir = await location();
    a.authenticate = vi.fn(async () => {
      throw new Error("password=secret private key payment payload");
    });
    await runSuite(a, dir);
    const contents = await readFile(path.join(dir, "report.json"), "utf8");
    expect(contents).not.toMatch(/password|secret|private key|payment payload/u);
  });
});

describe("unattended live runs", () => {
  it("admits clean history and a completed, cleaned-up run", async () => {
    const directory = await location();
    const root = path.dirname(directory);
    await expect(requireSettledRuns(root)).resolves.toBeUndefined();
    await runSuite(adapter(), path.join(root, "run-complete"));
    await expect(requireSettledRuns(root)).resolves.toBeUndefined();
  });
  it.each(["missing", "failed", "cleanup-failed"])("refuses %s history before another payment", async (kind) => {
    const root = path.dirname(await location());
    const run = path.join(root, "run-prior");
    if (kind === "missing") await mkdir(run);
    else {
      const a = adapter();
      if (kind === "failed") a.journey = () => Promise.reject(new Error("uncertain"));
      else a.cleanup = () => Promise.reject(new Error("cleanup"));
      await runSuite(a, run);
    }
    await expect(requireSettledRuns(root)).rejects.toThrow("LIVE_HISTORY_REQUIRES_REVIEW");
  });
  it("refuses a report with missing checks even if its status says passed", async () => {
    const root = path.dirname(await location());
    const run = path.join(root, "run-prior");
    const report = await runSuite(adapter(), run);
    await writeFile(path.join(run, "report.json"), JSON.stringify({ ...report, checks: [] }));
    await expect(requireSettledRuns(root)).rejects.toThrow("LIVE_HISTORY_REQUIRES_REVIEW");
  });
});
