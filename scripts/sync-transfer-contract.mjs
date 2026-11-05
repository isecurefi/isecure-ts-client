/* global process, console */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.ISECURE_WSAPI_ROOT || resolve(root, "../aws/ws-channel-api");
const template = readFileSync(resolve(source, "__wsapi.json.tmpl"), "utf8");
// The owning definition contains no template expansions. Read only this JSON object.
const start = template.indexOf('"FileTransferCapability": ') + '"FileTransferCapability": '.length;
const end = template.indexOf('\n    "BankConnectionDescriptor":', start);
if (start < 30 || end < start) throw new Error("Missing owning transfer definition");
const definition = JSON.parse(template.slice(start, end).trim().replace(/,$/, ""));
const config = JSON.parse(readFileSync(resolve(source, "config.json"), "utf8"));
const method = config.paths.flatMap((path) => path.methods).find((item) => item.summary === "ListCerts");
const ref = method.responseparams.refs.find((item) => item.refname === "FileTransferCapabilities");
if (!ref?.optional || ref.items !== "#/definitions/FileTransferCapability")
  throw new Error("Invalid capability discovery contract");
const specPath = resolve(root, "wsapi_v2.json");
const spec = JSON.parse(readFileSync(specPath, "utf8"));
spec.definitions.FileTransferCapability = definition;
spec.definitions.ListCertsResp.example.FileTransferCapabilities = [];
spec.definitions.ListCertsResp.properties.FileTransferCapabilities = {
  description: ref.param_description,
  type: "array",
  items: { $ref: ref.items },
  maxItems: ref.maxItems,
};
// Additive Holvi SFTP key listing; the descriptor is likewise a plain JSON object.
const sftpStart = template.indexOf('"SftpKeyDescriptor": ') + '"SftpKeyDescriptor": '.length;
const sftpEnd = template.indexOf('\n    "FileDescriptor":', sftpStart);
if (sftpStart < 30 || sftpEnd < sftpStart) throw new Error("Missing owning SFTP key definition");
const sftpDefinition = JSON.parse(template.slice(sftpStart, sftpEnd).trim().replace(/,$/, ""));
const sftpRef = method.responseparams.refs.find((item) => item.refname === "SftpKeys");
if (!sftpRef?.optional || sftpRef.items !== "#/definitions/SftpKeyDescriptor")
  throw new Error("Invalid SFTP key listing contract");
spec.definitions.SftpKeyDescriptor = sftpDefinition;
spec.definitions.ListCertsResp.example.SftpKeys = [];
spec.definitions.ListCertsResp.properties.SftpKeys = {
  description: sftpRef.param_description,
  type: "array",
  items: { $ref: sftpRef.items },
};
const bytes =
  JSON.stringify(spec, null, 2).replace(
    /[\u0080-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  ) + "\n";
const metadataPath = resolve(root, "wsapi_v2.source.json");
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
metadata.sha256 = createHash("sha256").update(bytes).digest("hex");
metadata.transferOverlay = {
  repository: "https://github.com/isecurefi/aws",
  paths: ["ws-channel-api/config.json", "ws-channel-api/__wsapi.json.tmpl"],
  definitionSha256: createHash("sha256").update(JSON.stringify({ definition, ref })).digest("hex"),
  description:
    "Unpublished additive metadata contract. No transfer capability activation or large-file support implied.",
};
metadata.sftpKeyOverlay = {
  repository: "https://github.com/isecurefi/aws",
  paths: ["ws-channel-api/config.json", "ws-channel-api/__wsapi.json.tmpl"],
  definitionSha256: createHash("sha256")
    .update(JSON.stringify({ definition: sftpDefinition, ref: sftpRef }))
    .digest("hex"),
  description:
    "Unpublished additive ListCerts SftpKeys listing (Holvi SFTP public keys). No Holvi availability implied.",
};
if (process.argv.includes("--write")) {
  writeFileSync(specPath, bytes);
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
} else if (
  readFileSync(specPath, "utf8") !== bytes ||
  JSON.stringify(JSON.parse(readFileSync(metadataPath, "utf8"))) !== JSON.stringify(metadata)
) {
  throw new Error("Transfer contract differs from its owning backend source; run sync:transfer-contract");
}
console.log("Transfer overlay synchronized and source digest verified");
