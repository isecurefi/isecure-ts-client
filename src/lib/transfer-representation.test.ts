import { gzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { decodeTransferRepresentation, encodeTransferRepresentation } from "./transfer-representation.js";

it("uses identity when compression would grow and gzip when it reduces the file", async () => {
  const tiny = await encodeTransferRepresentation(new Uint8Array([0, 255, 127]), true);
  expect(tiny.encoding).toBe("identity");
  const original = new Uint8Array(4096).fill(42);
  const encoded = await encodeTransferRepresentation(original, true);
  expect(encoded.encoding).toBe("gzip");
  expect(encoded.bytes.length).toBeLessThan(original.length);
  expect(await decodeTransferRepresentation(encoded.bytes, encoded.encoding, encoded.integrity)).toEqual(original);
});
it("rejects concatenated gzip members even if the original length and hash would match", async () => {
  const original = new Uint8Array(2048).fill(42);
  const metadata = await encodeTransferRepresentation(original, false);
  const member = gzipSync(original.subarray(0, 1024));
  await expect(
    decodeTransferRepresentation(Buffer.concat([member, member]), "gzip", metadata.integrity),
  ).rejects.toThrow();
});

it("preserves binary/empty data and snapshots inputs before awaits", async () => {
  for (const length of [0, 1, 15, 16, 17, 256, 65536, 65537]) {
    const original = Uint8Array.from({ length }, (_, i) => i % 256);
    const expected = original.slice();
    const pending = encodeTransferRepresentation(original, true);
    original.fill(0);
    const representation = await pending;
    const decoding = decodeTransferRepresentation(
      representation.bytes,
      representation.encoding,
      representation.integrity,
    );
    representation.bytes.fill(0);
    expect(await decoding).toEqual(expected);
  }
});
it("rejects every truncated gzip, corrupt trailer and trailing data before returning plaintext", async () => {
  const original = new Uint8Array(4096).fill(42);
  const encoded = new Uint8Array(gzipSync(original));
  const metadata = (await encodeTransferRepresentation(original, false)).integrity;
  for (let end = 0; end < encoded.length; end++) {
    await expect(decodeTransferRepresentation(encoded.subarray(0, end), "gzip", metadata)).rejects.toThrow();
  }
  for (let i = encoded.length - 8; i < encoded.length; i++) {
    const changed = encoded.slice();
    changed[i] = (changed[i] ?? 0) ^ 1;
    await expect(decodeTransferRepresentation(changed, "gzip", metadata)).rejects.toThrow();
  }
  for (const extra of [new Uint8Array([0]), new Uint8Array([1]), gzipSync(new Uint8Array())]) {
    await expect(
      decodeTransferRepresentation(new Uint8Array([...encoded, ...extra]), "gzip", metadata),
    ).rejects.toThrow();
  }
});
it("refuses expansion beyond declared length, wrong hashes and inconsistent representation metadata", async () => {
  const encoded = await encodeTransferRepresentation(new Uint8Array(1024 * 1024).fill(42), true);
  for (const integrity of [
    { ...encoded.integrity, RawBytes: 2048 },
    { ...encoded.integrity, Sha256: "0".repeat(64) },
    { ...encoded.integrity, RawBytes: 1024 * 1024 + 1 },
  ]) {
    await expect(decodeTransferRepresentation(encoded.bytes, "gzip", integrity)).rejects.toThrow();
  }
  await expect(decodeTransferRepresentation(new Uint8Array(1), "identity", encoded.integrity)).rejects.toThrow();
  await expect(
    decodeTransferRepresentation(encoded.bytes, "identity", { ...encoded.integrity, RawBytes: encoded.bytes.length }),
  ).rejects.toThrow();
  await expect(
    decodeTransferRepresentation(encoded.bytes, "gzip", { ...encoded.integrity, RawBytes: encoded.bytes.length }),
  ).rejects.toThrow();
});
it("honors cancellation before work and during compression/decompression", async () => {
  const bytes = new Uint8Array(8 * 1024 * 1024).fill(42);
  const controller = new AbortController();
  controller.abort();
  await expect(encodeTransferRepresentation(bytes, true, { signal: controller.signal })).rejects.toThrow();
  const representation = await encodeTransferRepresentation(bytes, true);
  await expect(
    decodeTransferRepresentation(representation.bytes, "gzip", representation.integrity, { signal: controller.signal }),
  ).rejects.toThrow();
  const encodingAbort = new AbortController();
  const encoding = encodeTransferRepresentation(bytes, true, { signal: encodingAbort.signal });
  setTimeout(() => {
    encodingAbort.abort();
  }, 0);
  await expect(encoding).rejects.toThrow();
  const decodingAbort = new AbortController();
  const decoding = decodeTransferRepresentation(representation.bytes, "gzip", representation.integrity, {
    signal: decodingAbort.signal,
  });
  setTimeout(() => {
    decodingAbort.abort();
  }, 0);
  await expect(decoding).rejects.toThrow();
});
it("round-trips the 32 MiB original maximum independent of compressibility", async () => {
  for (const compressible of [true, false]) {
    const original = new Uint8Array(32 * 1024 * 1024);
    if (!compressible) {
      // Reproducible synthetic entropy fixture, never key material.
      let seed = 0x0badc0de;
      for (let i = 0; i < original.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        original[i] = seed & 255;
      }
    }
    const encoded = await encodeTransferRepresentation(original, true);
    expect(encoded.encoding).toBe(compressible ? "gzip" : "identity");
    const restored = await decodeTransferRepresentation(encoded.bytes, encoded.encoding, encoded.integrity);
    expect(Buffer.compare(original, restored)).toBe(0);
  }
  await expect(encodeTransferRepresentation(new Uint8Array(32 * 1024 * 1024 + 1), false)).rejects.toMatchObject({
    reason: "size",
  });
}, 20000);

it("validates optional gzip headers using native CRC checks", async () => {
  const { crc32 } = await import("node:zlib");
  const original = new Uint8Array(4096).fill(42);
  const encoded = new Uint8Array(gzipSync(original));
  const metadata = (await encodeTransferRepresentation(original, false)).integrity;
  const header = new Uint8Array([...encoded.subarray(0, 10), 3, 0, 1, 2, 3, 110, 0, 99, 0]);
  header[3] = 4 | 8 | 16 | 2;
  const crc = crc32(header) & 0xffff;
  const full = new Uint8Array([...header, crc & 255, crc >>> 8, ...encoded.subarray(10)]);
  expect(await decodeTransferRepresentation(full, "gzip", metadata)).toEqual(original);
  const bad = full.slice();
  bad[header.length] = (bad[header.length] ?? 0) ^ 1;
  await expect(decodeTransferRepresentation(bad, "gzip", metadata)).rejects.toThrow();
  for (const flags of [4, 8, 16, 2, 0xe0]) {
    const truncatedHeader = new Uint8Array(21);
    truncatedHeader.set(encoded.subarray(0, 10));
    truncatedHeader[3] = flags;
    truncatedHeader.fill(255, 10, 13);
    await expect(decodeTransferRepresentation(truncatedHeader, "gzip", metadata)).rejects.toThrow();
  }
});

it("refuses malformed integrity before starting a decode", async () => {
  for (const metadata of [
    null,
    [],
    {},
    { RawBytes: -1, Sha256: "a".repeat(64) },
    { RawBytes: 1.5, Sha256: "a".repeat(64) },
    { RawBytes: 33554433, Sha256: "a".repeat(64) },
    { RawBytes: 1, Sha256: "A".repeat(64) },
    { RawBytes: 1, Sha256: "a".repeat(64), Extra: true },
  ]) {
    await expect(
      decodeTransferRepresentation(
        new Uint8Array(1),
        "identity",
        metadata as unknown as Parameters<typeof decodeTransferRepresentation>[2],
      ),
    ).rejects.toThrow();
  }
  await expect(encodeTransferRepresentation(new Uint8Array(), "true" as unknown as boolean)).rejects.toThrow();
  await expect(
    decodeTransferRepresentation(new Uint8Array(), "br" as unknown as "identity", {
      RawBytes: 0,
      Sha256: "a".repeat(64),
    }),
  ).rejects.toThrow();
});

it("handles original sizes around the Lambda boundary without treating it as a file limit", async () => {
  for (const length of [6 * 1024 * 1024 - 1, 6 * 1024 * 1024, 6 * 1024 * 1024 + 1, 32 * 1024 * 1024 - 1]) {
    const original = new Uint8Array(length).fill(42);
    const encoded = await encodeTransferRepresentation(original, true);
    expect((await decodeTransferRepresentation(encoded.bytes, encoded.encoding, encoded.integrity)).length).toBe(
      length,
    );
  }
}, 20000);
