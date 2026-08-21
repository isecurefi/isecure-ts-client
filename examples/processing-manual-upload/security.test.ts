import * as openpgp from "openpgp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  detachedSignature,
  hasAuthorizeKey,
  requireMatchingKeys,
  requirePain001,
  requireSharedApiKeyDomain,
  roleCredentials,
  uploaderCredentials,
  uploadPain001Once,
} from "./security.js";

const XML = new TextEncoder().encode(
  '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"></Document>',
);

let privateKey: openpgp.PrivateKey;
let publicKey: openpgp.PublicKey;
let otherPrivateKey: openpgp.PrivateKey;

beforeAll(async () => {
  const first = await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519",
    userIDs: [{ name: "Synthetic Signer", email: "signer@example.test" }],
  });
  const second = await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519",
    userIDs: [{ name: "Other Synthetic Signer", email: "other@example.test" }],
  });
  privateKey = await openpgp.readPrivateKey({ armoredKey: first.privateKey });
  publicKey = await openpgp.readKey({ armoredKey: first.publicKey });
  otherPrivateKey = await openpgp.readPrivateKey({ armoredKey: second.privateKey });
});

describe("manual Processing upload security boundary", () => {
  it("resolves separate role and paired-uploader credentials without partial fallback", () => {
    const values = {
      ISECURE_ADMIN_EMAIL: "admin@example.test",
      ISECURE_ADMIN_PASSWORD: "admin-password",
      ISECURE_DATA_EMAIL: "approver@example.test",
      ISECURE_DATA_PASSWORD: "approver-password",
      ISECURE_UPLOAD_DATA_EMAIL: "admin@example.test",
      ISECURE_UPLOAD_DATA_PASSWORD: "uploader-password",
    };
    expect(roleCredentials("admin", values)).toEqual({
      Email: "admin@example.test",
      Password: "admin-password",
    });
    expect(roleCredentials("data", values)).toEqual({
      Email: "approver@example.test",
      Password: "approver-password",
    });
    expect(uploaderCredentials(values)).toEqual({
      Email: "admin@example.test",
      Password: "uploader-password",
    });
    expect(() => uploaderCredentials({ ISECURE_UPLOAD_DATA_EMAIL: "incomplete@example.test" })).toThrow(
      "Set both uploader email and password",
    );
    expect(uploaderCredentials({ ISECURE_EMAIL: "shared@example.test", ISECURE_PASSWORD: "shared-password" })).toEqual({
      Email: "shared@example.test",
      Password: "shared-password",
    });
  });

  it("matches only the exact authorize key identifier and purpose", () => {
    const keyId = publicKey.getKeyID().toHex().slice(-8).toUpperCase();
    expect(hasAuthorizeKey(publicKey, [{ PgpKeyId: keyId.toLowerCase(), PgpKeyPurpose: "authorize" }])).toBe(true);
    expect(hasAuthorizeKey(publicKey, [{ PgpKeyId: keyId, PgpKeyPurpose: "encrypt" }])).toBe(false);
    expect(hasAuthorizeKey(publicKey, [{ PgpKeyId: "00000000", PgpKeyPurpose: "authorize" }])).toBe(false);
  });

  it("refuses a missing or substituted API-key tenant domain", () => {
    expect(() => {
      requireSharedApiKeyDomain(["tenant-key", "tenant-key", "tenant-key"]);
    }).not.toThrow();
    expect(() => {
      requireSharedApiKeyDomain(["tenant-key", "other-tenant-key", "tenant-key"]);
    }).toThrow("do not share one API-key domain");
    expect(() => {
      requireSharedApiKeyDomain(["tenant-key", undefined, "tenant-key"]);
    }).toThrow("do not share one API-key domain");
  });

  it("accepts only the exact pain.001.001.09 namespace without entity declarations", () => {
    expect(() => {
      requirePain001(XML);
    }).not.toThrow();
    expect(() => {
      requirePain001(
        new TextEncoder().encode(
          '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"></Document>',
        ),
      );
    }).toThrow("not safe pain.001.001.09 XML");
    expect(() => {
      requirePain001(
        new TextEncoder().encode(
          '<!-- <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"> --><Document xmlns="urn:other"></Document>',
        ),
      );
    }).toThrow("not safe pain.001.001.09 XML");
    expect(() => {
      requirePain001(
        new TextEncoder().encode(
          '<!DOCTYPE Document [<!ENTITY x "unsafe">]><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">&x;</Document>',
        ),
      );
    }).toThrow("not safe pain.001.001.09 XML");
    expect(() => {
      requirePain001(Uint8Array.from([0xff, 0xfe]));
    }).toThrow();
  });

  it("refuses a public/private key mismatch", () => {
    expect(() => {
      requireMatchingKeys(publicKey, privateKey);
    }).not.toThrow();
    expect(() => {
      requireMatchingKeys(publicKey, otherPrivateKey);
    }).toThrow("do not match");
  });

  it("creates one detached signature that verifies only against the exact bytes", async () => {
    const armored = await detachedSignature(XML, publicKey, privateKey);
    const signature = await openpgp.readSignature({ armoredSignature: armored });
    const valid = await openpgp.verify({
      message: await openpgp.createMessage({ binary: XML }),
      signature,
      verificationKeys: publicKey,
    });
    await expect(valid.signatures[0]?.verified).resolves.toBe(true);

    const changed = await openpgp.verify({
      message: await openpgp.createMessage({ binary: new Uint8Array([...XML, 0x20]) }),
      signature,
      verificationKeys: publicKey,
    });
    await expect(changed.signatures[0]?.verified).rejects.toThrow();
  });

  it("makes exactly one upload call with the exact bytes and never retries refusal or uncertainty", async () => {
    const accepted = vi.fn(async () => ({ ResponseCode: "00" }));
    await uploadPain001Once({ uploadFile: accepted }, XML, "synthetic-signature", "synthetic-run");
    expect(accepted).toHaveBeenCalledOnce();
    expect(accepted).toHaveBeenCalledWith({
      FileContents: Buffer.from(XML).toString("base64"),
      FileName: "processing-synthetic-run.xml",
      FileType: "pain.001.001.09",
      Signature: "synthetic-signature",
    });

    const refused = vi.fn(async () => ({ ResponseCode: "12" }));
    await expect(uploadPain001Once({ uploadFile: refused }, XML, "synthetic-signature", "refused-run")).rejects.toThrow(
      "refused with code 12",
    );
    expect(refused).toHaveBeenCalledOnce();

    const uncertain = vi.fn(async () => Promise.reject(new Error("synthetic timeout")));
    await expect(
      uploadPain001Once({ uploadFile: uncertain }, XML, "synthetic-signature", "uncertain-run"),
    ).rejects.toThrow("synthetic timeout");
    expect(uncertain).toHaveBeenCalledOnce();
  });
});
