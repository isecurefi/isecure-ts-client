import { describe, expect, it, vi } from "vitest";
import type { WSChannel } from "../../src/index.js";
import { permittedProductionOperation, productionFetch, PRODUCTION_ORIGIN, runProductionChecks } from "./production.js";

describe("production qualification traffic boundary", () => {
  it("permits generation and bounded draft lifecycle paths only", () => {
    expect(permittedProductionOperation(`${PRODUCTION_ORIGIN}/v1/payment-orders:generate-file`, "POST")).toBe(
      "payment_orders.generate_file",
    );
    expect(permittedProductionOperation(`${PRODUCTION_ORIGIN}/session`, "POST")).toBe("session");
  });
  it.each([
    ["https://ws-api.isecure.fi/v2", "POST"],
    ["https://processing-api.test.isecure.fi/session", "POST"],
    [`${PRODUCTION_ORIGIN}/v1/payment-orders/00000000-0000-4000-8000-000000000001:execute`, "POST"],
    [`${PRODUCTION_ORIGIN}/v1/payment-orders/00000000-0000-4000-8000-000000000001:submit-for-review`, "POST"],
    [`${PRODUCTION_ORIGIN}/v1/payment-exports:release`, "POST"],
    ["https://secret@processing-api.isecure.fi/session", "POST"],
    [`${PRODUCTION_ORIGIN}/session#secret`, "POST"],
  ])("refuses %s before dispatch", async (url, method) => {
    const delegate = vi.fn<typeof fetch>();
    await expect(productionFetch([], delegate)(url, { method })).rejects.toThrow("REFUSED");
    expect(delegate).not.toHaveBeenCalled();
  });
  it("blocks redirects, bounds calls, and retains only safe response metadata", async () => {
    const delegate = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeDefined();
      return new Response("secret bank contents", {
        headers: { "x-amzn-requestid": "request-123", "set-cookie": "secret" },
      });
    });
    const observations: Parameters<typeof productionFetch>[0] = [];
    const run = productionFetch(observations, delegate);
    for (let i = 0; i < 100; i++) await run(`${PRODUCTION_ORIGIN}/session`, { method: "POST" });
    await expect(run(`${PRODUCTION_ORIGIN}/session`, { method: "POST" })).rejects.toThrow("BUDGET");
    expect(delegate).toHaveBeenCalledTimes(100);
    expect(observations[0]).toMatchObject({ operation: "session", status: 200, requestId: "request-123" });
    expect(JSON.stringify(observations)).not.toContain("secret");
  });
  it("never retries a failed request", async () => {
    const delegate = vi.fn<typeof fetch>().mockRejectedValue(new Error("connection lost"));
    await expect(productionFetch([], delegate)(`${PRODUCTION_ORIGIN}/session`, { method: "POST" })).rejects.toThrow(
      "connection lost",
    );
    expect(delegate).toHaveBeenCalledTimes(1);
  });
  it("records a failed prerequisite and never reaches payment operations or copies private inputs", async () => {
    const delegate = vi.fn<typeof fetch>().mockResolvedValue(new Response("secret response", { status: 500 }));
    vi.stubGlobal("fetch", delegate);
    const snapshots: string[] = [];
    try {
      const channel = {
        props: { BaseUrl: "https://ws-api.isecure.fi/v2", Company: "ISECure Synthetic Processing Qualification" },
      } as WSChannel;
      const report = await runProductionChecks(
        channel,
        {
          sourceRevision: "a".repeat(40),
          sdkRevision: "b".repeat(40),
          codeSha256: "A".repeat(43) + "=",
          gatewayDeploymentId: "07625h",
          ...{ extraSecret: "secret input" },
        },
        (report) => {
          snapshots.push(JSON.stringify(report));
          return Promise.resolve();
        },
      );
      expect(report.status).toBe("failed");
      expect(report.cleanup).toBe("required");
      expect(report.checks).toEqual([{ name: "gateway-missing-key", status: "failed" }]);
      expect(delegate).toHaveBeenCalledTimes(1);
      expect(snapshots[0]).toContain('"status":"running"');
      expect(snapshots.join("\n")).not.toContain("secret");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
