import { expect, it, vi } from "vitest";
import { transferProgressObserver } from "./transfer-progress.js";
import type { FileTransferOptions, FileTransferProgress } from "./file-transfers.js";

it("freezes value-only progress and never exposes the mutable internal event", () => {
  const observe = vi.fn();
  const event: FileTransferProgress = { phase: "prepare-upload", state: "started" };
  transferProgressObserver(observe)(event);
  expect(observe).toHaveBeenCalledWith(event);
  expect(observe.mock.calls[0]?.[0]).not.toBe(event);
  expect(Object.isFrozen(observe.mock.calls[0]?.[0])).toBe(true);
});

it("validates observers and isolates synchronous and asynchronous failures", async () => {
  const event: FileTransferProgress = { phase: "store-upload", state: "completed" };
  expect(() => {
    transferProgressObserver(undefined)(event);
  }).not.toThrow();
  for (const invalid of [null, false, "callback", {}, 1]) {
    expect(() => transferProgressObserver(invalid as FileTransferOptions["onProgress"])).toThrow();
  }
  for (const observe of [
    () => {
      throw new Error("private observer exception");
    },
    async () => {
      throw new Error("private rejected observer");
    },
    () => undefined,
  ]) {
    expect(() => {
      transferProgressObserver(observe)(event);
    }).not.toThrow();
  }
  await Promise.resolve();
});
