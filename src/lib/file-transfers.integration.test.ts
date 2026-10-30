import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { WSChannel } from "./isecure.class.js";
import { FakeTransport, type TransportRequest } from "./transport.js";
import { ISecureHttpError, ISecureNetworkError } from "./errors.js";
import { ISecureTransferError } from "./file-transfers.js";

const publicKey = readFileSync(new URL("../../examples/gpg-encryption-test/test.pem", import.meta.url), "utf8");
const caps = {
  ContractVersion: 1,
  Bank: "simulator",
  Protocols: ["inline-v1"],
  Encodings: ["identity"],
  Delivery: ["inline"],
  MaxRawUploadBytes: 1000,
  MaxRawDownloadBytes: 1000,
  MaxInlineRequestBytes: 2000,
};
const response = (data: unknown) => ({ status: 200, statusText: "OK", data });
const meta = { FileName: "synthetic.xml", FileType: "pain.001", Signature: "synthetic-signature" };
async function setup(base: string, capabilities?: unknown) {
  const transport = new FakeTransport();
  let certificateResult: unknown = {
    ResponseCode: "00",
    ResponseText: "OK",
    Certs: [],
    ...(capabilities === undefined ? {} : { FileTransferCapabilities: capabilities }),
  };
  let fileResult: unknown = { ResponseCode: "00", ResponseText: "OK", Content: "AP9/" };
  let failure: Error | undefined;
  let onDiscovery: (() => void) | undefined;
  let onFile: (() => void) | undefined;
  let detailResult: unknown;
  let detailFailure: Error | undefined;
  let onDetail: (() => void) | undefined;
  let controlResult: unknown;
  let controlFailure: Error | undefined;
  let onControl: (() => void) | undefined;
  transport.respond((request) => {
    if (request.url.includes("/session/"))
      return response(
        request.method === "GET"
          ? { Challenge: "challenge|1475429754114|synthetic" }
          : { ResponseCode: "00", ResponseText: "OK", IdToken: "synthetic-id", ApiKey: "synthetic-tenant" },
      );
    if (request.url.endsWith("/certs")) {
      onDiscovery?.();
      if (failure) throw failure;
      return response(certificateResult);
    }
    if (request.url.includes("/file-transfers/capabilities/")) {
      onDetail?.();
      if (detailFailure) throw detailFailure;
      return response(detailResult);
    }
    if (request.url.includes("/file-transfers")) {
      onControl?.();
      if (controlFailure) throw controlFailure;
      return response(controlResult);
    }
    if (request.url.includes("/files/")) {
      onFile?.();
      if (failure) throw failure;
      return response(fileResult);
    }
    return undefined;
  });
  const client = new WSChannel(
    {
      BaseUrl: base,
      PublicKey: publicKey,
      Email: "user@example.test",
      Phone: "+358401234567",
      Password: "Synthetic-password-123!",
      Company: "Synthetic",
      Name: "Synthetic",
      Mode: "data",
      Bank: "simulator",
    },
    { transport },
  );
  await client.login();
  transport.requests.length = 0;
  return {
    client,
    transport,
    setControl: (value: unknown) => {
      controlResult = value;
    },
    setControlFailure: (error: Error | undefined) => {
      controlFailure = error;
    },
    onControl: (callback: () => void) => {
      onControl = callback;
    },
    setDetail: (value: unknown) => {
      detailResult = value;
    },
    setDetailFailure: (error: Error) => {
      detailFailure = error;
    },
    onDetail: (callback: () => void) => {
      onDetail = callback;
    },
    setFailure: (value: Error) => {
      failure = value;
    },
    setCertificateResult: (value: unknown) => {
      certificateResult = value;
    },
    setFileResult: (value: unknown) => {
      fileResult = value;
    },
    onFile: (cb: () => void) => {
      onFile = cb;
    },
    onDiscovery: (cb: () => void) => {
      onDiscovery = cb;
    },
  };
}
const files = (requests: TransportRequest[]) => requests.filter((r) => r.url.includes("/files/"));

describe.each(["https://ws-api.isecure.fi/v2", "https://ws-api.test.isecure.fi/v2"])("same SDK at %s", (base) => {
  it("keeps old methods' request fields and envelopes unchanged with no discovery", async () => {
    const { client, transport } = await setup(base);
    const body = { FileContents: "AP9/", ...meta };
    expect(await client.uploadFile(body)).toEqual({ ResponseCode: "00", ResponseText: "OK", Content: "AP9/" });
    expect(await client.downloadFile("pain.001", "ref/1")).toEqual({
      ResponseCode: "00",
      ResponseText: "OK",
      Content: "AP9/",
    });
    expect(transport.requests).toHaveLength(2);
    expect(transport.requests[0]).toMatchObject({
      method: "PUT",
      url: `${base}/files/simulator`,
      body,
      headers: { Authorization: "synthetic-id", "x-api-key": "synthetic-tenant", "Content-Type": "application/json" },
      retry: false,
    });
    expect(transport.requests[1]).toMatchObject({
      method: "GET",
      url: `${base}/files/simulator/pain.001/ref%2F1`,
      retry: false,
    });
  });
  it.each([undefined, [caps]])(
    "new byte helpers use compatible inline requests after safe discovery (%j)",
    async (capabilities) => {
      const { client, transport } = await setup(base, capabilities);
      const bytes = new Uint8Array([0, 255, 127]);
      const uploaded = await client.uploadFileBytes({ bytes, ...meta });
      const downloaded = await client.downloadFileBytes("pain.001", "ref");
      expect(uploaded.bytes).toEqual(bytes);
      expect(downloaded.bytes).toEqual(bytes);
      expect(uploaded.protocol).toBe(capabilities ? "inline-v1" : "legacy-inline");
      expect(transport.requests.map((r) => r.method)).toEqual(["GET", "PUT", "GET", "GET"]);
      expect(files(transport.requests).every((r) => r.retry === false)).toBe(true);
      expect(files(transport.requests)[0]?.body).toEqual({ FileContents: "AP9/", ...meta });
    },
  );
  it("large legacy bytes fail before any bank call", async () => {
    const { client, transport } = await setup(base);
    await expect(client.uploadFileBytes({ bytes: new Uint8Array(6 * 1024 * 1024), ...meta })).rejects.toMatchObject({
      reason: "size",
    });
    expect(files(transport.requests)).toHaveLength(0);
  });
  it.each([401, 403, 404, 429, 500, 503])("discovery HTTP %s never means legacy", async (status) => {
    const { client, transport, setFailure } = await setup(base);
    const error = ISecureHttpError.fromResponse(status, "Failure", {
      ResponseCode: "01",
      ResponseText: "Missing authentication token",
    });
    setFailure(error);
    await expect(client.downloadFileBytes("pain.001", "ref")).rejects.toBe(error);
    expect(files(transport.requests)).toHaveLength(0);
  });
  it("timeouts and malformed/denied metadata stop before the bank", async () => {
    const state = await setup(base);
    state.setCertificateResult({ ResponseCode: "01", Certs: [] });
    await expect(state.client.downloadFileBytes("pain.001", "ref")).rejects.toBeInstanceOf(ISecureTransferError);
    state.setFailure(new ISecureNetworkError("synthetic", { timedOut: true }));
    await expect(state.client.uploadFileBytes({ bytes: new Uint8Array([1]), ...meta })).rejects.toBeInstanceOf(
      ISecureNetworkError,
    );
    expect(files(state.transport.requests)).toHaveLength(0);
  });
  it("never retries a bank operation to change encoding or delivery", async () => {
    const state = await setup(base, [caps]);
    state.setFileResult({ ResponseCode: "00", FilePayload: { Kind: "s3", Url: "https://invalid.example/synthetic" } });
    await expect(state.client.downloadFileBytes("pain.001", "ref")).rejects.toBeInstanceOf(ISecureTransferError);
    expect(files(state.transport.requests)).toHaveLength(1);
    state.transport.requests.length = 0;
    state.onDiscovery(() => {
      queueMicrotask(() => {
        state.setFailure(new ISecureNetworkError("synthetic", { timedOut: true }));
      });
    });
    await expect(state.client.uploadFileBytes({ bytes: new Uint8Array([1]), ...meta })).rejects.toBeInstanceOf(
      ISecureNetworkError,
    );
    expect(files(state.transport.requests)).toHaveLength(1);
  });
  it("refuses unavailable future protocols and does not fall back", async () => {
    const { client, transport } = await setup(base, [{ ...caps, Protocols: ["transfer-v1"], Delivery: ["s3"] }]);
    await expect(client.downloadFileBytes("pain.001", "ref")).rejects.toMatchObject({ reason: "unsupported" });
    expect(files(transport.requests)).toHaveLength(0);
  });
  it("guards destination/session changes during metadata lookup", async () => {
    const state = await setup(base, [caps]);
    state.onDiscovery(() => {
      state.client.updateProps({ BaseUrl: "https://other.example/v2" });
    });
    await expect(state.client.uploadFileBytes({ bytes: new Uint8Array([1]), ...meta })).rejects.toMatchObject({
      reason: "session-changed",
    });
    expect(files(state.transport.requests)).toHaveLength(0);
  });
  it("freezes upload bytes and metadata before discovery", async () => {
    const state = await setup(base, [caps]);
    const input = { bytes: new Uint8Array([0, 255, 127]), ...meta };
    state.onDiscovery(() => {
      input.bytes.fill(0);
      input.Signature = "changed";
      input.FileName = "changed";
    });
    await state.client.uploadFileBytes(input);
    expect(files(state.transport.requests)[0]?.body).toEqual({ FileContents: "AP9/", ...meta });
  });
  it("preserves acknowledgement-only success and all bank failure codes", async () => {
    const state = await setup(base);
    state.setFileResult({ ResponseCode: "00", ResponseText: "Accepted" });
    expect(await state.client.uploadFileBytes({ bytes: new Uint8Array([1]), ...meta })).not.toHaveProperty("bytes");
    state.setFileResult({ ResponseCode: "BANK-REJECT", ResponseText: "Rejected" });
    expect(await state.client.downloadFileBytes("pain.001", "ref")).toEqual({
      protocol: "legacy-inline",
      response: { ResponseCode: "BANK-REJECT", ResponseText: "Rejected" },
    });
  });
  it("does not release results to a changed session after bank dispatch", async () => {
    const state = await setup(base);
    state.onFile(() => {
      state.client.updateProps({ Mode: "admin" });
    });
    await expect(state.client.downloadFileBytes("pain.001", "ref")).rejects.toMatchObject({
      reason: "session-changed",
    });
    expect(files(state.transport.requests)).toHaveLength(1);
  });
  it("does not carry a capability decision across logout", async () => {
    const state = await setup(base);
    await state.client.getFileTransferSupport();
    await state.client.logout();
    state.transport.requests.length = 0;
    await expect(state.client.downloadFileBytes("pain.001", "ref")).rejects.toThrow("before login");
    expect(state.transport.requests).toHaveLength(0);
  });
  it("validates new helper inputs before any request", async () => {
    const state = await setup(base);
    await expect(state.client.downloadFileBytes("", "ref")).rejects.toMatchObject({ reason: "invalid-input" });
    await expect(state.client.uploadFileBytes(null as never)).rejects.toMatchObject({ reason: "invalid-input" });
    expect(state.transport.requests).toHaveLength(0);
  });
  it("forwards cancellation through metadata and the single bank operation", async () => {
    const state = await setup(base);
    const controller = new AbortController();
    await state.client.downloadFileBytes("pain.001", "ref", { signal: controller.signal });
    expect(state.transport.requests.every((r) => r.signal === controller.signal)).toBe(true);
  });
  it("reads capabilities afresh after environment changes", async () => {
    const state = await setup(base, [caps]);
    expect(await state.client.getFileTransferSupport()).toMatchObject({ protocol: "inline-v1" });
    state.setCertificateResult({ ResponseCode: "00", Certs: [] });
    state.client.updateProps({ BaseUrl: "https://other.example/v2" });
    expect(await state.client.getFileTransferSupport()).toMatchObject({ protocol: "legacy-inline" });
    expect(state.transport.requests.at(-1)?.url).toBe("https://other.example/v2/certs");
  });
});

function detailCapability() {
  return {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    ContractVersion: 2,
    Protocol: "transfer-v1",
    ArtifactFormat: "s3-aead-v1",
    Environment: "test",
    Bank: "simulator",
    AccountScope: "a".repeat(64),
    Encodings: ["identity", "gzip"],
    Delivery: ["inline", "s3"],
    S3Origin: "https://synthetic-transfers.s3.eu-west-1.amazonaws.com",
    MaxRawUploadBytes: 33554432,
    MaxRawDownloadBytes: 33554432,
    MaxInlineRequestBytes: 6225920,
    MaxControlBytes: 2097152,
    GrantMaxSeconds: 300,
    ExecuteWindowSeconds: 3600,
    DeliveryWindowSeconds: 86400,
    RetentionSeconds: 604800,
  };
}
describe("encrypted discovery is explicitly advertised and session-bound", () => {
  const advertised = [{ ...caps, Protocols: ["inline-v1", "transfer-v1"] }];
  it.each([undefined, [], [caps]])("does not probe encrypted routes without the existing marker", async (metadata) => {
    const { client, transport } = await setup("https://ws-api.isecure.fi/v2", metadata);
    expect(await client.getEncryptedFileTransferSupport("production")).toEqual({ protocol: "unavailable" });
    expect(transport.requests).toHaveLength(1);
    expect(transport.requests[0]?.url).toBe("https://ws-api.isecure.fi/v2/certs");
  });
  it("keeps version-1 support unchanged and only then reads explicit encrypted details", async () => {
    const fixture = await setup("https://ws-api.test.isecure.fi/v2", advertised);
    fixture.setDetail(detailCapability());
    expect((await fixture.client.getFileTransferSupport()).protocol).toBe("inline-v1");
    expect(fixture.transport.requests).toHaveLength(1);
    const signal = new AbortController().signal;
    const encrypted = await fixture.client.getEncryptedFileTransferSupport("test", { signal });
    expect(encrypted.protocol).toBe("s3-aead-v1");
    expect(fixture.transport.requests.at(-1)).toMatchObject({
      method: "GET",
      url: "https://ws-api.test.isecure.fi/v2/file-transfers/capabilities/simulator",
      retry: false,
      signal,
      headers: { Authorization: "synthetic-id", "x-api-key": "synthetic-tenant" },
    });
    expect(files(fixture.transport.requests)).toHaveLength(0);
  });
  it("never converts authentication, missing-route, outage or malformed detail failures into fallback", async () => {
    for (const failure of [
      new ISecureHttpError({ status: 401, statusText: "Missing Authentication Token" }),
      new ISecureHttpError({ status: 403, statusText: "Refused" }),
      new ISecureNetworkError("Unavailable"),
    ]) {
      const fixture = await setup("https://ws-api.test.isecure.fi/v2", advertised);
      fixture.setDetailFailure(failure);
      await expect(fixture.client.getEncryptedFileTransferSupport("test")).rejects.toBe(failure);
      expect(fixture.transport.requests).toHaveLength(2);
    }
    for (const bad of [
      null,
      {},
      { ...detailCapability(), ArtifactFormat: "plaintext" },
      { ...detailCapability(), ResponseCode: "01" },
    ]) {
      const fixture = await setup("https://ws-api.test.isecure.fi/v2", advertised);
      fixture.setDetail(bad);
      await expect(fixture.client.getEncryptedFileTransferSupport("test")).rejects.toBeInstanceOf(ISecureTransferError);
      expect(files(fixture.transport.requests)).toHaveLength(0);
    }
  });
  it("rejects an environment mismatch and session/base/bank changes during the detail call", async () => {
    for (const change of ["bank", "base", "session", "environment"]) {
      const fixture = await setup("https://ws-api.test.isecure.fi/v2", advertised);
      fixture.setDetail(detailCapability());
      fixture.onDetail(() => {
        if (change === "bank") fixture.client.props.Bank = "other";
        if (change === "base") fixture.client.props.BaseUrl = "https://other.invalid";
        if (change === "session") Object.assign(fixture.client.session, { idToken: "changed-session" });
      });
      await expect(
        fixture.client.getEncryptedFileTransferSupport(change === "environment" ? "production" : "test"),
      ).rejects.toBeInstanceOf(ISecureTransferError);
      expect(files(fixture.transport.requests)).toHaveLength(0);
    }
  });
});

describe("authenticated resumable controls", () => {
  const advertised = [{ ...caps, Protocols: ["inline-v1", "transfer-v1"] }];
  const intent = {
    Operation: "download" as const,
    Bank: "simulator",
    FileType: "pain.002",
    FileReference: "synthetic",
    AcceptGzip: false,
  };
  const status = {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    TransferId: "c".repeat(64),
    State: "prepared",
    ExecuteUntil: 4600,
    RetentionUntil: 605800,
  };
  const options = { environment: "test" as const, clientRequestId: "b".repeat(64) };
  async function fixture() {
    const f = await setup("https://ws-api.test.isecure.fi/v2", advertised);
    f.setDetail(detailCapability());
    f.setControl(status);
    return f;
  }
  it("opens without mutation, binds the authenticated scope and explicitly creates/statuses/retires", async () => {
    const f = await fixture();
    const transfer = await f.client.openFileTransfer(intent, options);
    expect(f.transport.requests.map((r) => r.method)).toEqual(["GET", "GET"]);
    expect(transfer.reference.accountScope).toBe(detailCapability().AccountScope);
    const signal = new AbortController().signal;
    await transfer.create({ signal });
    await transfer.status();
    await transfer.retire();
    const controls = f.transport.requests.slice(2);
    expect(controls.map((r) => [r.method, r.url, r.body])).toEqual([
      [
        "POST",
        "https://ws-api.test.isecure.fi/v2/file-transfers",
        { ClientRequestId: options.clientRequestId, Intent: intent },
      ],
      ["GET", `https://ws-api.test.isecure.fi/v2/file-transfers/${status.TransferId}`, undefined],
      ["DELETE", `https://ws-api.test.isecure.fi/v2/file-transfers/${status.TransferId}`, undefined],
    ]);
    expect(controls.every((r) => r.retry === false)).toBe(true);
    expect(controls[0]).toMatchObject({
      signal,
      headers: { Authorization: "synthetic-id", "x-api-key": "synthetic-tenant" },
    });
    expect(files(f.transport.requests)).toHaveLength(0);
  });
  it("does not replay a lost create acknowledgement and resumes with exactly the saved ID and intent", async () => {
    const f = await fixture();
    const transfer = await f.client.openFileTransfer(intent, options);
    const saved = transfer.reference;
    f.setControlFailure(new ISecureNetworkError("Synthetic timeout"));
    await expect(transfer.create()).rejects.toThrow("Synthetic timeout");
    expect(f.transport.requests.filter((r) => r.method === "POST")).toHaveLength(1);
    f.setControlFailure(undefined);
    const resumed = await f.client.resumeFileTransfer(saved);
    await resumed.create();
    const creates = f.transport.requests.filter((r) => r.method === "POST");
    expect(creates).toHaveLength(2);
    expect(creates[0]?.body).toEqual(creates[1]?.body);
    const confirmed = await f.client.resumeFileTransfer(resumed.reference);
    await confirmed.status();
    expect(f.transport.requests.at(-1)?.url).toMatch(new RegExp(status.TransferId + "$"));
  });
  it("rejects new and resumed controls when encryption has not been advertised", async () => {
    const f = await setup("https://ws-api.isecure.fi/v2");
    await expect(f.client.openFileTransfer(intent, { ...options, environment: "production" })).rejects.toMatchObject({
      reason: "unsupported",
    });
    const candidate = await fixture();
    const ref = (await candidate.client.openFileTransfer(intent, options)).reference;
    candidate.setCertificateResult({ ResponseCode: "00", Certs: [] });
    await expect(candidate.client.resumeFileTransfer(ref)).rejects.toMatchObject({ reason: "unsupported" });
    expect(f.transport.requests).toHaveLength(1);
    expect(f.transport.requests[0]?.url).toMatch(/\/certs$/u);
  });
  it.each(["base", "bank", "mode", "session"])(
    "rejects %s changes before controls without sending a mutation",
    async (change) => {
      const f = await fixture();
      const transfer = await f.client.openFileTransfer(intent, options);
      if (change === "base") f.client.props.BaseUrl = "https://other.test";
      if (change === "bank") f.client.props.Bank = "other";
      if (change === "mode") f.client.props.Mode = "admin";
      if (change === "session") Object.assign(f.client.session, { idToken: "other" });
      await expect(transfer.create()).rejects.toMatchObject({ reason: "session-changed" });
      expect(f.transport.requests).toHaveLength(2);
    },
  );
  it("rejects session changes during controls and resume across scopes, destinations or modes", async () => {
    const f = await fixture();
    const transfer = await f.client.openFileTransfer(intent, options);
    f.onControl(() => {
      Object.assign(f.client.session, { idToken: "other" });
    });
    await expect(transfer.create()).rejects.toMatchObject({ reason: "session-changed" });
    expect(transfer.reference.transferId).toBeUndefined();
    f.setDetail({ ...detailCapability(), AccountScope: "d".repeat(64) });
    await expect(f.client.resumeFileTransfer(transfer.reference)).rejects.toMatchObject({ reason: "session-changed" });
    for (const ref of [
      { ...transfer.reference, baseUrl: "https://other.test" },
      { ...transfer.reference, bank: "other", intent: { ...intent, Bank: "other" } },
    ]) {
      await expect(f.client.resumeFileTransfer(ref)).rejects.toMatchObject({ reason: "session-changed" });
    }
    f.client.props.Mode = "admin";
    await expect(f.client.openFileTransfer(intent, options)).rejects.toMatchObject({ reason: "invalid-input" });
    await expect(f.client.resumeFileTransfer(transfer.reference)).rejects.toMatchObject({ reason: "session-changed" });
  });
  it("applies negotiated encoding, storage, raw-byte and control-envelope limits", async () => {
    const f = await fixture();
    f.setDetail({ ...detailCapability(), Encodings: ["identity"] });
    await expect(f.client.openFileTransfer({ ...intent, AcceptGzip: true }, options)).rejects.toMatchObject({
      reason: "unsupported",
    });
    const upload = {
      Operation: "upload" as const,
      Bank: "simulator",
      FileType: "pain.001",
      Storage: "inline" as const,
      Integrity: { RawBytes: 2, Sha256: "a".repeat(64) },
      AcceptGzip: false,
    };
    f.setDetail({ ...detailCapability(), Delivery: ["s3"] });
    await expect(f.client.openFileTransfer(upload, options)).rejects.toMatchObject({ reason: "unsupported" });
    f.setDetail({ ...detailCapability(), MaxRawUploadBytes: 1 });
    await expect(f.client.openFileTransfer(upload, options)).rejects.toMatchObject({ reason: "size" });
    f.setDetail({ ...detailCapability(), MaxControlBytes: 1 });
    await expect(f.client.openFileTransfer(intent, options)).rejects.toMatchObject({ reason: "size" });
    expect(f.transport.requests.every((r) => r.method === "GET")).toBe(true);
  });
});

it("refuses destination changes while initial session freshness is awaited before discovery", async () => {
  const f = await setup("https://ws-api.test.isecure.fi/v2", [{ ...caps, Protocols: ["inline-v1", "transfer-v1"] }]);
  f.setDetail(detailCapability());
  const pending = f.client.openFileTransfer(
    { Operation: "download", Bank: "simulator", FileType: "pain.002", FileReference: "synthetic", AcceptGzip: false },
    { environment: "test" },
  );
  f.client.props.BaseUrl = "https://other.example/v2";
  await expect(pending).rejects.toMatchObject({ reason: "session-changed" });
  expect(f.transport.requests).toHaveLength(0);
});

it.each(["success", "lost acknowledgement", "existing object"])(
  "prepares and uploads ciphertext with safe reuse after %s",
  async (outcome) => {
    const { encodeTransferRepresentation } = await import("./transfer-representation.js");
    const bytes = new Uint8Array(4096).fill(42);
    const Integrity = (await encodeTransferRepresentation(bytes, false)).integrity;
    const f = await setup("https://ws-api.test.isecure.fi/v2", [{ ...caps, Protocols: ["inline-v1", "transfer-v1"] }]);
    f.setDetail(detailCapability());
    const status = {
      ResponseCode: "00",
      ResponseText: "Synthetic",
      TransferId: "c".repeat(64),
      State: "prepared",
      ExecuteUntil: Math.floor(Date.now() / 1000) + 3600,
      RetentionUntil: Math.floor(Date.now() / 1000) + 604800,
    };
    f.setControl(status);
    let transfer = await f.client.openFileTransfer(
      { Operation: "upload", Bank: "simulator", FileType: "pain.001", Storage: "s3", Integrity, AcceptGzip: true },
      { environment: "test" },
    );
    await transfer.create();
    f.onControl(() => {
      const body = f.transport.requests.at(-1)?.body as {
        Encoding: string;
        EncodedBytes: number;
        EncodedSha256: string;
      };
      f.setControl({
        ...status,
        Artifact: {
          Format: "s3-aead-v1",
          Context: {
            Environment: "test",
            AccountScope: "a".repeat(64),
            TransferId: status.TransferId,
            ArtifactId: "d".repeat(64),
            Purpose: "upload",
            Encoding: body.Encoding,
            EncodedBytes: body.EncodedBytes,
            OriginalBytes: bytes.length,
            OriginalSha256: Integrity.Sha256,
          },
          EncodedSha256: body.EncodedSha256,
          Key: btoa("k".repeat(32)),
          Nonce: btoa("n".repeat(12)),
        },
      });
    });
    f.setControlFailure(new ISecureNetworkError("Synthetic timeout"));
    await expect(transfer.prepareUpload(bytes)).rejects.toThrow("Synthetic timeout");
    f.setControlFailure(undefined);
    const preparationProgress = vi.fn();
    const prepared = await transfer.prepareUpload(bytes, { onProgress: preparationProgress });
    expect(preparationProgress.mock.calls).toEqual([
      [{ phase: "prepare-upload", state: "started" }],
      [{ phase: "prepare-upload", state: "completed" }],
    ]);
    expect(await transfer.prepareUpload(bytes)).toEqual(prepared);
    const requests = f.transport.requests.filter((r) => r.url.endsWith("/upload/prepare"));
    expect(requests).toHaveLength(2);
    expect(requests[0]?.body).toEqual(requests[1]?.body);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: `https://ws-api.test.isecure.fi/v2/file-transfers/${status.TransferId}/upload/prepare`,
      retry: false,
      headers: { Authorization: "synthetic-id", "x-api-key": "synthetic-tenant" },
    });
    expect(Object.keys(transfer.reference)).not.toContain("Key");
    if (outcome === "existing object") {
      const saved = transfer.saveUpload();
      expect(JSON.stringify(saved)).not.toContain("ciphertext");
      transfer.discardUpload();
      transfer = await f.client.resumeFileTransfer(saved.state.reference);
      await expect(transfer.restoreUpload(saved.state, saved.ciphertext)).resolves.toEqual(prepared);
      await expect(transfer.uploadPrepared()).rejects.toMatchObject({ reason: "storage-uncertain" });
      f.onControl(() => {
        f.setControl(status);
      });
      await transfer.status();
      saved.ciphertext.fill(0);
    }
    const changed = bytes.slice();
    changed[0] = 1;
    await expect(transfer.prepareUpload(changed)).rejects.toMatchObject({ reason: "invalid-input" });
    const checksum = btoa(
      String.fromCharCode(...Uint8Array.from(prepared.CiphertextSha256.match(/../gu) ?? [], (p) => parseInt(p, 16))),
    );
    const grant = {
      Url: `${detailCapability().S3Origin}/`,
      ExpiresAt: Math.floor(Date.now() / 1000) + 300,
      Fields: {
        key: `transfers/${status.TransferId}/${"d".repeat(64)}/upload`,
        "Content-Type": "application/octet-stream",
        success_action_status: "201",
        "x-amz-server-side-encryption": "AES256",
        "x-amz-checksum-algorithm": "SHA256",
        "x-amz-checksum-sha256": checksum,
        "x-amz-algorithm": "AWS4-HMAC-SHA256",
        "x-amz-credential": "ASIASYNTHETIC12345678/20261030/eu-west-1/s3/aws4_request",
        "x-amz-date": "20261030T000000Z",
        policy: btoa('{"synthetic":true}'),
        "x-amz-signature": "e".repeat(64),
      },
    };
    f.onControl(() => {
      f.setControl(
        outcome === "existing object"
          ? {
              ...status,
              Uploaded: {
                VersionId: "synthetic-version",
                CiphertextSha256: prepared.CiphertextSha256,
                ObjectBytes: prepared.ObjectBytes,
              },
            }
          : { ...status, Upload: grant },
      );
    });
    const storage = vi.fn<typeof fetch>(async (_url, options) => {
      expect(options?.headers).toBeUndefined();
      expect(options?.credentials).toBe("omit");
      if (outcome === "lost acknowledgement") throw new Error("synthetic lost storage acknowledgement");
      return new Response(null, {
        status: 201,
        headers: { "x-amz-version-id": "synthetic-version", "x-amz-checksum-sha256": checksum },
      });
    });
    vi.stubGlobal("fetch", storage);
    const storageProgress = vi.fn(() => {
      throw new Error("private observer failure");
    });
    try {
      if (outcome === "existing object") await transfer.reconcileUpload();
      if (outcome !== "lost acknowledgement") {
        const uploaded = await transfer.uploadPrepared({ onProgress: storageProgress });
        expect(uploaded.VersionId).toBe("synthetic-version");
        expect(await transfer.uploadPrepared()).toEqual(uploaded);
      } else {
        await expect(transfer.uploadPrepared({ onProgress: storageProgress })).rejects.toMatchObject({
          reason: "storage-uncertain",
        });
        await expect(transfer.uploadPrepared()).rejects.toMatchObject({ reason: "storage-uncertain" });
        f.setControlFailure(new ISecureNetworkError("Synthetic storage inspection unavailable"));
        await expect(transfer.reconcileUpload()).rejects.toThrow("Synthetic storage inspection unavailable");
        f.setControlFailure(undefined);
        await expect(transfer.uploadPrepared()).rejects.toMatchObject({ reason: "storage-uncertain" });
        // The mocked grant is a server-confirmed absence, not an inferred HTTP error.
        expect(await transfer.reconcileUpload()).toBeUndefined();
        expect(storage).toHaveBeenCalledTimes(1);
        f.onControl(() => {
          f.setControl({
            ...status,
            Uploaded: {
              VersionId: "synthetic-recovered",
              CiphertextSha256: prepared.CiphertextSha256,
              ObjectBytes: prepared.ObjectBytes,
            },
          });
        });
        const recovered = await transfer.reconcileUpload();
        expect(recovered?.VersionId).toBe("synthetic-recovered");
        expect(await transfer.uploadPrepared()).toEqual(recovered);
      }
      expect(storage).toHaveBeenCalledTimes(outcome === "existing object" ? 0 : 1);
      expect(storageProgress.mock.calls).toEqual(
        outcome === "existing object"
          ? [[{ phase: "store-upload", state: "completed" }]]
          : outcome === "lost acknowledgement"
            ? [[{ phase: "store-upload", state: "started" }]]
            : [[{ phase: "store-upload", state: "started" }], [{ phase: "store-upload", state: "completed" }]],
      );
      expect(f.transport.requests.at(-1)).toMatchObject({
        method: "POST",
        url: `https://ws-api.test.isecure.fi/v2/file-transfers/${status.TransferId}/upload/grant`,
        body: { CiphertextSha256: prepared.CiphertextSha256 },
        retry: false,
        headers: { Authorization: "synthetic-id", "x-api-key": "synthetic-tenant" },
      });
      if (outcome !== "existing object") expect(storage.mock.calls[0]?.[0]).toBe(grant.Url);
      f.onControl(() => {
        f.setControl({ ...status, State: "completed", DeliveryUntil: Math.floor(Date.now() / 1000) + 86400 });
      });
      await transfer.execute({ signature: "synthetic-detached-signature" });
      expect(f.transport.requests.at(-1)).toMatchObject({
        method: "POST",
        url: `https://ws-api.test.isecure.fi/v2/file-transfers/${status.TransferId}/execute`,
        retry: false,
        body: {
          Signature: "synthetic-detached-signature",
          Payload: {
            Kind: "s3",
            Version: outcome === "lost acknowledgement" ? "synthetic-recovered" : "synthetic-version",
          },
        },
      });
      expect((await transfer.receive()).bytes).toBeUndefined();
      await expect(transfer.execute()).rejects.toThrow();
      expect(JSON.stringify(transfer.reference)).not.toContain("synthetic-version");
    } finally {
      vi.unstubAllGlobals();
    }
    expect(files(f.transport.requests)).toHaveLength(0);
    transfer.discardUpload();
  },
);

it("executes explicitly once, receives verified content and renews delivery without another bank execution", async () => {
  const { sha256TransferBytes } = await import("./transfer-representation.js");
  const f = await setup("https://ws-api.test.isecure.fi/v2", [{ ...caps, Protocols: ["inline-v1", "transfer-v1"] }]);
  f.setDetail(detailCapability());
  const now = Math.floor(Date.now() / 1000);
  const prepared = {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    TransferId: "c".repeat(64),
    State: "prepared",
    ExecuteUntil: now + 3600,
    RetentionUntil: now + 604800,
  };
  f.setControl(prepared);
  const transfer = await f.client.openFileTransfer(
    { Operation: "download", Bank: "simulator", FileType: "pain.002", FileReference: "synthetic", AcceptGzip: true },
    { environment: "test" },
  );
  await expect(transfer.execute()).rejects.toMatchObject({ reason: "invalid-input" });
  await transfer.create();
  const bytes = Uint8Array.of(0, 255, 127);
  const completed = {
    ...prepared,
    State: "completed",
    DeliveryUntil: now + 86400,
    FilePayload: {
      Kind: "inline",
      Encoding: "identity",
      RawBytes: bytes.length,
      Sha256: await sha256TransferBytes(bytes),
      Data: "AP9/",
    },
  };
  f.setControl(completed);
  const status = await transfer.execute();
  expect(status.State).toBe("completed");
  expect(status).not.toHaveProperty("FilePayload");
  expect(f.transport.requests.at(-1)).toMatchObject({
    method: "POST",
    url: `https://ws-api.test.isecure.fi/v2/file-transfers/${prepared.TransferId}/execute`,
    body: {},
    retry: false,
  });
  const received = await transfer.receive();
  expect(received.bytes).toEqual(bytes);
  await expect(transfer.execute()).rejects.toThrow();
  await expect(transfer.receive()).rejects.toThrow();
  await transfer.refreshDelivery();
  expect(f.transport.requests.at(-1)).toMatchObject({
    method: "POST",
    url: `https://ws-api.test.isecure.fi/v2/file-transfers/${prepared.TransferId}/download-url`,
    body: {},
    retry: false,
  });
  const sink = vi.fn((data: Uint8Array) => {
    expect(data).toEqual(bytes);
  });
  await transfer.receiveTo(sink);
  expect(sink).toHaveBeenCalledTimes(1);
  await transfer.refreshDelivery();
  let observedTime = Date.now();
  const clock = vi.spyOn(Date, "now").mockImplementation(() => observedTime);
  try {
    await expect(
      transfer.receive({
        onProgress(event) {
          if (event.phase === "verify-download" && event.state === "completed") {
            queueMicrotask(() => {
              observedTime = completed.DeliveryUntil * 1000;
            });
          }
        },
      }),
    ).rejects.toMatchObject({ reason: "invalid-response" });
  } finally {
    clock.mockRestore();
  }
  expect(f.transport.requests.filter((r) => r.url.endsWith("/execute"))).toHaveLength(1);
  expect(files(f.transport.requests)).toHaveLength(0);
});

it("requires status reconciliation after lost execution and on resume; no control retries a bank request", async () => {
  const f = await setup("https://ws-api.test.isecure.fi/v2", [{ ...caps, Protocols: ["inline-v1", "transfer-v1"] }]);
  f.setDetail(detailCapability());
  const now = Math.floor(Date.now() / 1000);
  const prepared = {
    ResponseCode: "00",
    ResponseText: "Synthetic",
    TransferId: "c".repeat(64),
    State: "prepared",
    ExecuteUntil: now + 3600,
    RetentionUntil: now + 604800,
  };
  f.setControl(prepared);
  const transfer = await f.client.openFileTransfer(
    { Operation: "download", Bank: "simulator", FileType: "pain.002", FileReference: "synthetic", AcceptGzip: false },
    { environment: "test" },
  );
  await transfer.create();
  f.setControlFailure(new ISecureNetworkError("Synthetic lost execute acknowledgement"));
  await expect(transfer.execute()).rejects.toMatchObject({ reason: "execution-uncertain" });
  await expect(transfer.execute()).rejects.toMatchObject({ reason: "execution-uncertain" });
  f.setControlFailure(undefined);
  const resumed = await f.client.resumeFileTransfer(transfer.reference);
  await expect(resumed.execute()).rejects.toMatchObject({ reason: "invalid-input" });
  f.setControl({ ...prepared, State: "uncertain" });
  await resumed.status();
  await expect(resumed.execute()).rejects.toThrow();
  await transfer.status();
  await expect(transfer.execute()).rejects.toThrow();
  expect(f.transport.requests.filter((r) => r.url.endsWith("/execute"))).toHaveLength(1);
  expect(f.transport.requests.filter((r) => r.url.includes("/file-transfers/")).every((r) => r.retry === false)).toBe(
    true,
  );
});

it.each(["abort", "session", "malformed"])(
  "does not retain execution delivery after %s at the response boundary",
  async (failure) => {
    const f = await setup("https://ws-api.test.isecure.fi/v2", [{ ...caps, Protocols: ["inline-v1", "transfer-v1"] }]);
    f.setDetail(detailCapability());
    const now = Math.floor(Date.now() / 1000);
    const prepared = {
      ResponseCode: "00",
      ResponseText: "Synthetic",
      TransferId: "c".repeat(64),
      State: "prepared",
      ExecuteUntil: now + 3600,
      RetentionUntil: now + 604800,
    };
    f.setControl(prepared);
    const transfer = await f.client.openFileTransfer(
      { Operation: "download", Bank: "simulator", FileType: "pain.002", FileReference: "synthetic", AcceptGzip: false },
      { environment: "test" },
    );
    await transfer.create();
    const controller = new AbortController();
    f.onControl(() => {
      f.setControl({
        ...prepared,
        State: "completed",
        DeliveryUntil: now + 86400,
        ...(failure === "malformed" ? { Artifact: {} } : {}),
      });
      if (failure === "abort") controller.abort();
      if (failure === "session") Object.assign(f.client.session, { idToken: "changed" });
    });
    await expect(transfer.execute({}, { signal: controller.signal })).rejects.toMatchObject({
      reason: "execution-uncertain",
    });
    await expect(transfer.receive()).rejects.toThrow();
    await expect(transfer.execute()).rejects.toThrow();
    expect(f.transport.requests.filter((r) => r.url.endsWith("/execute"))).toHaveLength(1);
    transfer.discardDelivery();
  },
);
