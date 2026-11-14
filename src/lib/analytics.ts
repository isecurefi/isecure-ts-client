import { ISecureAbortError, ISecureError, ISecureNetworkError } from "./errors.js";

/** Optional tenant selection. The server decides which tenant data the caller may read. */
export interface AnalyticsAccessQuery {
  Tenant?: string;
}

export type AnalyticsTier = "detail" | "long-term";

/** One analytics Parquet file the current access can read. */
export interface AnalyticsFile {
  readonly key: string;
  readonly bytes: number;
  readonly tier: AnalyticsTier;
  /** Pseudonymous tenant analytics identifier; absent for a file that is not tenant-partitioned. */
  readonly tenant: string | undefined;
  /** `YYYY-MM-DD` for detail files, `YYYY-MM` for long-term files. */
  readonly period: string;
}

export interface AnalyticsRequestOptions {
  signal?: AbortSignal;
}

export interface AnalyticsEffects {
  /** Byte-capable fetch for storage requests, for example a native HTTP client. */
  fetch?: typeof fetch;
  now?: () => number;
}

const REGION = "eu-west-1";
const SCOPE = "schema_version=1\\/environment=[a-z0-9-]{1,32}\\/service=[a-z0-9-]{1,64}\\/";
const TENANT = "ta1\\.[A-Za-z0-9._-]{1,128}";
const BUCKET = /^isecure-analytics-[a-z0-9-]{1,45}$/;
const PREFIX = new RegExp(`^compacted\\/(?:detail|long-term)\\/${SCOPE}(?:tenant=${TENANT}\\/)?$`);
const KEY = new RegExp(
  `^compacted\\/(detail|long-term)\\/${SCOPE}(?:tenant=(${TENANT})|internal)\\/` +
    `(?:batch_date=(\\d{4}-\\d{2}-\\d{2})|month=(\\d{4}-\\d{2}))\\/data\\.parquet$`,
);
const HEADER_VALUE = /^[\x21-\x7e]+$/;
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const MAX_SESSION_MS = 60 * 60 * 1000;
const MAX_OBJECT_BYTES = 64 * 1024 * 1024;
const MAX_LISTING_BYTES = 4 * 1024 * 1024;
// ponytail: 25 pages of 1,000 keys per prefix; raise when a listing legitimately exceeds it.
const MAX_PAGES = 25;

interface Grant {
  readonly bucket: string;
  readonly prefixes: readonly string[];
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken: string;
  readonly expiresAt: number;
}

function invalid(): ISecureError {
  return new ISecureError("Invalid analytics access response");
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || !HEADER_VALUE.test(value))
    throw invalid();
  return value;
}

/** Strict parse of an untrusted response, so signed requests can only reach the analytics bucket. */
function parseGrant(value: unknown, now: number): Grant {
  if (value === null || typeof value !== "object") throw invalid();
  const wire = (value as Record<string, unknown>).AnalyticsAccess;
  if (wire === null || typeof wire !== "object") throw invalid();
  const { Bucket, Region, Prefixes, AccessKeyId, SecretAccessKey, SessionToken, Expiration } = wire as Record<
    string,
    unknown
  >;
  if (typeof Bucket !== "string" || !BUCKET.test(Bucket) || Region !== REGION) throw invalid();
  if (
    !Array.isArray(Prefixes) ||
    Prefixes.length < 1 ||
    Prefixes.length > 8 ||
    !Prefixes.every((prefix): prefix is string => typeof prefix === "string" && PREFIX.test(prefix))
  )
    throw invalid();
  const expiresAt = typeof Expiration === "string" ? Date.parse(Expiration) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt - now > MAX_SESSION_MS) throw invalid();
  return {
    bucket: Bucket,
    prefixes: Object.freeze([...new Set(Prefixes)]),
    accessKeyId: text(AccessKeyId, 128),
    secretAccessKey: text(SecretAccessKey, 256),
    sessionToken: text(SessionToken, 4096),
    expiresAt,
  };
}

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, message: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, encoder.encode(message));
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export interface SignedGet {
  readonly url: string;
  readonly headers: Record<string, string>;
}

/** AWS Signature Version 4 for a body-less S3 GET. Exported for the published test vectors only. */
export async function signS3Get(request: {
  host: string;
  /** Unencoded object key, or empty for a bucket request. */
  key: string;
  query: Readonly<Record<string, string>>;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  now: number;
}): Promise<SignedGet> {
  const stamp = new Date(request.now).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = stamp.slice(0, 8);
  const path = `/${request.key.split("/").map(encode).join("/")}`;
  const query = Object.entries(request.query)
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .sort()
    .join("&");
  const headers: Record<string, string> = {
    host: request.host,
    "x-amz-content-sha256": EMPTY_SHA256,
    "x-amz-date": stamp,
    ...(request.sessionToken === undefined ? {} : { "x-amz-security-token": request.sessionToken }),
  };
  const names = Object.keys(headers).sort();
  const canonical = [
    "GET",
    path,
    query,
    ...names.map((name) => `${name}:${headers[name] ?? ""}`),
    "",
    names.join(";"),
    EMPTY_SHA256,
  ].join("\n");
  const scope = `${date}/${request.region}/s3/aws4_request`;
  const toSign = [
    "AWS4-HMAC-SHA256",
    stamp,
    scope,
    hex(await crypto.subtle.digest("SHA-256", encoder.encode(canonical))),
  ].join("\n");
  let key = await hmac(encoder.encode(`AWS4${request.secretAccessKey}`), date);
  for (const part of [request.region, "s3", "aws4_request"]) key = await hmac(key, part);
  const signature = hex(await hmac(key, toSign));
  return {
    url: `https://${request.host}${path}${query === "" ? "" : `?${query}`}`,
    headers: {
      // The HTTP client sets Host itself; it is signed, not sent.
      ...Object.fromEntries(Object.entries(headers).filter(([name]) => name !== "host")),
      Authorization: `AWS4-HMAC-SHA256 Credential=${request.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`,
    },
  };
}

function fileOf(key: string, bytes: number): AnalyticsFile | undefined {
  const match = KEY.exec(key);
  if (match === null) return undefined;
  const [, tier, tenant, day, month] = match;
  // A detail file is a day and a long-term file is a month; anything else is not ours.
  const period = tier === "detail" ? day : month;
  // Only daily files exist outside the tenant partitions.
  if (period === undefined || (tenant === undefined && tier !== "detail")) return undefined;
  return Object.freeze({ key, bytes, tier: tier as AnalyticsTier, tenant, period });
}

/**
 * Short-lived read access to the caller's analytics files. The temporary storage
 * credentials stay inside this object: it is not serializable and exposes only
 * file names and bytes. Request a new reader after `expiresAt`.
 */
export class AnalyticsReader {
  readonly #grant: Grant;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  /** Epoch milliseconds after which every request is refused. */
  readonly expiresAt: number;
  /** Key prefixes this access may list and read. */
  readonly prefixes: readonly string[];

  constructor(response: unknown, effects: AnalyticsEffects = {}) {
    this.#now = effects.now ?? Date.now;
    this.#fetch = effects.fetch ?? fetch;
    this.#grant = parseGrant(response, this.#now());
    this.expiresAt = this.#grant.expiresAt;
    this.prefixes = this.#grant.prefixes;
    Object.freeze(this);
  }

  toJSON(): string {
    return "<redacted analytics access>";
  }

  /** Files under the granted prefixes, optionally one tier only, sorted by key. */
  async list(options: AnalyticsRequestOptions & { tier?: AnalyticsTier } = {}): Promise<AnalyticsFile[]> {
    const files: AnalyticsFile[] = [];
    for (const prefix of this.prefixes) {
      if (options.tier !== undefined && !prefix.startsWith(`compacted/${options.tier}/`)) continue;
      let token: string | undefined;
      for (let page = 0; ; page += 1) {
        if (page === MAX_PAGES) throw new ISecureError("Analytics listing is too large");
        const response = await this.#get(
          "",
          { "list-type": "2", prefix, ...(token === undefined ? {} : { "continuation-token": token }) },
          options.signal,
        );
        const body = new TextDecoder().decode(await this.#body(response, MAX_LISTING_BYTES));
        for (const [, entry = ""] of body.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = /<Key>([^<]*)<\/Key>/.exec(entry)?.[1];
          const size = /<Size>(\d{1,15})<\/Size>/.exec(entry)?.[1];
          if (key === undefined || size === undefined || !key.startsWith(prefix)) continue;
          const file = fileOf(key, Number(size));
          if (file !== undefined) files.push(file);
        }
        if (!body.includes("<IsTruncated>true</IsTruncated>")) break;
        token = /<NextContinuationToken>([^<&]+)<\/NextContinuationToken>/.exec(body)?.[1];
        if (token === undefined) throw new ISecureError("Analytics storage returned an invalid listing");
      }
    }
    return files.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  }

  /** The exact bytes of one listed file. */
  async read(file: AnalyticsFile, options: AnalyticsRequestOptions = {}): Promise<Uint8Array> {
    const listed = fileOf(file.key, file.bytes);
    if (
      listed === undefined ||
      !this.prefixes.some((prefix) => file.key.startsWith(prefix)) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      file.bytes > MAX_OBJECT_BYTES
    )
      throw new ISecureError("Analytics file is outside this access");
    const bytes = await this.#body(await this.#get(file.key, {}, options.signal), file.bytes);
    // A file replaced since the listing is a different file: list again.
    if (bytes.length !== file.bytes) throw new ISecureError("Analytics file changed since it was listed");
    return bytes;
  }

  async #get(key: string, query: Record<string, string>, signal: AbortSignal | undefined): Promise<Response> {
    const now = this.#now();
    if (now >= this.expiresAt) throw new ISecureError("Analytics access has expired");
    const signed = await signS3Get({
      host: `${this.#grant.bucket}.s3.${REGION}.amazonaws.com`,
      key,
      query,
      region: REGION,
      accessKeyId: this.#grant.accessKeyId,
      secretAccessKey: this.#grant.secretAccessKey,
      sessionToken: this.#grant.sessionToken,
      now,
    });
    let response: Response;
    try {
      response = await this.#fetch(signed.url, {
        method: "GET",
        headers: signed.headers,
        ...(signal === undefined ? {} : { signal }),
      });
    } catch {
      // Do not retain the cause: it may echo the request.
      if (signal?.aborted === true) throw new ISecureAbortError();
      throw new ISecureNetworkError("Analytics storage request failed");
    }
    if (response.status !== 200)
      throw new ISecureError(`Analytics storage refused the request (status ${String(response.status)})`);
    return response;
  }

  async #body(response: Response, max: number): Promise<Uint8Array> {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > max) throw new ISecureError("Analytics storage response is too large");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new ISecureNetworkError("Analytics storage request failed");
    }
    if (bytes.length > max) throw new ISecureError("Analytics storage response is too large");
    return bytes;
  }
}
