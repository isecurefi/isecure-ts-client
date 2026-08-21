import * as openpgp from "openpgp";

const PAIN_001_NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09";
const PAIN_001_ROOT = new RegExp(
  `^\\s*(?:<\\?xml[^?]*\\?>\\s*)?<Document\\s+xmlns=["']${PAIN_001_NAMESPACE.replaceAll(".", "\\.")}["'](?:\\s|>)`,
  "u",
);

export interface ManualUploadClient {
  uploadFile(request: {
    readonly FileContents: string;
    readonly FileName: string;
    readonly FileType: string;
    readonly Signature: string;
  }): Promise<{ readonly ResponseCode: string }>;
}

export class ManualUploadRefusedError extends Error {
  public constructor(public readonly responseCode: string) {
    super(`upload exact signed payment export was refused with code ${responseCode}`);
    this.name = "ManualUploadRefusedError";
  }
}

export function requirePain001(bytes: Uint8Array): void {
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!PAIN_001_ROOT.test(xml) || xml.includes("<!DOCTYPE") || xml.includes("<!ENTITY")) {
    throw new Error("The verified export is not safe pain.001.001.09 XML");
  }
}

export function requireMatchingKeys(publicKey: openpgp.PublicKey, privateKey: openpgp.PrivateKey): void {
  if (publicKey.getFingerprint() !== privateKey.getFingerprint()) {
    throw new Error("The OpenPGP public and private keys do not match");
  }
}

export async function detachedSignature(
  bytes: Uint8Array,
  publicKey: openpgp.PublicKey,
  privateKey: openpgp.PrivateKey,
): Promise<string> {
  const message = await openpgp.createMessage({ binary: bytes });
  const signatureResult: unknown = await openpgp.sign({
    message,
    signingKeys: privateKey,
    detached: true,
    format: "armored",
  });
  if (typeof signatureResult !== "string") throw new Error("OpenPGP signing did not return an armored signature");
  const signature = signatureResult;
  const verification = await openpgp.verify({
    message: await openpgp.createMessage({ binary: bytes }),
    signature: await openpgp.readSignature({ armoredSignature: signature }),
    verificationKeys: publicKey,
  });
  if (verification.signatures.length !== 1) throw new Error("OpenPGP signature verification was ambiguous");
  const verified = verification.signatures[0];
  if (verified === undefined) throw new Error("OpenPGP signature verification was unavailable");
  await verified.verified;
  return signature;
}

export async function uploadPain001Once(
  client: ManualUploadClient,
  bytes: Uint8Array,
  signature: string,
  runId: string,
): Promise<void> {
  const response = await client.uploadFile({
    FileContents: Buffer.from(bytes).toString("base64"),
    FileName: `processing-${runId}.xml`,
    FileType: "pain.001.001.09",
    Signature: signature,
  });
  if (response.ResponseCode !== "00") {
    throw new ManualUploadRefusedError(response.ResponseCode);
  }
}
