import type { CredentialProvider, Mode, TransportRequest } from "../../src/index.js";

const TARGETS = new Set([
  "https://ws-api.test.isecure.fi/v2",
  "https://5v82uu7087.execute-api.eu-west-1.amazonaws.com/gpgtest",
  "https://gky0hkiw7k.execute-api.eu-west-1.amazonaws.com/rc",
]);
export function validateTarget(baseUrl: string): void {
  if (!TARGETS.has(baseUrl)) throw new Error("Provider qualification target is not admitted");
}
export interface RequestScope {
  baseUrl: string;
  provider: CredentialProvider;
  email: string;
  mode: Mode;
  lifecycle: boolean;
}
export function assertProviderRequest(scope: RequestScope, request: TransportRequest): void {
  validateTarget(scope.baseUrl);
  const root = scope.baseUrl + "/";
  if (!request.url.startsWith(root)) throw new Error("Provider qualification request refused");
  const path = request.url.slice(scope.baseUrl.length);
  const session = `/session/${encodeURIComponent(scope.email)}/${scope.mode}`;
  const auth =
    (path === session && ["GET", "POST", "DELETE"].includes(request.method)) ||
    ([session + "/mfacode", session + "/selectmfa"].includes(path) && request.method === "PUT");
  const provider = `/providers/${scope.provider}`;
  const files = `/files/${scope.provider}`;
  const download = path.startsWith(files + "/") && path.split("/").length === 5 && !/[?#]/u.test(path);
  const read =
    request.method === "GET" &&
    (path === "/certs" ||
      path === files ||
      download ||
      path === provider + "/check" ||
      (scope.mode === "admin" && path === provider + "/connection"));
  const write =
    scope.lifecycle &&
    scope.mode === "admin" &&
    ((path === provider + "/connection" && ["PUT", "DELETE"].includes(request.method)) ||
      (path === `/certs/${scope.provider}` && request.method === "POST"));
  if (!auth && !read && !write) throw new Error("Provider qualification request refused");
}
