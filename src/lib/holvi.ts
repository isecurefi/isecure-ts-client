import type { components } from "../generated/provider-api.js";
import { ISecureError } from "./errors.js";
import type { HttpHeaders } from "./transport.js";

type Schemas = components["schemas"];
/** Admin-only Holvi SFTP connection projection. Never contains private key material. */
export type HolviConnection = Schemas["GetHolviConnectionResp"];
/** Result of authenticating to Holvi with the registered key; ResponseCode 30 means not registered. */
export type HolviConnectionCheck = Schemas["CheckHolviConnectionResp"];

/** Version of a connection that does not exist yet. */
export const ABSENT_HOLVI_VERSION = "absent";
const VERSION = /^(absent|[0-9a-f]{32})$/u;
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

/** Exact optimistic-concurrency header for Holvi connection changes. */
export function holviVersionHeaders(expectedVersion: string): HttpHeaders {
  if (!VERSION.test(expectedVersion)) throw new ISecureError("Holvi changes require the current connection Version");
  return { "If-Match": `"${expectedVersion}"` };
}

/** Holvi-assigned SFTP login (`<client id><client number>`). */
export function requireHolviLogin(sftpUser: string): string {
  if (!LOGIN.test(sftpUser)) throw new ISecureError("Invalid Holvi SFTP login");
  return sftpUser;
}
