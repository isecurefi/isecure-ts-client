import { describe, expect, it } from "vitest";
import { assertProviderRequest, validateTarget } from "./policy.js";
const base = "https://gky0hkiw7k.execute-api.eu-west-1.amazonaws.com/rc";
const scope = {
  baseUrl: base,
  provider: "mobilepay" as const,
  email: "synthetic@example.com",
  mode: "data" as const,
  lifecycle: false,
};
describe("provider qualification boundary", () => {
  it("admits only the named test and RC targets", () => {
    expect(() => {
      validateTarget(base);
    }).not.toThrow();
    expect(() => {
      validateTarget("https://ws-api.test.isecure.fi/v2");
    }).not.toThrow();
    for (const url of [
      "https://ws-api.isecure.fi/v2",
      base + "/",
      base + "?x=1",
      "http://ws-api.test.isecure.fi/v2",
      base.replace("/rc", "/v2"),
    ])
      expect(() => {
        validateTarget(url);
      }).toThrow();
  });
  it("allows provider reads and the selected account login only", () => {
    for (const path of [
      "/providers/mobilepay/check",
      "/certs",
      "/files/mobilepay",
      "/files/mobilepay/MOBILEPAY_FUNDS_JSON_V1/synthetic",
    ])
      expect(() => {
        assertProviderRequest(scope, { method: "GET", url: base + path });
      }).not.toThrow();
    expect(() => {
      assertProviderRequest(scope, { method: "POST", url: base + "/session/synthetic%40example.com/data" });
    }).not.toThrow();
  });
  it("refuses banks, unrelated accounts/providers, uploads, live URLs and read-only credential changes", () => {
    for (const [method, path] of [
      ["GET", "/files/nordea"],
      ["GET", "/providers/maventa/check"],
      ["DELETE", "/files/mobilepay/x/y"],
      ["PUT", "/providers/mobilepay/connection"],
      ["POST", "/certs/mobilepay"],
      ["PUT", "/account/synthetic%40example.com/data"],
      ["POST", "/session/foreign%40example.com/data"],
    ] as const)
      expect(() => {
        assertProviderRequest(scope, { method, url: base + path });
      }).toThrow();
    expect(() => {
      assertProviderRequest(scope, { method: "GET", url: "https://ws-api.isecure.fi/v2/files/mobilepay" });
    }).toThrow();
  });
  it("admits enrollment/update/disable only in explicit admin lifecycle mode", () => {
    for (const [method, path] of [
      ["POST", "/certs/mobilepay"],
      ["PUT", "/providers/mobilepay/connection"],
      ["DELETE", "/providers/mobilepay/connection"],
    ] as const) {
      expect(() => {
        assertProviderRequest({ ...scope, mode: "admin", lifecycle: true }, { method, url: base + path });
      }).not.toThrow();
      expect(() => {
        assertProviderRequest({ ...scope, lifecycle: true }, { method, url: base + path });
      }).toThrow();
    }
  });
});
