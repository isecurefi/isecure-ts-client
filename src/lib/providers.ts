import type { components } from "../generated/provider-api.js";
import type { EnrollCertRequest } from "./api-types.js";
import { ISecureError } from "./errors.js";
import type { HttpHeaders } from "./transport.js";

type Schemas = components["schemas"];
export type CredentialProvider = "maventa" | "mobilepay";
export type MaventaCredentials = Schemas["EnrollMaventaConnectionReq"];
type MobilePayWireCredentials = Schemas["EnrollMobilePayConnectionReq"];
/** Explicit ledger scope; the SDK never infers or broadens provider authority. */
export type MobilePayCredentials = Omit<MobilePayWireCredentials, "LedgerScope" | "LedgerId" | "RecipientHandle"> &
  (
    | { LedgerScope: "AllAccessible"; LedgerId?: never; RecipientHandle?: never }
    | { LedgerScope?: never; LedgerId: string; RecipientHandle: string }
  );
export interface ProviderCredentials {
  maventa: MaventaCredentials;
  mobilepay: MobilePayCredentials;
}
export type ProviderConnectionMetadata = Schemas["GetMaventaConnectionResp"] | Schemas["GetMobilePayConnectionResp"];
export type ProviderReadiness = Schemas["CheckMaventaConnectionResp"] | Schemas["CheckMobilePayConnectionResp"];

export interface ProviderChange {
  /** Unquoted Version returned by metadata; use the absent version only for a new connection. */
  expectedVersion: string;
  /** New lowercase UUID per logical change. Retain it and the exact input for an explicit retry. */
  idempotencyKey: string;
}
export const ABSENT_PROVIDER_VERSION = "00000000-0000-0000-0000-000000000000";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function requireProvider(provider: CredentialProvider): CredentialProvider {
  if (provider !== "maventa" && provider !== "mobilepay") throw new ISecureError("Unsupported credential provider");
  return provider;
}

export function providerChangeHeaders(change: ProviderChange): HttpHeaders {
  if (
    !UUID.test(change.expectedVersion) ||
    !UUID.test(change.idempotencyKey) ||
    change.idempotencyKey === ABSENT_PROVIDER_VERSION
  ) {
    throw new ISecureError("Provider changes require a lowercase UUID version and a nonzero idempotency UUID");
  }
  return { "If-Match": `"${change.expectedVersion}"`, "Idempotency-Key": change.idempotencyKey };
}

/** Build the existing EnrollCert body. The returned Code contains secrets: never log or persist it. */
export function createProviderEnrollment<P extends CredentialProvider>(
  provider: P,
  credentials: ProviderCredentials[NoInfer<P>],
  change: ProviderChange,
  company: string,
): EnrollCertRequest {
  requireProvider(provider);
  providerChangeHeaders(change);
  const bundle: Record<string, unknown> = {
    ...credentials,
    SchemaVersion: 1,
    ExpectedVersion: change.expectedVersion,
    ChangeId: change.idempotencyKey,
  };
  const identityField = provider === "maventa" ? "CompanyUuid" : "ClientId";
  const identity = bundle[identityField];
  if (typeof identity !== "string" || identity.length === 0)
    throw new ISecureError("Provider enrollment identity is required");
  if (provider === "maventa") delete bundle.CompanyUuid;
  else delete bundle.ClientId;
  return { Company: company, WsUserId: identity, Code: JSON.stringify(bundle) };
}
