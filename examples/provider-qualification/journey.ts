import { randomUUID } from "node:crypto";
import {
  ABSENT_PROVIDER_VERSION,
  createProviderEnrollment,
  ISecureHttpError,
  type CredentialProvider,
  type ProviderCredentials,
  type WSChannel,
} from "../../src/index.js";

export type ReadClient = Pick<WSChannel, "checkProviderConnection" | "listCerts" | "listFiles" | "downloadFile">;
export const FILE_TYPES = {
  maventa: ["MAVENTA_INVOICE_JSON_V1"],
  mobilepay: ["MOBILEPAY_FUNDS_JSON_V1", "MOBILEPAY_FEES_JSON_V1"],
} as const;
const MAX_BYTES = 4 * 1024 * 1024;
function success<T extends { ResponseCode: string }>(value: T): T {
  if (value.ResponseCode !== "00") throw new Error("Provider operation refused");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid provider JSON");
  return value as Record<string, unknown>;
}
/** Returns only byte/page counts. Report contents and source identifiers stay in memory. */
export function verifyDownload(
  provider: CredentialProvider,
  fileType: string,
  content: string,
): { bytes: number; pages: number } {
  if (
    !content ||
    content.length > Math.ceil(MAX_BYTES / 3) * 4 ||
    content.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(content)
  )
    throw new Error("Invalid provider content encoding");
  const bytes = Buffer.from(content, "base64");
  if (bytes.length > MAX_BYTES || bytes.toString("base64") !== content)
    throw new Error("Invalid provider content encoding");
  let value: Record<string, unknown>;
  try {
    value = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    throw new Error("Invalid provider JSON");
  }
  if (provider === "maventa") return { bytes: bytes.length, pages: 1 };
  const pages: unknown = value.pages;
  if (
    value.schemaVersion !== 1 ||
    value.topic !== (fileType === FILE_TYPES.mobilepay[0] ? "funds" : "fees") ||
    typeof value.ledgerDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value.ledgerDate) ||
    typeof value.ledgerId !== "string" ||
    !value.ledgerId ||
    !Array.isArray(pages) ||
    !pages.length ||
    pages.length > 100
  )
    throw new Error("Invalid MobilePay report envelope");
  for (const [index, raw] of pages.entries()) {
    const page = object(raw);
    const more = index < pages.length - 1;
    if (
      !Array.isArray(page.items) ||
      page.tryLater !== false ||
      page.hasMore !== more ||
      (more ? typeof page.cursor !== "string" || !page.cursor : page.cursor != null && page.cursor !== "")
    )
      throw new Error("MobilePay report is incomplete");
    for (const item of page.items)
      if (object(item).ledgerDate !== value.ledgerDate) throw new Error("MobilePay report date mismatch");
  }
  return { bytes: bytes.length, pages: pages.length };
}
export async function qualifyReads(
  client: ReadClient,
  provider: CredentialProvider,
): Promise<{ downloads: number; bytes: number; pages: number }> {
  if (!success(await client.checkProviderConnection(provider)).Ready) throw new Error("Provider is not ready");
  const connections = success(await client.listCerts()).Connections;
  const connection = connections?.find((value) => value.Bank === provider && value.Access === "direct");
  if (!connection || !Array.isArray(connection.Certificates) || connection.Certificates.length !== 0)
    throw new Error("Certificate-free provider connection is absent");
  const result = { downloads: 0, bytes: 0, pages: 0 };
  for (const fileType of FILE_TYPES[provider]) {
    const queryType = provider === "mobilepay" ? fileType + "_7D" : fileType;
    const listed = success(await client.listFiles({ FileType: queryType, Status: "ALL" })).FileDescriptors;
    if (!listed?.length) throw new Error("A required provider file is unavailable; qualification is incomplete");
    if (listed.length > 2048 || listed.some((file) => file.FileType !== fileType || !file.FileReference))
      throw new Error("Invalid provider listing");
    const file = listed[0];
    if (!file) throw new Error("A required provider file is unavailable");
    const download = success(await client.downloadFile(fileType, file.FileReference));
    const checked = verifyDownload(provider, fileType, download.Content);
    result.downloads++;
    result.bytes += checked.bytes;
    result.pages += checked.pages;
  }
  return result;
}
export async function expectDenied(operation: () => Promise<unknown>, statuses: readonly number[]): Promise<void> {
  let matched = false;
  try {
    await operation();
  } catch (error) {
    matched = error instanceof ISecureHttpError && statuses.includes(error.status);
  }
  if (!matched) throw new Error("Provider denial did not match the required authenticated refusal");
}

/** Destructive fixture lifecycle. Call only for a separately authorized, never-enrolled account. */
export async function qualifyLifecycle<P extends CredentialProvider>(
  admin: WSChannel,
  data: WSChannel,
  foreign: WSChannel,
  denied: WSChannel,
  provider: P,
  credentials: ProviderCredentials[NoInfer<P>],
  rotatedCredentials: ProviderCredentials[NoInfer<P>],
): Promise<void> {
  if (
    admin.props.Mode !== "admin" ||
    [data, foreign, denied].some((c) => c.props.Mode !== "data") ||
    admin.props.Email !== data.props.Email ||
    !admin.session.apiKey ||
    admin.session.apiKey !== data.session.apiKey ||
    !foreign.session.apiKey ||
    foreign.session.apiKey === data.session.apiKey ||
    !denied.session.apiKey ||
    new Set([data.session.apiKey, foreign.session.apiKey, denied.session.apiKey]).size !== 3 ||
    denied.props.Email === data.props.Email
  )
    throw new Error("Provider fixture account isolation is invalid");
  const baseline = success(await admin.getProviderConnection(provider));
  if (baseline.Enrolled || baseline.Version !== ABSENT_PROVIDER_VERSION)
    throw new Error("Provider lifecycle requires a never-enrolled isolated fixture");
  // Verify subscription denial before any credential mutation.
  await expectDenied(() => denied.checkProviderConnection(provider), [403]);
  await expectDenied(() => denied.listFiles({ Status: "ALL" }), [403]);
  const enrollmentChange = { expectedVersion: baseline.Version, idempotencyKey: randomUUID() };
  const body = createProviderEnrollment(provider, credentials, enrollmentChange, admin.props.Company);
  // Keep the exact input/change identifier for explicit retries; never automatically replay.
  const ownedVersions = new Set<string>([enrollmentChange.idempotencyKey]);
  try {
    success(await admin.enrollCert(body));
    const enrolled = success(await admin.getProviderConnection(provider));
    if (!enrolled.Enrolled || enrolled.Version !== enrollmentChange.idempotencyKey)
      throw new Error("Provider enrollment revision mismatch");
    await qualifyReads(data, provider);
    const fileType = FILE_TYPES[provider][0];
    const files = success(
      await data.listFiles({ FileType: provider === "mobilepay" ? fileType + "_7D" : fileType, Status: "ALL" }),
    ).FileDescriptors;
    const file = files?.[0];
    if (!file) throw new Error("Provider isolation needs an enrolled file");
    await expectDenied(() => foreign.downloadFile(file.FileType, file.FileReference), [404]);
    await expectDenied(() => denied.downloadFile(file.FileType, file.FileReference), [403]);
    const foreignConnections = success(await foreign.listCerts()).Connections ?? [];
    if (foreignConnections.some((c) => c.Bank === provider))
      throw new Error("Foreign fixture unexpectedly discovers the provider");
    const change = { expectedVersion: enrolled.Version, idempotencyKey: randomUUID() };
    ownedVersions.add(change.idempotencyKey);
    const rotated = success(await admin.updateProviderConnection(provider, rotatedCredentials, change));
    if (!rotated.Enrolled || rotated.Version !== change.idempotencyKey)
      throw new Error("Provider rotation revision mismatch");
    // Same input/key replay must preserve revision. Stale version with a new command must fail.
    const replay = success(await admin.updateProviderConnection(provider, rotatedCredentials, change));
    if (replay.Version !== rotated.Version) throw new Error("Provider rotation replay changed revision");
    await expectDenied(
      () => admin.updateProviderConnection(provider, rotatedCredentials, { ...change, idempotencyKey: randomUUID() }),
      [409],
    );
    await qualifyReads(data, provider);
  } finally {
    await cleanup();
  }
  async function cleanup(): Promise<void> {
    // Only disable revisions belonging to this fixture invocation. A concurrent operator wins.
    const current = success(await admin.getProviderConnection(provider));
    if (current.Enrolled) {
      if (!ownedVersions.has(current.Version))
        throw new Error("Concurrent provider change prevents automatic fixture cleanup");
      const disabled = success(
        await admin.disableProviderConnection(provider, {
          expectedVersion: current.Version,
          idempotencyKey: randomUUID(),
        }),
      );
      if (disabled.Enrolled) throw new Error("Provider fixture cleanup failed");
    }
  }
  await expectDenied(() => data.checkProviderConnection(provider), [403, 404]);
  const after = success(await data.listCerts()).Connections ?? [];
  if (after.some((c) => c.Bank === provider)) throw new Error("Disabled provider remains discoverable");
}
