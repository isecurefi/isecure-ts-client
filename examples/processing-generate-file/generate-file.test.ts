import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  GeneratedPaymentFileContent,
  PaymentExportProfileResource,
  PaymentOrderFinalizationResult,
} from "../../src/iso20022/index.js";
import { generationQuery, requireVerifiedPain001, transferExternalId } from "./generate-file.js";

const PAIN = `<?xml version="1.0" encoding="UTF-8"?>\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"><CstmrCdtTrfInitn/></Document>\n`;

function content(xml: string, overrides: Partial<GeneratedPaymentFileContent> = {}): GeneratedPaymentFileContent {
  const bytes = new TextEncoder().encode(xml);
  return {
    artifact_id: "synthetic-artifact",
    artifact_digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    artifact_byte_length: String(bytes.length),
    artifact_media_type: "application/xml",
    bytes,
    ...overrides,
  };
}

describe("generate-file example", () => {
  it("derives a stable Max35 end-to-end identifier from the run", () => {
    const first = transferExternalId("synthetic-run-001");
    expect(first).toBe(transferExternalId("synthetic-run-001"));
    expect(first).not.toBe(transferExternalId("synthetic-run-002"));
    expect(first).toMatch(/^E2E-[a-f0-9]{31}$/u);
    expect(first).toHaveLength(35);
  });

  it("binds the query to a finalized revision and an active profile only", () => {
    const finalized = {
      mutation: { workflow_state: "finalized", revision_id: "rev-2" },
    } as PaymentOrderFinalizationResult;
    const profile = {
      state: "active",
      payment_export_profile_id: "profile-1",
      profile_revision: "4",
    } as PaymentExportProfileResource;
    expect(generationQuery("order-1", finalized, profile)).toEqual({
      payment_order_id: "order-1",
      order_revision_id: "rev-2",
      payment_export_profile_id: "profile-1",
      profile_revision: "4",
    });
    const draft = { mutation: { workflow_state: "draft", revision_id: "rev-1" } } as PaymentOrderFinalizationResult;
    expect(() => generationQuery("order-1", draft, profile)).toThrow("not finalized");
    expect(() => generationQuery("order-1", finalized, { ...profile, state: "revoked" })).toThrow("not active");
  });

  it("accepts only pain.001.001.09 bytes that match the returned integrity metadata", () => {
    expect(() => {
      requireVerifiedPain001(content(PAIN));
    }).not.toThrow();
    expect(() => {
      requireVerifiedPain001(content(PAIN, { artifact_digest: "sha256:" + "0".repeat(64) }));
    }).toThrow("integrity");
    expect(() => {
      requireVerifiedPain001(content(PAIN, { artifact_byte_length: "1" }));
    }).toThrow("integrity");
    expect(() => {
      requireVerifiedPain001(content(PAIN.replace("pain.001.001.09", "pain.001.001.03")));
    }).toThrow("pain.001.001.09");
    expect(() => {
      requireVerifiedPain001(content(`<!DOCTYPE x>${PAIN}`));
    }).toThrow("pain.001.001.09");
  });
});
