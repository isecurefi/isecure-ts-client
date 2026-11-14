import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standalone from "ajv/dist/standalone/index.js";
import { rolldown } from "rolldown";
import { URL } from "node:url";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

/** Compile only reachable response schemas from the pinned OpenAPI, never a handwritten copy. */
export async function generateResponseValidators(openApi, operationIds, revision) {
  const roots = {};
  for (const item of Object.values(openApi.paths)) {
    for (const operation of Object.values(item)) {
      if (!operationIds.includes(operation?.operationId)) continue;
      const responses = Object.entries(operation.responses).filter(([status]) => /^2\d\d$/u.test(status));
      for (const [, response] of responses) {
        const schema = response.content?.["application/json"]?.schema;
        if (schema !== undefined) roots[operation.operationId] = schema;
      }
    }
  }
  const schemas = {};
  function visit(schema) {
    if (Array.isArray(schema)) return schema.map(visit);
    if (schema === null || typeof schema !== "object") return schema;
    const result = {};
    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith("x-") || key === "description" || key === "title") continue;
      if (key === "$ref") {
        const prefix = "#/components/schemas/";
        if (!value.startsWith(prefix)) throw new Error("Response schema has a non-local reference");
        const name = value.slice(prefix.length);
        if (!(name in schemas)) {
          if (!openApi.components.schemas[name]) throw new Error("Response schema reference is missing");
          schemas[name] = {};
          schemas[name] = visit(openApi.components.schemas[name]);
        }
        result[key] = `#/$defs/${name}`;
      } else if (key === "properties") {
        result[key] = Object.fromEntries(Object.entries(value).map(([name, field]) => [name, visit(field)]));
      } else {
        result[key] = visit(value);
      }
    }
    return result;
  }
  const references = Object.fromEntries(Object.entries(roots).map(([id, schema]) => [id, visit(schema)]));
  const ajv = new Ajv({ strict: false, inlineRefs: false, messages: false, code: { source: true, esm: true } });
  addFormats(ajv);
  ajv.addSchema({ $id: "processing-responses", $defs: schemas });
  const exports = {};
  const entries = [];
  const names = new Map();
  for (const [index, [id, schema]] of Object.entries(references).entries()) {
    const name = names.get(schema.$ref) ?? `response${index}`;
    names.set(schema.$ref, name);
    exports[name] = `processing-responses${schema.$ref}`;
    entries.push(`${JSON.stringify(id)}: ${name}`);
  }
  for (const reference of Object.values(exports)) ajv.getSchema(reference);
  const source =
    standalone(ajv, exports).replaceAll("export const ", "const ") +
    `\nexport const responseValidators = {${entries.join(",")}};\n`;
  // Bundle Ajv's small format/Unicode helpers at generation time: no runtime compiler, eval or dependencies.
  const input = resolve(".generated/processing-response-validators.mjs");
  const bundle = await rolldown({
    input,
    plugins: [
      {
        name: "generated-response-validators",
        resolveId: (id) => (id === input ? id : undefined),
        load: (id) => (id === input ? source : undefined),
      },
    ],
  });
  try {
    const { output } = await bundle.generate({ format: "esm", minify: { mangle: false, compress: false } });
    if (output.length !== 1 || output[0].type !== "chunk" || output[0].imports.length !== 0)
      throw new Error("Response validators must be a self-contained module");
    const licenses = await Promise.all(
      ["ajv", "ajv-formats", "rolldown"].map(
        async (name) =>
          `${name}\n${await readFile(new URL(`../node_modules/${name}/LICENSE`, import.meta.url), "utf8")}`,
      ),
    );
    return (
      `// @ts-nocheck\n// GENERATED FILE: DO NOT EDIT.\n// source: isecurefi/bankfiles-platform@${revision}\n/*! Bundled helper licenses:\n${licenses.join("\n")}\n*/\n` +
      output[0].code +
      `\nexport function isProcessingResult(operationId: string, value: unknown): boolean {\n` +
      `  const validate = responseValidators[operationId];\n` +
      `  return validate !== undefined && validate(value);\n}\n`
    );
  } finally {
    await bundle.close();
  }
}
