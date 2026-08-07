import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { iso20022Operations } from "../generated/iso20022-contracts.js";

interface PlatformContractLock {
  schemaVersion: number;
  source: {
    repository: string;
    revision: string;
    processingClientSha256: string;
    processingOpenApiSha256: string;
    processingMockSha256: string;
  };
  generatedMock: {
    path: string;
    sha256: string;
  };
  generated: {
    path: string;
    sha256: string;
    operationIds: string[];
  };
}

describe("generated platform contract parity", () => {
  it("binds the exposed operation inventory to one digest-pinned platform revision", async () => {
    const root = resolve(import.meta.dirname, "../..");
    const lock = JSON.parse(
      await readFile(resolve(root, "platform-contracts.lock.json"), "utf8"),
    ) as PlatformContractLock;
    const [generated, generatedMock] = await Promise.all([
      readFile(resolve(root, lock.generated.path)),
      readFile(resolve(root, lock.generatedMock.path)),
    ]);

    expect(lock.schemaVersion).toBe(1);
    expect(lock.source.repository).toBe("isecurefi/bankfiles-platform");
    expect(lock.source.revision).toMatch(/^[0-9a-f]{40}$/u);
    expect(lock.source.processingClientSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.source.processingOpenApiSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.source.processingMockSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.generated.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(lock.generatedMock.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(createHash("sha256").update(generated).digest("hex")).toBe(lock.generated.sha256);
    expect(createHash("sha256").update(generatedMock).digest("hex")).toBe(lock.generatedMock.sha256);
    expect(JSON.parse(generatedMock.toString("utf8"))).toMatchObject({
      source: {
        safety: {
          syntheticOnly: true,
          tenantAuthority: false,
          customerData: false,
          productionCredentials: false,
          genericTools: [],
          filesystemAccess: false,
          networkAccess: false,
          financialSideEffects: false,
        },
      },
    });
    expect(Object.keys(iso20022Operations)).toEqual(lock.generated.operationIds);
    expect(
      Object.values(iso20022Operations).every((operation) => operation.method === "GET" || operation.method === "POST"),
    ).toBe(true);
    expect(
      Object.values(iso20022Operations).every((operation) => operation.requestBody === (operation.method === "POST")),
    ).toBe(true);
    expect(
      Object.values(iso20022Operations).every(
        (operation) => operation.expectedVersion === "none" || operation.idempotency === "required",
      ),
    ).toBe(true);
    for (const operation of Object.values(iso20022Operations)) {
      expect(operation.idempotencyKeySchema).toEqual(
        operation.idempotency === "required"
          ? { type: "string", minLength: 1, maxLength: 256, pattern: "^[!-~]+(?![\\s\\S])" }
          : null,
      );
      expect(operation.expectedResourceVersionSchema).toEqual(
        operation.expectedVersion === "required"
          ? { type: "string", minLength: null, maxLength: null, pattern: '^"(?:0|[1-9][0-9]*)"$' }
          : null,
      );
    }
    expect(new Set(Object.values(iso20022Operations).map((operation) => operation.contractDigest)).size).toBe(
      lock.generated.operationIds.length,
    );
  });
});
