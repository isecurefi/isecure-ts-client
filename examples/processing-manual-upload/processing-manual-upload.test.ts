import { describe, expect, it } from "vitest";
import { paymentTransferExternalId } from "./processing-manual-upload.js";

describe("manual Processing upload identifiers", () => {
  it("derives a deterministic unique Max35 end-to-end identifier from the run", () => {
    const first = paymentTransferExternalId("synthetic-0123456789abcdef01234567");
    const replay = paymentTransferExternalId("synthetic-0123456789abcdef01234567");
    const second = paymentTransferExternalId("synthetic-0123456789abcdef01234568");

    expect(first).toBe(replay);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^E2E-[a-f0-9]{31}$/u);
    expect(Array.from(first)).toHaveLength(35);
  });
});
