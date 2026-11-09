import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ISecureError } from "./errors.js";
import type { SftpKeyDescriptor } from "./api-types.js";
import { ABSENT_HOLVI_VERSION, type HolviConnection } from "./holvi.js";
import { WSChannel } from "./isecure.class.js";
import { FakeTransport, type TransportResponse } from "./transport.js";

const key = readFileSync(new URL("../../examples/gpg-encryption-test/test.pem", import.meta.url), "utf8");
const version = "0123456789abcdef0123456789abcdef";
const connection = {
  Enrolled: true,
  SftpUser: "ab12345.01",
  PublicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIsynthetic",
  Fingerprint: "SHA256:synthetic",
  KeyType: "sftp-public-key",
  Created: "2026-11-04T21:00:00Z",
  SourceAddresses: ["198.51.100.7"],
  Version: version,
  ResponseCode: "00",
  ResponseText: "OK",
} satisfies HolviConnection;
// listCerts().SftpKeys lists the same key beside the X.509 certificates.
const listed = {
  Bank: "holvi",
  Type: "sftp-public-key",
  Access: "direct",
  SftpUser: connection.SftpUser,
  PublicKey: connection.PublicKey,
  Fingerprint: connection.Fingerprint,
  Created: connection.Created,
} satisfies SftpKeyDescriptor;

function response<T>(data: T): TransportResponse<T> {
  return { status: 200, statusText: "OK", data };
}

async function client(data: unknown, mode = "admin") {
  const transport = new FakeTransport();
  transport.respond((request) => {
    if (request.url.includes("/session/"))
      return response(
        request.method === "GET"
          ? { Challenge: "challenge|1475429754114|4017bda8-0a15-4154-a8b7-88069b05cb4e" }
          : { IdToken: "synthetic-token", ApiKey: "synthetic-tenant", ResponseCode: "00", ResponseText: "OK" },
      );
    return response(data);
  });
  const sdk = new WSChannel(
    {
      Bank: "holvi",
      EncryptionProfile: "legacy",
      BaseUrl: "https://ws-api.test.isecure.fi/v2",
      Email: "synthetic@example.invalid",
      Mode: mode,
      Company: "Synthetic",
      Name: "Synthetic",
      Phone: "+358400000000",
      Password: "synthetic-password",
      PublicKey: key,
    },
    { transport },
  );
  await sdk.login();
  transport.requests.length = 0;
  return { sdk, transport };
}

describe("Holvi SFTP connection", () => {
  it("lists the Holvi SFTP public key beside the certificates", async () => {
    const { sdk } = await client({ ResponseCode: "00", ResponseText: "OK", Certs: [], SftpKeys: [listed] }, "data");
    const { SftpKeys = [] } = await sdk.listCerts();
    expect(SftpKeys).toEqual([listed]);
  });

  it("reads and checks the connection on the Holvi resources without changing the bank", async () => {
    const { sdk, transport } = await client(connection);
    sdk.updateProps({ Bank: "nordea" });
    const read = await sdk.getHolviConnection();
    expect(read).toEqual(connection);
    expect(read.SourceAddresses).toEqual(["198.51.100.7"]);
    await sdk.checkHolviConnection();
    expect(transport.requests.map((request) => [request.method, request.url])).toEqual([
      ["GET", "https://ws-api.test.isecure.fi/v2/providers/holvi/connection"],
      ["GET", "https://ws-api.test.isecure.fi/v2/providers/holvi/check"],
    ]);
    expect(sdk.props.Bank).toBe("nordea");
  });

  it("enrolls with the login only, the exact version and no automatic replay", async () => {
    const { sdk, transport } = await client(connection);
    expect(await sdk.enrollHolviConnection("ab12345.01", ABSENT_HOLVI_VERSION)).toEqual(connection);
    expect(transport.requests[0]).toMatchObject({
      method: "PUT",
      body: { SftpUser: "ab12345.01" },
      headers: { "If-Match": '"absent"' },
      retry: false,
    });
    await sdk.disableHolviConnection(version);
    expect(transport.requests[1]).toMatchObject({
      method: "DELETE",
      headers: { "If-Match": `"${version}"` },
      retry: false,
    });
    expect(transport.requests[1]).not.toHaveProperty("body");
  });

  it("starts REST consent with Channel api, the exact version and no automatic replay", async () => {
    const started = {
      Enrolled: true,
      Channel: "api",
      Status: "pending",
      AuthorizationUrl: "https://app.holvi.com/home/oauth/company/authorize/?response_type=code&state=synthetic",
      Created: "2026-11-05T12:00:00Z",
      SourceAddresses: [],
      Version: version,
      ResponseCode: "00",
      ResponseText: "OK",
    } satisfies HolviConnection;
    const { sdk, transport } = await client(started);
    const reply = await sdk.startHolviAuthorization(ABSENT_HOLVI_VERSION);
    expect(reply.AuthorizationUrl).toBe(started.AuthorizationUrl);
    expect(transport.requests[0]).toMatchObject({
      method: "PUT",
      url: "https://ws-api.test.isecure.fi/v2/providers/holvi/connection",
      body: { Channel: "api" },
      headers: { "If-Match": '"absent"' },
      retry: false,
    });
  });

  it("refuses a consent reply without an HTTPS authorization URL", async () => {
    for (const AuthorizationUrl of [undefined, "http://app.holvi.com/x", "javascript:alert(1)"]) {
      const { sdk } = await client({
        Enrolled: true,
        Channel: "api",
        Status: "pending",
        AuthorizationUrl,
        Version: version,
        ResponseCode: "00",
      });
      await expect(sdk.startHolviAuthorization(ABSENT_HOLVI_VERSION)).rejects.toBeInstanceOf(ISecureError);
    }
    const { sdk } = await client({ ResponseCode: "01", ResponseText: "Refused" });
    expect((await sdk.startHolviAuthorization(ABSENT_HOLVI_VERSION)).ResponseCode).toBe("01");
  });

  it("refuses malformed logins and versions before any request", async () => {
    const { sdk, transport } = await client(connection);
    for (const user of ["", ".x", "a b", "a/b", "x".repeat(65)])
      await expect(sdk.enrollHolviConnection(user, ABSENT_HOLVI_VERSION)).rejects.toBeInstanceOf(ISecureError);
    for (const expected of ["", "ABSENT", "0123", `"${version}"`])
      await expect(sdk.disableHolviConnection(expected)).rejects.toBeInstanceOf(ISecureError);
    expect(transport.requests).toHaveLength(0);
  });

  it("uses the existing file methods with bank holvi", async () => {
    const files = {
      FileDescriptors: [
        {
          FileReference: "FI2112345600000785_2026_1_camt.053.001.02.xml",
          FileType: "camt.053.001.02",
          Status: "NEW",
        },
      ],
      ResponseCode: "00",
      ResponseText: "OK.",
    };
    const { sdk, transport } = await client(files, "data");
    expect(await sdk.listFiles({ Status: "NEW" })).toEqual(files);
    await sdk.downloadFile("camt.053.001.02", "FI2112345600000785_2026_1_camt.053.001.02.xml");
    expect(transport.requests.map((request) => request.url)).toEqual([
      "https://ws-api.test.isecure.fi/v2/files/holvi",
      "https://ws-api.test.isecure.fi/v2/files/holvi/camt.053.001.02/FI2112345600000785_2026_1_camt.053.001.02.xml",
    ]);
  });
});
