import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
