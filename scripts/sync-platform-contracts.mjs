/* global console, process */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = resolve(repositoryRoot, "src/generated/iso20022-observations.ts");
const generatedMockPath = resolve(repositoryRoot, "test-data/generated/iso20022-observation-scenarios.json");
const lockPath = resolve(repositoryRoot, "platform-contracts.lock.json");
const sourcePaths = {
  client: "generated/typescript/processing-client.ts",
  openApi: "generated/processing/openapi.json",
  mock: "generated/mock/processing-scenarios.json",
};
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const operationIds = [
  "balances.explain",
  "balances.get",
  "balances.list",
  "entries.explain",
  "entries.get",
  "entries.list",
  "statements.explain",
  "statements.get",
  "statements.list",
  "transactions.explain",
  "transactions.get",
  "transactions.list",
  "validations.explain",
  "validations.get",
  "validations.list",
];

const arguments_ = process.argv.slice(2);
const mode = arguments_.includes("--write") ? "write" : arguments_.includes("--check") ? "check" : undefined;
if (mode === undefined || (arguments_.includes("--write") && arguments_.includes("--check"))) {
  throw new Error("usage: node scripts/sync-platform-contracts.mjs (--write|--check) [--source <path>]");
}
const sourceIndex = arguments_.indexOf("--source");
const platformRoot = resolve(
  sourceIndex === -1 ? resolve(repositoryRoot, "../bankfiles-platform") : requireArgument(arguments_, sourceIndex + 1),
);
const sourceRevision =
  mode === "write"
    ? execFileSync("git", ["-C", platformRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
    : JSON.parse(await readFile(lockPath, "utf8")).source.revision;
requireRevision(sourceRevision);
const [sourceClient, sourceOpenApiText, sourceMockText] = [
  sourcePaths.client,
  sourcePaths.openApi,
  sourcePaths.mock,
].map((path) => readCommittedSource(platformRoot, sourceRevision, path));
const sourceOpenApi = JSON.parse(sourceOpenApiText);
const sourceMock = JSON.parse(sourceMockText);
const generated = generateContract(sourceClient, sourceOpenApi, sourceRevision);
const generatedMock = generateMock(sourceMock, sourceRevision);
const lock = createLock(sourceClient, sourceOpenApiText, sourceMockText, sourceRevision, generated, generatedMock);

if (mode === "write") {
  await mkdir(dirname(generatedMockPath), { recursive: true });
  await Promise.all([
    writeFile(generatedPath, generated, "utf8"),
    writeFile(generatedMockPath, generatedMock, "utf8"),
    writeFile(lockPath, `${JSON.stringify(lock, undefined, 2)}\n`, "utf8"),
  ]);
  console.log(`Synchronized ${operationIds.length} observation operations from ${sourceRevision}.`);
} else {
  const [actualGenerated, actualMock, actualLock] = await Promise.all([
    readFile(generatedPath, "utf8"),
    readFile(generatedMockPath, "utf8"),
    readFile(lockPath, "utf8"),
  ]);
  if (
    actualGenerated !== generated ||
    actualMock !== generatedMock ||
    actualLock !== `${JSON.stringify(lock, undefined, 2)}\n`
  ) {
    throw new Error("platform contract snapshot drifted; run npm run sync:platform-contracts");
  }
  console.log(`Verified ${operationIds.length} observation operations against ${sourceRevision}.`);
}

function requireArgument(values, index) {
  const value = values[index];
  if (value === undefined || value.startsWith("--")) throw new Error("--source requires a path");
  return value;
}

function requireRevision(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error("platform contract revision must be a full Git object ID");
  }
}

function readCommittedSource(root, revision, path) {
  return execFileSync("git", ["-C", root, "show", `${revision}:${path}`], {
    encoding: "utf8",
    maxBuffer: MAX_SOURCE_BYTES,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createLock(sourceClient, sourceOpenApi, sourceMock, revision, generated, generatedMock) {
  return {
    schemaVersion: 1,
    source: {
      repository: "isecurefi/bankfiles-platform",
      revision,
      processingClientSha256: sha256(sourceClient),
      processingOpenApiSha256: sha256(sourceOpenApi),
      processingMockSha256: sha256(sourceMock),
    },
    generated: {
      path: "src/generated/iso20022-observations.ts",
      sha256: sha256(generated),
      operationIds,
    },
    generatedMock: {
      path: "test-data/generated/iso20022-observation-scenarios.json",
      sha256: sha256(generatedMock),
    },
  };
}

function generateMock(sourceMock, revision) {
  const operations = sourceMock.operations?.filter((operation) => operationIds.includes(operation.operationId));
  if (!Array.isArray(operations) || operations.length !== operationIds.length) {
    throw new Error("generated processing mock does not contain every observation operation exactly once");
  }
  const actualOperationIds = operations.map((operation) => operation.operationId);
  if (JSON.stringify(actualOperationIds) !== JSON.stringify(operationIds)) {
    throw new Error("generated processing mock observation order drifted from the client surface");
  }
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      source: {
        repository: "isecurefi/bankfiles-platform",
        revision,
        model: sourceMock.model,
        sourceDigest: sourceMock.sourceDigest,
        fixedClock: sourceMock.fixedClock,
        safety: sourceMock.safety,
      },
      operations,
    },
    undefined,
    2,
  )}\n`;
}

function generateContract(sourceText, openApi, revision) {
  const sourceFile = ts.createSourceFile("processing-client.ts", sourceText, ts.ScriptTarget.Latest, true);
  const declarations = new Map();
  for (const statement of sourceFile.statements) {
    if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      declarations.set(statement.name.text, statement);
    }
  }

  const roots = new Set(["ProcessingRequestMetadata"]);
  const operations = {};
  for (const operationId of operationIds) {
    const binding = findOperation(openApi, operationId);
    const contract = binding.operation["x-isecure-operation"];
    if (contract === undefined || typeof contract !== "object") {
      throw new Error(`${operationId} has no x-isecure-operation contract`);
    }
    for (const qualifiedName of [contract.input, contract.result, contract.issues]) {
      roots.add(requireContractName(qualifiedName, operationId));
    }
    const parameters = (binding.operation.parameters ?? [])
      .filter((parameter) => parameter.in === "path" || parameter.in === "query")
      .map((parameter) => ({
        name: parameter.name,
        location: parameter.in,
        inputField: requireInputField(parameter["x-isecure-contract-field"], operationId),
        required: parameter.required === true,
      }));
    const placeholders = [...binding.path.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1]);
    const pathParameters = parameters
      .filter((parameter) => parameter.location === "path")
      .map((parameter) => parameter.name);
    if (JSON.stringify(placeholders) !== JSON.stringify(pathParameters)) {
      throw new Error(`${operationId} path placeholders do not match its generated parameter binding`);
    }
    operations[operationId] = {
      method: binding.method.toUpperCase(),
      path: binding.path,
      version: contract.version,
      contractDigest: contract.contractDigest,
      input: contract.input,
      result: contract.result,
      issues: contract.issues,
      parameters,
    };
  }

  const selected = closeDeclarations(roots, declarations);
  const declarationText = [...selected]
    .sort((left, right) => left.getStart(sourceFile) - right.getStart(sourceFile))
    .map((node) => node.getFullText(sourceFile).trim())
    .join("\n\n");
  const model = requireHeader(sourceText, /^\/\/ model: (.+)$/mu, "model");
  const sourceDigest = requireHeader(sourceText, /^\/\/ source-digest: (.+)$/mu, "source digest");

  return `// GENERATED FILE: DO NOT EDIT.\n// source: isecurefi/bankfiles-platform@${revision}\n// model: ${model}\n// source-digest: ${sourceDigest}\n// Exact decimals and 64-bit integers are JSON decimal strings.\n\n${declarationText}\n\nexport const iso20022ObservationOperations = ${JSON.stringify(operations, undefined, 2)} as const;\n\nexport type Iso20022ObservationOperationId = keyof typeof iso20022ObservationOperations;\n`;
}

function findOperation(openApi, operationId) {
  const matches = [];
  for (const [path, pathItem] of Object.entries(openApi.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (operation?.operationId === operationId) matches.push({ method, path, operation });
    }
  }
  if (matches.length !== 1) throw new Error(`${operationId} must have exactly one REST binding`);
  return matches[0];
}

function requireContractName(value, operationId) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${operationId} contract name is missing`);
  return value.slice(value.lastIndexOf(".") + 1);
}

function requireInputField(value, operationId) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${operationId} parameter field is missing`);
  return value.slice(value.lastIndexOf(".") + 1);
}

function requireHeader(source, pattern, label) {
  const value = pattern.exec(source)?.[1];
  if (value === undefined) throw new Error(`generated processing client ${label} is missing`);
  return value;
}

function closeDeclarations(roots, declarations) {
  const selected = new Set();
  const pending = [...roots];
  while (pending.length > 0) {
    const name = pending.pop();
    const declaration = declarations.get(name);
    if (declaration === undefined) throw new Error(`generated processing declaration ${name} is missing`);
    if (selected.has(declaration)) continue;
    selected.add(declaration);
    const references = new Set();
    visitTypeNames(declaration, references);
    for (const reference of references) {
      if (declarations.has(reference)) pending.push(reference);
    }
  }
  return selected;
}

function visitTypeNames(node, references) {
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) references.add(node.typeName.text);
  if (ts.isExpressionWithTypeArguments(node) && ts.isIdentifier(node.expression)) references.add(node.expression.text);
  ts.forEachChild(node, (child) => visitTypeNames(child, references));
}
