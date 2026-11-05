import { expect, it, vi } from "vitest";
import { readDownloadGrant, downloadCiphertext } from "./transfer-s3-download.js";
import { sha256TransferBytes } from "./transfer-representation.js";
import type { FileTransferProgress } from "./file-transfers.js";
const origin = "https://synthetic.s3.eu-west-1.amazonaws.com";
const id = "c".repeat(64);
const bytes = new Uint8Array(40).fill(7);
const hash = await sha256TransferBytes(bytes);
const checksum = btoa(String.fromCharCode(...Uint8Array.from(hash.match(/../gu) ?? [], (p) => parseInt(p, 16))));
function fixture() {
  const url = new URL(`${origin}/transfers/${id}/${"d".repeat(64)}/download`);
  for (const [key, value] of Object.entries({
    versionId: "opaque/+version",
    "response-content-type": "application/octet-stream",
    "response-cache-control": "no-store",
    "response-content-disposition": 'attachment; filename="download.bin"',
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "SYNTHETIC/20261030/eu-west-1/s3/aws4_request",
    "X-Amz-Date": "20261030T000000Z",
    "X-Amz-Expires": "300",
    "X-Amz-SignedHeaders": "host",
    "X-Amz-Signature": "e".repeat(64),
  }))
    url.searchParams.set(key, value);
  return { Url: url.href, ExpiresAt: 1300 };
}
function read(value: unknown = fixture(), objectBytes = 40, digest = hash) {
  return readDownloadGrant(value, {
    origin,
    transferId: id,
    now: 1000,
    deliveryUntil: 87400,
    grantMaxSeconds: 300,
    objectBytes,
    checksum: digest,
  });
}
it("reports only bounded ciphertext byte counts and isolates observer failures", async () => {
  const onProgress = vi.fn(() => {
    throw new Error("private observer failure");
  });
  const send = vi.fn<typeof fetch>(
    async () =>
      new Response(bytes, {
        headers: { "x-amz-version-id": "opaque/+version" },
      }),
  );
  await expect(downloadCiphertext(read(), { send, now: () => 1000, onProgress })).resolves.toEqual(bytes);
  expect(onProgress.mock.calls).toEqual([
    [{ phase: "read-ciphertext", receivedBytes: 0, totalBytes: 40 }],
    [{ phase: "read-ciphertext", receivedBytes: 40, totalBytes: 40 }],
  ]);
  expect(send).toHaveBeenCalledTimes(1);
});
it("bounds progress calls for tiny chunks and freezes each metadata-only event", async () => {
  const payload = new Uint8Array(1024 * 1024).fill(7);
  const digest = await sha256TransferBytes(payload);
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === payload.length) controller.close();
      else {
        controller.enqueue(payload.subarray(offset, offset + 256));
        offset += 256;
      }
    },
  });
  const events: FileTransferProgress[] = [];
  const received = await downloadCiphertext(read(fixture(), payload.length, digest), {
    now: () => 1000,
    send: async () => new Response(stream, { headers: { "x-amz-version-id": "opaque/+version" } }),
    onProgress: (event) => {
      events.push(event);
      expect(Object.isFrozen(event)).toBe(true);
    },
  });
  // Exact bytes without a per-element deep equality walk over 1 MiB (slow on CI runners).
  expect(Buffer.compare(Buffer.from(received), Buffer.from(payload))).toBe(0);
  expect(events).toEqual(
    [0, 1, 2, 3, 4].map((part) => ({
      phase: "read-ciphertext",
      receivedBytes: part * 256 * 1024,
      totalBytes: payload.length,
    })),
  );
});
it("honors cancellation and changed session from a start observer before any storage request", async () => {
  for (const mode of ["abort", "session"] as const) {
    const controller = new AbortController();
    let current = true;
    const send = vi.fn<typeof fetch>();
    await expect(
      downloadCiphertext(read(), {
        send,
        now: () => 1000,
        signal: controller.signal,
        beforeSend: () => {
          if (!current) throw new Error("session changed");
        },
        onProgress: () => {
          if (mode === "abort") controller.abort();
          else current = false;
        },
      }),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  }
});
it("binds an exact storage origin, path, immutable version and expiry without normalizing URLs", () => {
  const grant = read();
  expect(grant.version).toBe("opaque/+version");
  expect(JSON.stringify(grant)).not.toContain("X-Amz");
  for (const change of [
    { Url: `${fixture().Url}#fragment` },
    { Url: ` ${fixture().Url}` },
    { ExpiresAt: 1000 },
    { ExpiresAt: 1301 },
    { Unknown: true },
  ])
    expect(() => read({ ...fixture(), ...change })).toThrow();
  for (const mutate of [
    (url: URL) => {
      url.hostname = "elsewhere.invalid";
    },
    (url: URL) => {
      url.pathname = `/transfers/${"a".repeat(64)}/${"d".repeat(64)}/download`;
    },
    (url: URL) => {
      url.searchParams.append("versionId", "duplicate");
    },
    (url: URL) => {
      url.searchParams.set("versionId", "null");
    },
    (url: URL) => {
      url.searchParams.set("X-Amz-SignedHeaders", "authorization");
    },
    (url: URL) => {
      url.searchParams.set("response-cache-control", "public");
    },
    (url: URL) => {
      url.searchParams.set("unknown", "value");
    },
  ]) {
    const value = fixture();
    const url = new URL(value.Url);
    mutate(url);
    expect(() => read({ ...value, Url: url.href })).toThrow();
  }
});
it("reads bounded ciphertext with no API credentials and verifies version, length and actual digest", async () => {
  const send = vi.fn<typeof fetch>(async (_url, options) => {
    expect(options).toMatchObject({
      method: "GET",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    expect(options?.headers).toBeUndefined();
    return new Response(bytes, {
      headers: { "content-length": "40", "x-amz-version-id": "opaque/+version", "x-amz-checksum-sha256": checksum },
    });
  });
  expect(await downloadCiphertext(read(), { send, now: () => 1000 })).toEqual(bytes);
  expect(send).toHaveBeenCalledTimes(1);
});
it("rejects incomplete, oversized, substituted or wrong-version bodies without returning partial output", async () => {
  for (const [body, headers] of [
    [bytes.slice(0, 39), {}],
    [new Uint8Array(41), {}],
    [new Uint8Array(40), {}],
    [bytes, { "x-amz-version-id": "wrong" }],
    [bytes, { "x-amz-checksum-sha256": "wrong" }],
    [bytes, { "content-length": "999999999999999999999" }],
  ] as const) {
    const send = vi.fn<typeof fetch>(
      async () =>
        new Response(body, {
          headers: { "x-amz-version-id": "opaque/+version", "x-amz-checksum-sha256": checksum, ...headers },
        }),
    );
    await expect(downloadCiphertext(read(), { send, now: () => 1000 })).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  }
});
it("checks cancellation, session and grant expiry before dispatch and cancels unfinished bodies", async () => {
  const send = vi.fn<typeof fetch>();
  const controller = new AbortController();
  controller.abort();
  await expect(downloadCiphertext(read(), { send, now: () => 1000, signal: controller.signal })).rejects.toThrow();
  await expect(downloadCiphertext(read(), { send, now: () => 1300 })).rejects.toThrow();
  await expect(
    downloadCiphertext(read(), {
      send,
      now: () => 1000,
      beforeSend: () => {
        throw new Error("session changed");
      },
    }),
  ).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(41));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(
    downloadCiphertext(read(), {
      now: () => 1000,
      send: async () =>
        new Response(stream, { headers: { "x-amz-version-id": "opaque/+version", "x-amz-checksum-sha256": checksum } }),
    }),
  ).rejects.toThrow();
  expect(cancelled).toBe(true);
});
it("verifies the actual digest when ordinary S3 GET omits the optional checksum header", async () => {
  await expect(
    downloadCiphertext(read(), {
      now: () => 1000,
      send: async () => new Response(bytes, { headers: { "x-amz-version-id": "opaque/+version" } }),
    }),
  ).resolves.toEqual(bytes);
  await expect(
    downloadCiphertext(read(), {
      now: () => 1000,
      send: async () => new Response(new Uint8Array(40), { headers: { "x-amz-version-id": "opaque/+version" } }),
    }),
  ).rejects.toThrow();
});
it("cancels a stalled reader at its bounded deadline and releases listeners and timers", async () => {
  vi.useFakeTimers();
  try {
    let cancelled = false;
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const pending = downloadCiphertext(read(), {
      now: () => 1000,
      signal: controller.signal,
      send: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "x-amz-version-id": "opaque/+version" } },
        ),
    });
    const rejected = expect(pending).rejects.toMatchObject({ reason: "invalid-response" });
    await vi.advanceTimersByTimeAsync(120000);
    await rejected;
    expect(cancelled).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
it("keeps fetch failures secret-safe and never follows redirects or accepts encoded error bodies", async () => {
  for (const response of [
    new Response(bytes, { status: 403 }),
    new Response(bytes, { headers: { "content-encoding": "gzip", "x-amz-version-id": "opaque/+version" } }),
  ]) {
    await expect(downloadCiphertext(read(), { now: () => 1000, send: async () => response })).rejects.toMatchObject({
      reason: "invalid-response",
    });
  }
  await expect(
    downloadCiphertext(read(), {
      now: () => 1000,
      send: async () => {
        throw new Error(fixture().Url);
      },
    }),
  ).rejects.toMatchObject({ message: "Invalid file transfer metadata or response" });
});
it("does not wait for stalled remote cleanup after an oversized response", async () => {
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(41));
      },
      cancel() {
        return new Promise<void>(() => undefined);
      },
    }),
    { headers: { "x-amz-version-id": "opaque/+version" } },
  );
  await expect(downloadCiphertext(read(), { now: () => 1000, send: async () => response })).rejects.toThrow();
});
