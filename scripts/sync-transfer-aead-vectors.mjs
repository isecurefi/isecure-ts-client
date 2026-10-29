/* global process, console */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  process.env.ISECURE_WSAPI_ROOT || resolve(root, "../aws/ws-channel-api"),
  "wsapi-transfer/tests/fixtures/s3-aead-v1",
);
const target = resolve(root, "test-vectors/s3-aead-v1");
const manifest = JSON.parse(readFileSync(resolve(source, "manifest.json"), "utf8"));
const vectors = readFileSync(resolve(source, "vectors.json"));
if (createHash("sha256").update(vectors).digest("hex") !== manifest.fixtureSha256)
  throw new Error("Owning AEAD vector hash mismatch");
for (const name of ["vectors.json", "schema.json", "manifest.json"]) {
  const expected = readFileSync(resolve(source, name));
  if (process.argv.includes("--write")) {
    mkdirSync(target, { recursive: true });
    writeFileSync(resolve(target, name), expected);
  } else if (!readFileSync(resolve(target, name)).equals(expected)) {
    throw new Error("AEAD vectors differ from owning backend fixtures");
  }
}
console.log("Shared AEAD vectors and provenance match the owning backend");
