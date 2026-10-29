/* global process, console */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function syncFileContract(name) {
  if (!["provider", "transfer"].includes(name)) throw new Error("Unknown API contract");
  const filename = `${name}-api.json`;
  const source = resolve(process.env.ISECURE_WSAPI_ROOT || resolve(root, "../aws/ws-channel-api"), filename);
  const target = resolve(root, filename);
  const lock = resolve(root, `${name}-contract.lock.json`);
  const bytes = readFileSync(source);
  const metadata = {
    schemaVersion: 1,
    repository: "aws",
    source: `ws-channel-api/${filename}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  if (process.argv.includes("--write")) {
    writeFileSync(target, bytes);
    writeFileSync(lock, JSON.stringify(metadata, null, 2) + "\n");
  } else if (
    !readFileSync(target).equals(bytes) ||
    JSON.stringify(JSON.parse(readFileSync(lock, "utf8"))) !== JSON.stringify(metadata)
  ) {
    throw new Error(`${name} contract differs from its owning backend export`);
  }
  console.log(`${name} contract synchronized and digest verified`);
}
