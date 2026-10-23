/* global process, console */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.env.ISECURE_WSAPI_ROOT || resolve(root, "../aws/ws-channel-api"), "provider-api.json");
const target = resolve(root, "provider-api.json");
const lock = resolve(root, "provider-contract.lock.json");
const bytes = readFileSync(source);
const metadata = {
  schemaVersion: 1,
  repository: "aws",
  source: "ws-channel-api/provider-api.json",
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
if (process.argv.includes("--write")) {
  writeFileSync(target, bytes);
  writeFileSync(lock, JSON.stringify(metadata, null, 2) + "\n");
} else if (
  !readFileSync(target).equals(bytes) ||
  JSON.stringify(JSON.parse(readFileSync(lock, "utf8"))) !== JSON.stringify(metadata)
) {
  throw new Error("Provider contract differs from its owning backend export");
}
console.log("Provider contract synchronized and digest verified");
