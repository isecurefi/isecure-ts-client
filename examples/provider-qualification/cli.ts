import { constants, closeSync, fstatSync, openSync, readFileSync } from "node:fs";
import axios from "axios";
import {
  AxiosTransport,
  WSChannel,
  type CredentialProvider,
  type IWSChannel,
  type MaventaCredentials,
  type MobilePayCredentials,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from "../../src/index.js";
import { authenticate } from "../shared/auth.js";
import { assertProviderRequest, validateTarget, type RequestScope } from "./policy.js";
import { qualifyLifecycle, qualifyReads } from "./journey.js";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid private configuration");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Missing private configuration field");
  return value;
}
function privateJson(file: string): Record<string, unknown> {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > 1024 * 1024 || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())
      throw new Error("Configuration requires an owner-only regular file");
    return object(JSON.parse(readFileSync(fd, "utf8")));
  } finally {
    closeSync(fd);
  }
}
class QualificationTransport implements Transport {
  private readonly inner = new AxiosTransport({
    client: axios.create({ maxRedirects: 0, maxContentLength: 6 * 1024 * 1024, maxBodyLength: 1024 * 1024 }),
    retries: 0,
  });
  constructor(private readonly scope: RequestScope) {}
  request<T, B = unknown>(request: TransportRequest<B>): Promise<TransportResponse<T>> {
    assertProviderRequest(this.scope, request);
    return this.inner.request<T, B>({ ...request, retry: false });
  }
}
function makeClient(
  raw: unknown,
  provider: CredentialProvider,
  baseUrl: string,
  mode: "admin" | "data",
  lifecycle: boolean,
): WSChannel {
  const config = object(raw);
  const props: IWSChannel = {
    BaseUrl: baseUrl,
    Bank: provider,
    Mode: mode,
    LogLevel: "silent",
    Company: string(config.Company),
    Name: string(config.Name),
    Password: string(config.Password),
    Email: string(config.Email),
    Phone: string(config.Phone),
    PublicKey: string(config.PublicKey),
  };
  return new WSChannel(props, {
    transport: new QualificationTransport({ baseUrl, provider, email: props.Email, mode, lifecycle }),
  });
}
function maventa(file: string, environment: "stage" | "production"): MaventaCredentials {
  const c = privateJson(file);
  if (c.Environment !== environment) throw new Error("Maventa environment must match the qualification target");
  return {
    Environment: environment,
    CompanyUuid: string(c.CompanyUuid),
    UserApiKey: string(c.UserApiKey),
    VendorApiKey: string(c.VendorApiKey),
  };
}
function mobilepay(file: string): MobilePayCredentials {
  const c = privateJson(file);
  if (
    c.Environment !== "production" ||
    (c.DefaultLookbackDays !== undefined &&
      (!Number.isInteger(c.DefaultLookbackDays) ||
        Number(c.DefaultLookbackDays) < 1 ||
        Number(c.DefaultLookbackDays) > 31))
  )
    throw new Error("Invalid MobilePay environment or window");
  const common = {
    Environment: "production" as const,
    ClientId: string(c.ClientId),
    ClientSecret: string(c.ClientSecret),
    LedgerTimezone: string(c.LedgerTimezone),
    LedgerCutoff: string(c.LedgerCutoff),
    ...(c.DefaultLookbackDays === undefined ? {} : { DefaultLookbackDays: Number(c.DefaultLookbackDays) }),
  };
  if (c.LedgerScope === "AllAccessible" && c.LedgerId === undefined && c.RecipientHandle === undefined)
    return { ...common, LedgerScope: "AllAccessible" };
  if (c.LedgerScope !== undefined) throw new Error("Invalid MobilePay ledger scope");
  return { ...common, LedgerId: string(c.LedgerId), RecipientHandle: string(c.RecipientHandle) };
}
async function main(): Promise<void> {
  const [mode, file, ...extra] = process.argv.slice(2);
  if (!file || extra.length || (mode !== "read" && mode !== "lifecycle"))
    throw new Error("Use read or lifecycle with a private configuration path");
  const config = privateJson(file);
  if (config.schemaVersion !== 1 || (config.provider !== "maventa" && config.provider !== "mobilepay"))
    throw new Error("Invalid qualification configuration");
  const provider = config.provider;
  const baseUrl = string(config.baseUrl);
  validateTarget(baseUrl);
  if (mode === "lifecycle" && config.allowFixtureMutation !== true)
    throw new Error("Lifecycle requires an explicitly authorized isolated fixture");
  const clients: WSChannel[] = [];
  try {
    const data = makeClient(config.data, provider, baseUrl, "data", false);
    clients.push(data);
    await authenticate(data);
    if (mode === "read") {
      const result = await qualifyReads(data, provider);
      process.stdout.write(JSON.stringify({ schemaVersion: 1, provider, mode, ...result, result: "passed" }) + "\n");
      return;
    }
    const admin = makeClient(config.admin, provider, baseUrl, "admin", true);
    clients.push(admin);
    const foreign = makeClient(config.foreignData, provider, baseUrl, "data", false);
    clients.push(foreign);
    const denied = makeClient(config.deniedData, provider, baseUrl, "data", false);
    clients.push(denied);
    for (const client of [admin, foreign, denied]) await authenticate(client);
    const initial = string(config.credentialsFile);
    const rotated = string(config.rotatedCredentialsFile);
    if (provider === "maventa") {
      const environment = baseUrl.endsWith("/rc") ? "production" : "stage";
      await qualifyLifecycle(
        admin,
        data,
        foreign,
        denied,
        provider,
        maventa(initial, environment),
        maventa(rotated, environment),
      );
    } else await qualifyLifecycle(admin, data, foreign, denied, provider, mobilepay(initial), mobilepay(rotated));
    process.stdout.write(JSON.stringify({ schemaVersion: 1, provider, mode, result: "passed" }) + "\n");
  } finally {
    for (const client of clients)
      if (client.isAuthenticated())
        await client.logout().catch(() => {
          process.stderr.write("Provider qualification session cleanup failed\n");
        });
  }
}
// Deliberately discard raw error messages, causes, response objects and stack traces.
void main().catch(() => {
  process.stderr.write("Provider qualification failed; no customer data emitted\n");
  process.exitCode = 1;
});
