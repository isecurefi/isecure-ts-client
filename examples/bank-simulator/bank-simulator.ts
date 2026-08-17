import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as openpgp from "openpgp";
import { WSChannel, type ApiResponse, type IWSChannel, type ListFilesResponse } from "../../src/index.js";
import { authenticate, configFromEnv, requiredEnv } from "../shared/auth.js";

const CAMT_053 = "camt.053.001.02";
const OUTPUT_TYPES = ["pain.002.001.10", "camt.054.001.02", CAMT_053] as const;
const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 60_000;

type FileDescriptor = ListFilesResponse["FileDescriptors"][number];
type ResponseEnvelope = Pick<ApiResponse, "ResponseCode" | "ResponseText">;

interface Clients {
  admin: WSChannel;
  data: WSChannel;
}

interface SigningKeyPair {
  publicKey: string;
  privateKey: string;
}

function assertSuccess<T extends ResponseEnvelope>(response: T, operation: string): T {
  if (response.ResponseCode !== "00") {
    throw new Error(`${operation} failed (${response.ResponseCode}): ${response.ResponseText}`);
  }
  return response;
}

function sourceAsset(relativePath: string): string {
  const besideScript = fileURLToPath(new URL(relativePath, import.meta.url));
  const compiledMarker = `${path.sep}dist-examples${path.sep}`;
  return besideScript.includes(compiledMarker) ? besideScript.replace(compiledMarker, path.sep) : besideScript;
}

async function publicRsaKey(): Promise<string> {
  const configuredPath = process.env.ISECURE_PUBLIC_KEY_PEM_FILE;
  if (configuredPath) {
    return readFile(path.resolve(configuredPath), "utf8");
  }
  return readFile(sourceAsset("../gpg-encryption-test/test.pem"), "utf8");
}

async function clients(publicKey: string): Promise<Clients> {
  const base: Partial<IWSChannel> = { Bank: "simulator", PublicKey: publicKey };
  const shouldRegister = process.env.ISECURE_REGISTER === "1";
  let apiKey = process.env.ISECURE_API_KEY;

  const admin = new WSChannel(
    configFromEnv({ ...base, ApiKey: shouldRegister ? "0" : requiredEnv("ISECURE_API_KEY"), Mode: "admin" }),
  );

  if (shouldRegister) {
    const registration = assertSuccess(await admin.register(), "admin registration");
    apiKey = registration.ApiKey;
    admin.updateProps({ ApiKey: apiKey });
    const apiKeyOutput = path.resolve(process.env.ISECURE_API_KEY_OUTPUT_FILE ?? ".isecure-simulator-api-key");
    await writeFile(apiKeyOutput, `${apiKey}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log(`Stored the new API key in ${apiKeyOutput}.`);
  }

  const data = new WSChannel(
    configFromEnv({ ...base, ApiKey: apiKey ?? requiredEnv("ISECURE_API_KEY"), Mode: "data" }),
  );
  if (shouldRegister) {
    assertSuccess(await data.register(), "data registration");
  }

  await authenticate(data);
  await authenticate(admin);
  console.log(shouldRegister ? "Registered and authenticated admin/data users." : "Authenticated admin/data users.");
  return { admin, data };
}

function hasSimulatorCertificate(response: Awaited<ReturnType<WSChannel["listCerts"]>>): boolean {
  return response.Certs.some((connection) => connection.CertName.toLowerCase().includes("simulator"));
}

async function ensureSimulatorEnrollment({ admin, data }: Clients): Promise<boolean> {
  const current = assertSuccess(await data.listCerts(), "list certificates");
  if (hasSimulatorCertificate(current)) {
    console.log("Using the existing simulator enrollment.");
    return false;
  }

  const suffix = crypto.randomUUID().replaceAll("-", "");
  assertSuccess(
    await admin.enrollCert({
      Code: `SIM-${suffix.slice(0, 24)}`,
      Company: admin.props.Company,
      WsUserId: `SIM-${suffix.slice(0, 12)}`,
    }),
    "simulator enrollment",
  );

  const enrolled = assertSuccess(await data.listCerts(), "list certificates after enrollment");
  if (!hasSimulatorCertificate(enrolled)) {
    throw new Error("Simulator enrollment succeeded but no simulator certificate is visible.");
  }
  console.log("Enrolled the simulator bank with caller-generated test values.");
  return true;
}

async function loadSigningKeyPair(): Promise<SigningKeyPair> {
  const publicPath = process.env.ISECURE_PGP_PUBLIC_KEY_FILE;
  const privatePath = process.env.ISECURE_PGP_PRIVATE_KEY_FILE;
  if ((publicPath && !privatePath) || (!publicPath && privatePath)) {
    throw new Error("Set both ISECURE_PGP_PUBLIC_KEY_FILE and ISECURE_PGP_PRIVATE_KEY_FILE, or neither.");
  }
  if (publicPath && privatePath) {
    return {
      publicKey: await readFile(path.resolve(publicPath), "utf8"),
      privateKey: await readFile(path.resolve(privatePath), "utf8"),
    };
  }

  const keyDirectory = path.resolve(process.env.ISECURE_PGP_KEY_DIRECTORY ?? ".isecure-simulator-pgp");
  const retainedPublicPath = path.join(keyDirectory, "authorize-public.asc");
  const retainedPrivatePath = path.join(keyDirectory, "authorize-private.asc");
  if (existsSync(retainedPublicPath) !== existsSync(retainedPrivatePath)) {
    throw new Error(`Incomplete retained PGP key pair in ${keyDirectory}.`);
  }
  if (existsSync(retainedPublicPath)) {
    return {
      publicKey: await readFile(retainedPublicPath, "utf8"),
      privateKey: await readFile(retainedPrivatePath, "utf8"),
    };
  }

  const generated = await openpgp.generateKey({
    type: "rsa",
    rsaBits: 2048,
    userIDs: [{ name: requiredEnv("ISECURE_NAME"), email: requiredEnv("ISECURE_EMAIL") }],
  });
  await mkdir(keyDirectory, { recursive: true, mode: 0o700 });
  await writeFile(retainedPublicPath, generated.publicKey, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await writeFile(retainedPrivatePath, generated.privateKey, { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.log(`Stored the generated PGP key pair in ${keyDirectory}.`);
  return { publicKey: generated.publicKey, privateKey: generated.privateKey };
}

async function ensureAuthorizeKey(admin: WSChannel, pair: SigningKeyPair): Promise<void> {
  const parsed = await openpgp.readKey({ armoredKey: pair.publicKey });
  const shortKeyId = parsed.getKeyID().toHex().slice(-8).toUpperCase();
  const listed = assertSuccess(await admin.listKeys(), "list PGP keys");
  const exists = listed.PgpKeys.some(
    (key) => key.PgpKeyPurpose === "authorize" && key.PgpKeyId.toUpperCase() === shortKeyId,
  );
  if (!exists) {
    assertSuccess(await admin.uploadPgpKey(pair.publicKey, "authorize"), "upload authorize PGP key");
  }
  const verified = assertSuccess(await admin.listKeys(), "verify authorize PGP key");
  if (!verified.PgpKeys.some((key) => key.PgpKeyPurpose === "authorize" && key.PgpKeyId.toUpperCase() === shortKeyId)) {
    throw new Error("The expected authorize PGP key is unavailable after key upload.");
  }
  console.log(exists ? "Using the existing authorize PGP key." : "Uploaded an authorize PGP public key.");
}

async function listAll(client: WSChannel, fileType: string): Promise<ListFilesResponse> {
  return assertSuccess(await client.listFiles({ FileType: fileType, Status: "ALL" }), `list ${fileType}`);
}

async function waitForNewFile(
  client: WSChannel,
  fileType: string,
  priorReferences: ReadonlySet<string>,
): Promise<FileDescriptor> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const listed = assertSuccess(await client.listFiles({ FileType: fileType, Status: "NEW" }), `poll ${fileType}`);
    const descriptor = listed.FileDescriptors.find(
      (candidate) => candidate.FileType === fileType && !priorReferences.has(candidate.FileReference),
    );
    if (descriptor) return descriptor;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`No new ${fileType} file appeared within ${POLL_TIMEOUT_MS / 1_000} seconds.`);
}

async function download(client: WSChannel, descriptor: FileDescriptor, fileName: string): Promise<Buffer> {
  const response = assertSuccess(
    await client.downloadFile(descriptor.FileType, descriptor.FileReference),
    `download ${descriptor.FileType}`,
  );
  const bytes = Buffer.from(response.Content, "base64");
  if (!bytes.includes(Buffer.from(descriptor.FileType))) {
    throw new Error(`Downloaded ${descriptor.FileType} content does not contain its ISO 20022 namespace.`);
  }
  const outputDirectory = path.resolve(process.env.ISECURE_OUTPUT_DIR ?? "isecure-simulator-downloads");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, fileName), bytes, { mode: 0o600 });
  return bytes;
}

async function main(): Promise<void> {
  const channel = await clients(await publicRsaKey());
  const enrolledNow = await ensureSimulatorEnrollment(channel);

  const initialList = assertSuccess(
    await channel.data.listFiles({ FileType: CAMT_053, Status: enrolledNow ? "NEW" : "ALL" }),
    "list initial camt.053 files",
  );
  console.log(`Listed ${initialList.FileDescriptors.length} camt.053 file(s) before upload.`);
  if (enrolledNow) {
    const initial = await waitForNewFile(channel.data, CAMT_053, new Set());
    await download(channel.data, initial, "initial-camt.053.001.02.xml");
    console.log("Downloaded the fresh enrollment's initial camt.053.");
  }

  const signingKeys = await loadSigningKeyPair();
  await ensureAuthorizeKey(channel.admin, signingKeys);

  const priorReferences = new Map<string, Set<string>>();
  for (const fileType of OUTPUT_TYPES) {
    const listed = await listAll(channel.data, fileType);
    priorReferences.set(fileType, new Set(listed.FileDescriptors.map((descriptor) => descriptor.FileReference)));
  }

  const paymentPath = path.resolve(process.env.ISECURE_PAYMENT_FILE ?? sourceAsset("./synthetic-pain.001.001.09.xml"));
  const payment = await readFile(paymentPath);
  const signatureResult: unknown = await openpgp.sign({
    message: await openpgp.createMessage({ binary: payment }),
    signingKeys: await openpgp.readPrivateKey({ armoredKey: signingKeys.privateKey }),
    detached: true,
    format: "armored",
  });
  if (typeof signatureResult !== "string") {
    throw new Error("OpenPGP signing did not return an armored detached signature.");
  }
  assertSuccess(
    await channel.data.uploadFile({
      FileContents: payment.toString("base64"),
      FileName: `synthetic-simulator-${crypto.randomUUID()}.xml`,
      FileType: "pain.001.001.09",
      Signature: signatureResult,
    }),
    "upload signed pain.001",
  );
  console.log("Uploaded the detached-OpenPGP-signed synthetic pain.001 file.");

  for (const fileType of OUTPUT_TYPES) {
    const descriptor = await waitForNewFile(channel.data, fileType, priorReferences.get(fileType) ?? new Set());
    const fileName = fileType === CAMT_053 ? "payment-camt.053.001.02.xml" : `${fileType}.xml`;
    await download(channel.data, descriptor, fileName);
    console.log(`Downloaded ${fileType}.`);
  }

  console.log(
    `E2E simulator flow passed. Files are in ${path.resolve(process.env.ISECURE_OUTPUT_DIR ?? "isecure-simulator-downloads")}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown simulator example failure");
  process.exitCode = 1;
});
