import { expect, it } from "vitest";
import { TransferSession, createTransferRequestId } from "./transfer-session.js";
it("keeps a stable logical ID and can reconcile a lost create acknowledgement", async () => {
  expect(createTransferRequestId()).toMatch(/^[a-f0-9]{64}$/);
  const seen: unknown[] = [];
  let fail = true;
  const call = async (operation: string, id: string | undefined, body: unknown) => {
    seen.push({ operation, id, body });
    if (fail) {
      fail = false;
      throw new Error("lost acknowledgement");
    }
    return {
      ResponseCode: "00",
      ResponseText: "Synthetic",
      TransferId: "c".repeat(64),
      State: "prepared",
      ExecuteUntil: 4600,
      RetentionUntil: 605800,
    };
  };
  const session = new TransferSession(
    {
      version: 1,
      environment: "test",
      baseUrl: "https://ws-api.test.isecure.fi/v2",
      bank: "simulator",
      accountScope: "a".repeat(64),
      clientRequestId: "b".repeat(64),
      intent: {
        Operation: "download",
        Bank: "simulator",
        FileType: "pain.002",
        FileReference: "synthetic",
        AcceptGzip: false,
      },
    },
    call,
    () => undefined,
  );
  await expect(session.create()).rejects.toThrow("lost acknowledgement");
  expect(session.reference.clientRequestId).toBe("b".repeat(64));
  expect(seen).toHaveLength(1);
  const result = await session.create();
  expect(result.State).toBe("prepared");
  expect(seen[0]).toEqual(seen[1]);
  expect(session.reference.transferId).toBe("c".repeat(64));
});

const reference = {
  version: 1 as const,
  environment: "test" as const,
  baseUrl: "https://synthetic.example/v2",
  bank: "simulator",
  accountScope: "a".repeat(64),
  clientRequestId: "b".repeat(64),
  intent: {
    Operation: "download" as const,
    Bank: "simulator",
    FileType: "pain.002",
    FileReference: "synthetic",
    AcceptGzip: false,
  },
};
const status = {
  ResponseCode: "00",
  ResponseText: "Synthetic",
  TransferId: "c".repeat(64),
  State: "prepared",
  ExecuteUntil: 4600,
  RetentionUntil: 605800,
};
it("requires a confirmed transfer ID for status/retirement and never uses a bank endpoint", async () => {
  const calls: unknown[] = [];
  const session = new TransferSession(
    reference,
    async (...args) => {
      calls.push(args);
      return status;
    },
    () => undefined,
  );
  await expect(session.status()).rejects.toMatchObject({ reason: "invalid-input" });
  await expect(session.retire()).rejects.toMatchObject({ reason: "invalid-input" });
  expect(calls).toHaveLength(0);
  await session.create();
  await session.status();
  await session.retire();
  expect(calls).toEqual([
    ["create", undefined, { ClientRequestId: reference.clientRequestId, Intent: reference.intent }, {}],
    ["status", status.TransferId, undefined, {}],
    ["retire", status.TransferId, undefined, {}],
  ]);
  expect(Object.keys(session.reference).sort()).toEqual([...Object.keys(reference), "transferId"].sort());
});
it("blocks overlapping controls and releases the guard after an uncertain response", async () => {
  let release!: (value: unknown) => void;
  const session = new TransferSession(
    reference,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    () => undefined,
  );
  const first = session.create();
  await expect(session.create()).rejects.toMatchObject({ reason: "in-progress" });
  release({});
  await expect(first).rejects.toMatchObject({ reason: "invalid-response" });
  const next = session.create();
  release(status);
  await expect(next).resolves.toEqual(status);
});
it("checks session authority before and after await and does not adopt a stale response", async () => {
  let current = true;
  let calls = 0;
  const session = new TransferSession(
    reference,
    async () => {
      calls++;
      current = false;
      return status;
    },
    () => {
      if (!current) throw new Error("session changed");
    },
  );
  await expect(session.create()).rejects.toThrow("session changed");
  expect(session.reference.transferId).toBeUndefined();
  await expect(session.create()).rejects.toThrow("session changed");
  expect(calls).toBe(1);
});
it("cancels before dispatch and after response without retry or learning a stale result", async () => {
  const controller = new AbortController();
  let calls = 0;
  const session = new TransferSession(
    reference,
    async () => {
      calls++;
      controller.abort();
      return status;
    },
    () => undefined,
  );
  await expect(session.create({ signal: controller.signal })).rejects.toThrow();
  expect(session.reference.transferId).toBeUndefined();
  await expect(session.create({ signal: controller.signal })).rejects.toThrow();
  expect(calls).toBe(1);
});
