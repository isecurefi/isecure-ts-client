import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INLINE_JSON_BUDGET,
  ISecureTransferError,
  readTransferSupport,
  prepareInlineUpload,
  decodeInlineResult,
} from "./file-transfers.js";

export const advertised = {
  ContractVersion: 1,
  Bank: "simulator",
  Protocols: ["inline-v1"],
  Encodings: ["identity"],
  Delivery: ["inline"],
  MaxRawUploadBytes: 1000,
  MaxRawDownloadBytes: 1000,
  MaxInlineRequestBytes: 2000,
};
const certs = (caps?: unknown) => ({
  ResponseCode: "00",
  ResponseText: "OK",
  Certs: [],
  ...(caps === undefined ? {} : { FileTransferCapabilities: caps }),
});
const metadata = { FileName: "a.xml", FileType: "pain.001", Signature: "synthetic-signature" };

describe("file transfer boundary", () => {
  it("keeps runtime numeric and enumeration boundaries aligned with the owning JSON schema", () => {
    const spec = JSON.parse(readFileSync(new URL("../../wsapi_v2.json", import.meta.url), "utf8")) as {
      definitions: {
        FileTransferCapability: {
          properties: Record<string, { minimum?: number; maximum?: number; items?: { enum: string[] } }>;
        };
      };
    };
    const fields = spec.definitions.FileTransferCapability.properties;
    for (const name of ["MaxRawUploadBytes", "MaxRawDownloadBytes", "MaxInlineRequestBytes"]) {
      const field = fields[name];
      expect(field).toBeDefined();
      for (const value of [field?.minimum, field?.maximum]) {
        expect(readTransferSupport(certs([{ ...advertised, [name]: value }]), "simulator").protocol).toBe("inline-v1");
      }
      for (const value of [0, (field?.maximum ?? 0) + 1, NaN, Infinity, "100", null]) {
        expect(() => readTransferSupport(certs([{ ...advertised, [name]: value }]), "simulator")).toThrow(
          ISecureTransferError,
        );
      }
    }
    for (const name of ["Protocols", "Encodings", "Delivery"]) {
      for (const value of fields[name]?.items?.enum ?? []) {
        expect(() => readTransferSupport(certs([{ ...advertised, [name]: [value] }]), "simulator")).not.toThrow();
      }
    }
  });
  it("recognizes legacy only from a successful authenticated metadata envelope", () => {
    expect(readTransferSupport(certs(), "simulator").protocol).toBe("legacy-inline");
    for (const value of [
      null,
      {},
      [],
      { Certs: [] },
      { ResponseCode: "01", Certs: [] },
      { ResponseCode: "00" },
      { ResponseCode: "00", Certs: null },
    ]) {
      expect(() => readTransferSupport(value, "simulator")).toThrow(ISecureTransferError);
    }
  });
  it("selects advertised identity inline without assuming environment or runtime", () => {
    expect(readTransferSupport(certs([advertised]), "simulator")).toMatchObject({
      protocol: "inline-v1",
      maxRawUploadBytes: 1000,
    });
    expect(readTransferSupport(certs([]), "simulator").protocol).toBe("unavailable");
    expect(readTransferSupport(certs([{ ...advertised, Bank: "other" }]), "simulator").protocol).toBe("unavailable");
    expect(readTransferSupport(certs([{ ...advertised, Protocols: ["transfer-v1"] }]), "simulator").protocol).toBe(
      "unavailable",
    );
  });
  it.each([
    null,
    {},
    [null],
    [advertised, advertised],
    [{ ...advertised, ContractVersion: 2 }],
    [{ ...advertised, MaxRawUploadBytes: -1 }],
    [{ ...advertised, MaxRawDownloadBytes: 1.2 }],
    [{ ...advertised, MaxInlineRequestBytes: INLINE_JSON_BUDGET + 1 }],
    [{ ...advertised, Encodings: ["unknown"] }],
    [{ ...advertised, Protocols: [] }],
    [{ ...advertised, Extra: true }],
  ])("rejects malformed advertised metadata %j", (value) => {
    expect(() => readTransferSupport(certs(value), "simulator")).toThrow(ISecureTransferError);
  });
  it("does not activate gzip or S3 just because they are advertised", () => {
    expect(
      readTransferSupport(certs([{ ...advertised, Encodings: ["gzip"], Delivery: ["s3"] }]), "simulator").protocol,
    ).toBe("unavailable");
  });
  it("counts the exact UTF-8 JSON envelope including escaped metadata", () => {
    const support = readTransferSupport(certs([advertised]), "simulator");
    const request = { bytes: new Uint8Array([0, 255, 127]), ...metadata, FileName: 'é\\".xml' };
    const result = prepareInlineUpload(request, support);
    const size = new TextEncoder().encode(JSON.stringify(result)).length;
    expect(result.FileContents).toBe("AP9/");
    expect(prepareInlineUpload(request, { ...support, maxInlineRequestBytes: size })).toEqual(result);
    expect(() => prepareInlineUpload(request, { ...support, maxInlineRequestBytes: size - 1 })).toThrow(
      ISecureTransferError,
    );
    expect(prepareInlineUpload(request, { ...support, maxInlineRequestBytes: size + 1 })).toEqual(result);
  });
  it("bounds bytes and metadata before encoding and refuses unimplemented delivery", () => {
    const support = readTransferSupport(certs([advertised]), "simulator");
    expect(() => prepareInlineUpload({ bytes: new Uint8Array(1001), ...metadata }, support)).toThrow(
      ISecureTransferError,
    );
    expect(() => prepareInlineUpload({ bytes: new Uint8Array(0), ...metadata }, support)).toThrow(ISecureTransferError);
    expect(() =>
      prepareInlineUpload(
        { bytes: new Uint8Array(1), ...metadata, Signature: "a".repeat(2 * 1024 * 1024 + 1) },
        support,
      ),
    ).toThrow(ISecureTransferError);
    expect(() => prepareInlineUpload({ bytes: new Uint8Array(1), ...metadata }, { protocol: "unavailable" })).toThrow(
      ISecureTransferError,
    );
    expect(() =>
      prepareInlineUpload(
        { bytes: new Uint8Array(6 * 1024 * 1024), ...metadata },
        readTransferSupport(certs(), "simulator"),
      ),
    ).toThrow(ISecureTransferError);
  });
  it("round trips binary octets and base64 remainder boundaries locally", () => {
    const support = readTransferSupport(certs([advertised]), "simulator");
    for (let size = 1; size <= 300; size++) {
      const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 137) % 256);
      const body = prepareInlineUpload({ bytes, ...metadata }, support);
      expect(decodeInlineResult({ ResponseCode: "00", Content: body.FileContents }, support, true)).toEqual(bytes);
    }
  });
  it("preserves bank refusals and acknowledgement-only uploads", () => {
    const support = readTransferSupport(certs([advertised]), "simulator");
    expect(decodeInlineResult({ ResponseCode: "12", Content: "not a file" }, support, true)).toBeUndefined();
    expect(decodeInlineResult({ ResponseCode: "00" }, support, false)).toBeUndefined();
    expect(() => decodeInlineResult({ ResponseCode: "00" }, support, true)).toThrow(ISecureTransferError);
  });
  it.each(["?", "A===", "AB==", "Zm9v====", "Z m9v", "Zm9v\n", "Zm9", "data:Zm9v"])(
    "rejects invalid/noncanonical base64 %j",
    (Content) => {
      expect(() =>
        decodeInlineResult({ ResponseCode: "00", Content }, readTransferSupport(certs(), "simulator"), true),
      ).toThrow(ISecureTransferError);
    },
  );
  it("bounds decoded responses and never interprets a URL or compressed union as Content", () => {
    const support = readTransferSupport(certs([advertised]), "simulator");
    for (const response of [
      null,
      {},
      { ResponseCode: "00", Content: 1 },
      { ResponseCode: "00", FilePayload: { Kind: "s3" } },
      { ResponseCode: "00", Content: "AAAA", FilePayload: {} },
    ]) {
      expect(() => decodeInlineResult(response, support, true)).toThrow(ISecureTransferError);
    }
    expect(() =>
      decodeInlineResult({ ResponseCode: "00", Content: "AAAA" }, { ...support, maxRawDownloadBytes: 2 }, true),
    ).toThrow(ISecureTransferError);
  });
});
