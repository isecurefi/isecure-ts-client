import { readFileSync } from "node:fs";
import { createHash, privateDecrypt, constants } from "node:crypto";
import { describe, it, expect } from "vitest";
import { encryptProfilePassword, requirePasswordDiscovery } from "./challenge-crypto.js";
interface ProfileVectors {
  Keys: { KeyId: string; PublicKey: string; PrivateKey: string }[];
  Cases: {
    Name: string;
    KeyId: string;
    Challenge: string;
    EncryptionProfile: typeof PASSWORD_ENCRYPTION_PROFILE;
    Password: string;
    FrameHex: string;
  }[];
}
const vectors = JSON.parse(
  readFileSync(new URL("../../test-vectors/password-profile/vectors.json", import.meta.url), "utf8"),
) as ProfileVectors;
describe("explicit password profile interoperability", () => {
  for (const v of vectors.Cases)
    it(v.Name, async () => {
      const key = vectors.Keys.find((k: { KeyId: string }) => k.KeyId === v.KeyId);
      if (!key) throw new Error("Missing vector key");
      const discovery = requirePasswordDiscovery({ ...v, PublicKey: key.PublicKey });
      const encrypted = await encryptProfilePassword(discovery, v.Password);
      const plain = privateDecrypt(
        {
          key: key.PrivateKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
          oaepLabel: Buffer.alloc(0),
        },
        Buffer.from(encrypted, "base64"),
      );
      expect(plain.toString("hex")).toBe(v.FrameHex);
      expect(plain.subarray(1, 33).equals(createHash("sha256").update(v.Challenge).digest())).toBe(true);
    });
  it("rejects missing profile discovery, unsupported keys and invalid UTF-8 lengths", async () => {
    const v = vectors.Cases[0],
      key = vectors.Keys[0];
    expect(() => requirePasswordDiscovery({ Challenge: "legacy" })).toThrow();
    expect(() => requirePasswordDiscovery({ ...v, EncryptionProfile: "other", PublicKey: key.PublicKey })).toThrow();
    const discovery = requirePasswordDiscovery({ ...v, PublicKey: key.PublicKey });
    for (const password of ["", "x".repeat(284), "🔐".repeat(71), "\ud800"])
      await expect(encryptProfilePassword(discovery, password)).rejects.toThrow();
  });
});

import { WSChannel, type IWSChannel } from "./isecure.class.js";
import { FakeTransport } from "./transport.js";
import { PASSWORD_ENCRYPTION_PROFILE } from "./challenge-crypto.js";
const settings: IWSChannel = {
  ApiKey: "0",
  Company: "Synthetic",
  Name: "Synthetic",
  Password: "Synthetic-password-42!",
  Phone: "+358400000000",
  PublicKey: "legacy unused",
  BaseUrl: "https://example.invalid/v2",
  Email: "synthetic@example.invalid",
  Mode: "admin",
  Bank: "bank",
  EncryptionProfile: PASSWORD_ENCRYPTION_PROFILE,
};
const discovery = { ResponseCode: "00", ResponseText: "OK", ...vectors.Cases[0], PublicKey: vectors.Keys[0].PublicKey };
it("never submits a password when an older server ignores the profile selector", async () => {
  const transport = new FakeTransport();
  let count = 0;
  transport.respond((request) => {
    count++;
    expect(request.method).toBe("GET");
    expect(request.url).toContain("EncryptionProfile=");
    return { status: 200, statusText: "OK", data: { Challenge: "legacy|1789841000000|id" } };
  });
  const client = new WSChannel({ ...settings }, { transport });
  await expect(client.login()).rejects.toThrow();
  expect(count).toBe(1);
});
it("keeps registration tenant binding and reset discovery on the correct routes", async () => {
  const transport = new FakeTransport();
  const submitted: string[] = [];
  transport.respond((request) => {
    if (request.method === "GET") {
      if (!request.url.includes("/password")) expect(new URL(request.url).searchParams.get("ApiKey")).toBe("0");
      return { status: 200, statusText: "OK", data: discovery };
    }
    submitted.push(request.method + " " + request.url);
    const body = request.body as Record<string, unknown>;
    expect(body.EncryptionProfile).toBe(PASSWORD_ENCRYPTION_PROFILE);
    expect(body.KeyId).toBe(discovery.KeyId);
    return {
      status: request.method === "PUT" ? 201 : 200,
      statusText: "OK",
      data: { ResponseCode: "00", ResponseText: "OK", ApiKey: "synthetictenant" },
    };
  });
  const client = new WSChannel({ ...settings }, { transport });
  await client.register();
  await client.initPasswordReset();
  await client.passwordReset("123456", "Synthetic-new-42!", discovery.Challenge);
  expect(submitted).toEqual([
    "PUT https://example.invalid/v2/account/synthetic%40example.invalid/admin",
    "POST https://example.invalid/v2/account/synthetic%40example.invalid/admin/password",
  ]);
  await expect(client.passwordReset("123456", "Again-42!", discovery.Challenge)).rejects.toThrow();
});
it("refuses a configuration change during discovery before sending a password", async () => {
  const transport = new FakeTransport();
  let calls = 0;
  transport.respond(() => {
    calls++;
    client.updateProps({ EncryptionProfile: "legacy" });
    return { status: 200, statusText: "OK", data: discovery };
  });
  const client = new WSChannel({ ...settings }, { transport });
  await expect(client.login()).rejects.toThrow("configuration changed");
  expect(calls).toBe(1);
});

it.each(["https://ws-api.test.isecure.fi/v2", "https://production.example.invalid/v2"])(
  "defaults all password operations to the stronger profile independently of endpoint: %s",
  async (BaseUrl) => {
    const transport = new FakeTransport();
    const posted: string[] = [];
    transport.respond((request) => {
      if (request.method === "GET") {
        expect(new URL(request.url).searchParams.get("EncryptionProfile")).toBe(PASSWORD_ENCRYPTION_PROFILE);
        return { status: 200, statusText: "OK", data: discovery };
      }
      const body = request.body as Record<string, unknown>;
      expect(body.EncryptionProfile).toBe(PASSWORD_ENCRYPTION_PROFILE);
      expect(body.KeyId).toBe(discovery.KeyId);
      posted.push(request.method + " " + new URL(request.url).pathname);
      return {
        status: request.method === "PUT" ? 201 : 200,
        statusText: "OK",
        data: { ResponseCode: "00", ResponseText: "OK", ApiKey: "synthetictenant", IdToken: "synthetic-token" },
      };
    });
    const defaults = { ...settings, BaseUrl };
    delete defaults.EncryptionProfile;
    const client = new WSChannel(defaults, { transport });
    await client.register();
    expect((await client.login()).status).toBe("authenticated");
    await client.initPasswordReset();
    await client.passwordReset("123456", "New-password-42!", discovery.Challenge);
    expect(posted).toEqual([
      "PUT /v2/account/synthetic%40example.invalid/admin",
      "POST /v2/session/synthetic%40example.invalid/admin",
      "POST /v2/account/synthetic%40example.invalid/admin/password",
    ]);
  },
);

it.each(["register", "login", "initPasswordReset"] as const)(
  "fails closed on unsupported server discovery for default %s",
  async (operation) => {
    const transport = new FakeTransport();
    transport.respond((request) => {
      expect(request.method).toBe("GET");
      return { status: 200, statusText: "OK", data: { Challenge: "legacy|1789841000000|id" } };
    });
    const defaults = { ...settings };
    delete defaults.EncryptionProfile;
    await expect(new WSChannel(defaults, { transport })[operation]()).rejects.toThrow(
      "requested password encryption profile",
    );
    expect(transport.requests).toHaveLength(1);
  },
);

it("keeps the explicit legacy wire protocol and restores the stronger default when the override is cleared", async () => {
  const transport = new FakeTransport();
  const legacyChallenge = "challenge|1475429754114|4017bda8-0a15-4154-a8b7-88069b05cb4e";
  let modern = false;
  transport.respond((request) => {
    if (request.method === "GET") {
      expect(new URL(request.url).searchParams.has("EncryptionProfile")).toBe(modern);
      return { status: 200, statusText: "OK", data: modern ? discovery : { Challenge: legacyChallenge } };
    }
    const body = request.body as Record<string, unknown>;
    if (modern) expect(body.EncryptionProfile).toBe(PASSWORD_ENCRYPTION_PROFILE);
    else {
      expect(body).not.toHaveProperty("EncryptionProfile");
      expect(body).not.toHaveProperty("KeyId");
      expect(body.ChResp).toBe(legacyChallenge);
    }
    return {
      status: request.method === "PUT" ? 201 : 200,
      statusText: "OK",
      data: { ResponseCode: "00", ResponseText: "OK", ApiKey: "synthetictenant", IdToken: "synthetic-token" },
    };
  });
  const client = new WSChannel(
    { ...settings, EncryptionProfile: "legacy", PublicKey: vectors.Keys[0].PublicKey },
    { transport },
  );
  await client.register();
  await client.login();
  await client.initPasswordReset();
  await client.passwordReset("123456", "New-password-42!", legacyChallenge);
  modern = true;
  client.updateProps({ EncryptionProfile: undefined });
  expect((await client.login()).status).toBe("authenticated");
});

it.each(["other", "", null, false])("rejects invalid runtime profile %s before making a request", async (profile) => {
  const transport = new FakeTransport();
  const config = { ...settings };
  Reflect.set(config, "EncryptionProfile", profile);
  const client = new WSChannel(config, { transport });
  await expect(client.login()).rejects.toThrow("Unsupported password encryption profile");
  expect(transport.requests).toHaveLength(0);
});
