import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AeadContext, openEncoded, sealEncoded, parseArtifactKey, parseArtifactNonce } from "./transfer-aead.js";
interface BindingVector {
  id: string;
  keyBase64: string;
  nonceBase64: string;
  aadSha256: string;
}
interface PrimitiveVector {
  id: string;
  key: string;
  nonce: string;
  plaintext: string;
  aad: string;
  ciphertext: string;
  tag: string;
}
interface ArtifactVector {
  id: string;
  key: string;
  nonce: string;
  original: string;
  encoded: string;
  aad: string;
  object: string;
  context: Record<string, unknown>;
}
const source = readFileSync(new URL("../../test-vectors/s3-aead-v1/vectors.json", import.meta.url));
const document = JSON.parse(source.toString()) as {
  bindingVectors: BindingVector[];
  primitiveVectors: PrimitiveVector[];
  artifactVectors: ArtifactVector[];
};
const manifest = JSON.parse(
  readFileSync(new URL("../../test-vectors/s3-aead-v1/manifest.json", import.meta.url), "utf8"),
) as { fixtureSha256: string };
const bytes = (hex: string): Uint8Array<ArrayBuffer> => new Uint8Array(Buffer.from(hex, "hex"));
const hex = (value: Uint8Array): string => Buffer.from(value).toString("hex");
function fixture(index: number): ArtifactVector {
  const value = document.artifactVectors[index];
  if (!value) throw new Error("Missing synthetic fixture");
  return value;
}
describe("shared independently verified AEAD vectors", () => {
  it("pins the exact backend-owned fixture bytes", () => {
    expect(createHash("sha256").update(source).digest("hex")).toBe(manifest.fixtureSha256);
  });
  for (const vector of document.primitiveVectors) {
    it(vector.id, async () => {
      const key = await crypto.subtle.importKey("raw", bytes(vector.key), "AES-GCM", false, ["encrypt", "decrypt"]);
      const algorithm = { name: "AES-GCM", iv: bytes(vector.nonce), additionalData: bytes(vector.aad), tagLength: 128 };
      const encrypted = await crypto.subtle.encrypt(algorithm, key, bytes(vector.plaintext));
      expect(hex(new Uint8Array(encrypted))).toBe(vector.ciphertext + vector.tag);
      expect(hex(new Uint8Array(await crypto.subtle.decrypt(algorithm, key, encrypted)))).toBe(vector.plaintext);
    });
  }
  for (const vector of document.artifactVectors) {
    it(`application context and ciphertext: ${vector.id}`, async () => {
      const context = AeadContext.parse(vector.context);
      expect(hex(context.aad(bytes(vector.nonce)))).toBe(vector.aad);
      expect(hex(await sealEncoded(context, bytes(vector.nonce), bytes(vector.key), bytes(vector.encoded)))).toBe(
        vector.object,
      );
      expect(hex(await openEncoded(context, bytes(vector.nonce), bytes(vector.key), bytes(vector.object)))).toBe(
        vector.encoded,
      );
    });
    it(`rejects corruption and truncation without returning plaintext: ${vector.id}`, async () => {
      const context = AeadContext.parse(vector.context);
      const object = bytes(vector.object);
      for (let i = 0; i < object.length; i++) {
        const changed = object.slice();
        changed[i] = (changed[i] ?? 0) ^ 1;
        await expect(openEncoded(context, bytes(vector.nonce), bytes(vector.key), changed)).rejects.toThrow();
        await expect(
          openEncoded(context, bytes(vector.nonce), bytes(vector.key), object.subarray(0, i)),
        ).rejects.toThrow();
      }
      await expect(openEncoded(context, bytes(vector.nonce), new Uint8Array(32), object)).rejects.toThrow();
      await expect(
        openEncoded(context, bytes(vector.nonce), bytes(vector.key), new Uint8Array([...object, 0])),
      ).rejects.toThrow();
    });
  }
  it("rejects noncanonical, missing, unknown and out-of-bounds context fields", () => {
    const context = fixture(1).context;
    for (const [field, value] of [
      ["Environment", "TEST"],
      ["Purpose", "export"],
      ["Encoding", "gzip"],
      ["OriginalBytes", -1],
      ["OriginalBytes", 1.5],
      ["OriginalBytes", 33554433],
      ["EncodedBytes", 0],
      ["EncodedBytes", Number.MAX_SAFE_INTEGER],
      ["AccountScope", "０".repeat(64)],
      ["AccountScope", "a".repeat(63)],
      ["TransferId", "A".repeat(64)],
      ["ArtifactId", "a".repeat(64) + "\n"],
      ["OriginalSha256", null],
      ["Unexpected", true],
    ] as const)
      expect(() => AeadContext.parse({ ...context, [field]: value })).toThrow();
    for (const field of Object.keys(context)) {
      const missing = Object.fromEntries(Object.entries(context).filter(([key]) => key !== field));
      expect(() => AeadContext.parse(missing)).toThrow();
    }
  });
  it("does not depend on JSON property order", () => {
    const fields = fixture(0).context;
    expect(AeadContext.parse(Object.fromEntries(Object.entries(fields).reverse())).aad(new Uint8Array(12))).toEqual(
      AeadContext.parse(fields).aad(new Uint8Array(12)),
    );
  });
});

describe("AEAD admission and asynchronous ownership", () => {
  it("rejects changed context, wrong key/nonce sizes and representation lengths", async () => {
    const vector = fixture(5);
    for (const [field, changed] of [
      ["Environment", "test"],
      ["Purpose", "download"],
      ["Encoding", "gzip"],
      ["AccountScope", "00".repeat(32)],
      ["TransferId", "00".repeat(32)],
      ["ArtifactId", "00".repeat(32)],
      ["OriginalSha256", "00".repeat(32)],
      ["OriginalBytes", 257],
      ["EncodedBytes", 257],
    ] as const) {
      expect(changed).not.toEqual(vector.context[field]);
      await expect(
        (async () => {
          const context = AeadContext.parse({ ...vector.context, [field]: changed });
          return openEncoded(context, bytes(vector.nonce), bytes(vector.key), bytes(vector.object));
        })(),
      ).rejects.toThrow();
    }
    const context = AeadContext.parse(vector.context);
    for (const length of [0, 31, 33]) {
      await expect(
        sealEncoded(context, bytes(vector.nonce), new Uint8Array(length), bytes(vector.encoded)),
      ).rejects.toThrow();
    }
    for (const length of [0, 11, 13]) {
      await expect(
        sealEncoded(context, new Uint8Array(length), bytes(vector.key), bytes(vector.encoded)),
      ).rejects.toThrow();
    }
    await expect(sealEncoded(context, bytes(vector.nonce), bytes(vector.key), new Uint8Array(0))).rejects.toThrow();
    for (const invalid of [
      null,
      [],
      1,
      "context",
      {},
      { ...vector.context, OriginalBytes: NaN },
      { ...vector.context, OriginalBytes: Infinity },
    ]) {
      expect(() => AeadContext.parse(invalid)).toThrow();
    }
  });
  it("snapshots admitted bytes before awaiting Web Crypto", async () => {
    const vector = fixture(5);
    const fields = { ...vector.context };
    const context = AeadContext.parse(fields);
    fields.AccountScope = "00".repeat(32);
    const key = bytes(vector.key),
      nonce = bytes(vector.nonce),
      encoded = bytes(vector.encoded);
    const sealed = sealEncoded(context, nonce, key, encoded);
    key.fill(0);
    nonce.fill(0);
    encoded.fill(0);
    expect(hex(await sealed)).toBe(vector.object);
    const object = bytes(vector.object);
    const opened = openEncoded(context, bytes(vector.nonce), bytes(vector.key), object);
    object.fill(0);
    expect(hex(await opened)).toBe(vector.encoded);
  });
});

describe("canonical artifact key and context-binding vectors", () => {
  for (const binding of document.bindingVectors) {
    it(binding.id, async () => {
      const vector = document.artifactVectors.find((value) => value.id === binding.id);
      if (!vector) throw new Error("Missing shared fixture");
      const key = parseArtifactKey(binding.keyBase64);
      const nonce = parseArtifactNonce(binding.nonceBase64);
      expect(hex(key)).toBe(vector.key);
      expect(hex(nonce)).toBe(vector.nonce);
      const aad = AeadContext.parse(vector.context).aad(nonce);
      expect(hex(new Uint8Array(await crypto.subtle.digest("SHA-256", aad)))).toBe(binding.aadSha256);
    });
  }
  it("rejects noncanonical encodings instead of normalizing them", () => {
    const canonical = btoa(String.fromCharCode(...new Uint8Array(32)));
    for (const value of [
      undefined,
      null,
      1,
      [],
      "",
      canonical.slice(0, -1),
      canonical + "=",
      canonical + "\n",
      " " + canonical,
      canonical.replace("=", "_"),
      "A".repeat(42) + "B=",
      btoa("short"),
    ]) {
      expect(() => parseArtifactKey(value)).toThrow();
    }
    for (const value of ["", "AAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAA=", "AAAAAAAAAAAAAAAA\n", "________________"]) {
      expect(() => parseArtifactNonce(value)).toThrow();
    }
  });
});
