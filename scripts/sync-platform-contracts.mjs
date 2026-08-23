/* global console, process */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = resolve(repositoryRoot, "src/generated/iso20022-contracts.ts");
const generatedMockPath = resolve(repositoryRoot, "test-data/generated/iso20022-scenarios.json");
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
  "payment_approval_requests.decide",
  "payment_capabilities.explain",
  "payment_capabilities.get",
  "payment_capabilities.list",
  "payment_capabilities.resolve",
  "payment_execution_attempts.explain",
  "payment_execution_attempts.get",
  "payment_execution_attempts.list",
  "payment_execution_fulfillments.claim",
  "payment_execution_observations.report",
  "payment_export_profile_catalog.list",
  "payment_export_profiles.configure",
  "payment_export_profiles.get",
  "payment_export_profiles.revoke",
  "payment_exports.download_content",
  "payment_exports.get",
  "payment_exports.release",
  "payment_order_outcomes.explain",
  "payment_order_outcomes.get",
  "payment_order_outcomes.list",
  "payment_orders.append_transfers",
  "payment_orders.cancel_draft",
  "payment_orders.correct",
  "payment_orders.create_draft",
  "payment_orders.execute",
  "payment_orders.explain",
  "payment_orders.finalize_draft",
  "payment_orders.get",
  "payment_orders.list",
  "payment_orders.remove_transfers",
  "payment_orders.revise_draft",
  "payment_orders.revise_transfer",
  "payment_orders.simulate",
  "payment_orders.submit_for_review",
  "payment_orders.validate",
  "simulation_artifacts.list",
  "simulation_branches.create",
  "simulation_capabilities.list",
  "simulation_checkpoints.create",
  "simulation_clocks.control",
  "simulation_events.list",
  "simulation_runs.get",
  "simulation_runs.list",
  "simulation_runs.start",
  "simulation_scenarios.create",
  "simulation_scenarios.get",
  "simulation_scenarios.list",
  "simulation_scenarios.revise",
  "simulation_workspaces.activate",
  "simulation_workspaces.close",
  "simulation_workspaces.create",
  "simulation_workspaces.get",
  "simulation_workspaces.list",
  "simulation_workspaces.reset",
  "simulation_workspaces.revise",
  "simulation_workspaces.suspend",
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
  throw new Error(
    "usage: node scripts/sync-platform-contracts.mjs (--write|--check) [--source <path>] [--revision <full-commit>]",
  );
}
const sourceIndex = arguments_.indexOf("--source");
const platformRoot = resolve(sourceIndex === -1 ? defaultPlatformRoot() : requireArgument(arguments_, sourceIndex + 1));
const revisionIndex = arguments_.indexOf("--revision");
const requestedRevision = revisionIndex === -1 ? undefined : requireArgument(arguments_, revisionIndex + 1);
const sourceRevision =
  requestedRevision ??
  (mode === "write"
    ? execFileSync("git", ["-C", platformRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
    : JSON.parse(await readFile(lockPath, "utf8")).source.revision);
requireRevision(sourceRevision);
execFileSync("git", ["-C", platformRoot, "rev-parse", "--verify", `${sourceRevision}^{commit}`], {
  encoding: "utf8",
});
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
  console.log(`Synchronized ${operationIds.length} ISO client operations from ${sourceRevision}.`);
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
  console.log(`Verified ${operationIds.length} ISO client operations against ${sourceRevision}.`);
}

function requireArgument(values, index) {
  const value = values[index];
  if (value === undefined || value.startsWith("--")) throw new Error("--source requires a path");
  return value;
}

function defaultPlatformRoot() {
  const commonGitDirectory = execFileSync(
    "git",
    ["-C", repositoryRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"],
    { encoding: "utf8" },
  ).trim();
  return resolve(dirname(commonGitDirectory), "../bankfiles-platform");
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
      path: "src/generated/iso20022-contracts.ts",
      sha256: sha256(generated),
      operationIds,
    },
    generatedMock: {
      path: "test-data/generated/iso20022-scenarios.json",
      sha256: sha256(generatedMock),
    },
  };
}

function generateMock(sourceMock, revision) {
  requireSyntheticMockSafety(sourceMock.safety);
  const operations = sourceMock.operations?.filter((operation) => operationIds.includes(operation.operationId));
  if (!Array.isArray(operations) || operations.length !== operationIds.length) {
    throw new Error("generated processing mock does not contain every selected client operation exactly once");
  }
  const actualOperationIds = operations.map((operation) => operation.operationId);
  if (JSON.stringify(actualOperationIds) !== JSON.stringify(operationIds)) {
    throw new Error("generated processing mock order drifted from the client surface");
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

  const roots = new Set(["ProcessingCommandOptions", "ProcessingRequestMetadata", "ProcessingRevisionCommandOptions"]);
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
      .map((parameter) => generateParameter(openApi, parameter, operationId));
    const headerParameters = (binding.operation.parameters ?? []).filter((parameter) => parameter.in === "header");
    requireContractVersionHeader(operationId, contract.version, headerParameters);
    const idempotencyKeySchema = requireHeaderSchema(
      operationId,
      contract.idempotency,
      "Idempotency-Key",
      headerParameters,
    );
    const expectedResourceVersionSchema = requireHeaderSchema(
      operationId,
      contract.expectedVersion,
      "If-Match",
      headerParameters,
    );
    const requestBody = requireRequestBodyParity(openApi, binding, contract.input, operationId);
    const successResponse = requireSuccessResponseParity(binding, contract, operationId);
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
      idempotency: contract.idempotency,
      expectedVersion: contract.expectedVersion,
      idempotencyKeySchema,
      expectedResourceVersionSchema,
      requestBody,
      successResponse,
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

  return `// GENERATED FILE: DO NOT EDIT.\n// source: isecurefi/bankfiles-platform@${revision}\n// model: ${model}\n// source-digest: ${sourceDigest}\n// Exact decimals and 64-bit integers are JSON decimal strings.\n\n${declarationText}\n\nexport const iso20022Operations = ${JSON.stringify(operations, undefined, 2)} as const;\n\nexport type Iso20022OperationId = keyof typeof iso20022Operations;\n`;
}

function generateParameter(openApi, parameter, operationId) {
  const style = parameter.style ?? (parameter.in === "query" ? "form" : "simple");
  if (
    (parameter.in === "path" && (style !== "simple" || parameter.explode === true)) ||
    (parameter.in === "query" && style !== "form" && style !== "deepObject") ||
    (style === "deepObject" && parameter.explode !== true)
  ) {
    throw new Error(`${operationId} uses an unsupported parameter serialization`);
  }
  const objectFields =
    style === "deepObject" || (parameter.in === "path" && parameter.schema?.$ref !== undefined)
      ? requireObjectFields(openApi, parameter.schema, operationId)
      : [];
  return {
    name: parameter.name,
    location: parameter.in,
    inputField: requireInputField(parameter["x-isecure-contract-field"], operationId),
    required: parameter.required === true,
    style,
    objectFields,
  };
}

function requireObjectFields(openApi, schemaReference, operationId) {
  const schema = resolveSchema(openApi, schemaReference, operationId);
  if (schema.type !== "object" || schema.additionalProperties !== false || schema.properties === undefined) {
    throw new Error(`${operationId} deep-object parameter must reference a closed object schema`);
  }
  const fields = Object.keys(schema.properties);
  if (fields.length === 0) throw new Error(`${operationId} deep-object parameter has no fields`);
  return fields;
}

function resolveSchema(openApi, schemaReference, operationId) {
  const reference = schemaReference?.$ref;
  const prefix = "#/components/schemas/";
  if (typeof reference !== "string" || !reference.startsWith(prefix)) {
    throw new Error(`${operationId} parameter schema must be a component reference`);
  }
  const schema = openApi.components?.schemas?.[reference.slice(prefix.length)];
  if (schema === undefined) throw new Error(`${operationId} parameter schema does not resolve`);
  return schema;
}

function requireHeaderSchema(operationId, mode, headerName, headerParameters) {
  if (mode !== "none" && mode !== "required") throw new Error(`${operationId} has unsupported ${headerName} mode`);
  const matches = headerParameters.filter((parameter) => parameter.name === headerName);
  if (matches.length !== (mode === "required" ? 1 : 0)) {
    throw new Error(`${operationId} ${headerName} binding disagrees with its operation contract`);
  }
  if (mode === "none") return null;
  const parameter = matches[0];
  if (parameter.required !== true) throw new Error(`${operationId} ${headerName} must be required`);
  const schema = parameter.schema;
  if (schema?.type !== "string") throw new Error(`${operationId} ${headerName} must have an inline string schema`);
  const supportedFields = new Set(["type", "minLength", "maxLength", "pattern"]);
  if (Object.keys(schema).some((field) => !supportedFields.has(field))) {
    throw new Error(`${operationId} ${headerName} has an unsupported schema constraint`);
  }
  const minLength = requireOptionalLength(schema.minLength, operationId, headerName, "minLength");
  const maxLength = requireOptionalLength(schema.maxLength, operationId, headerName, "maxLength");
  if (minLength !== null && maxLength !== null && minLength > maxLength) {
    throw new Error(`${operationId} ${headerName} has an invalid length range`);
  }
  const pattern = schema.pattern ?? null;
  if (pattern !== null) {
    if (typeof pattern !== "string" || pattern.length === 0) {
      throw new Error(`${operationId} ${headerName} pattern must be a non-empty string`);
    }
    try {
      new RegExp(pattern, "u");
    } catch {
      throw new Error(`${operationId} ${headerName} pattern is not a valid regular expression`);
    }
  }
  return { type: "string", minLength, maxLength, pattern };
}

function requireContractVersionHeader(operationId, version, headerParameters) {
  const expectedNames = [
    "ISECure-Contract-Version",
    ...(headerParameters.some((parameter) => parameter.name === "Idempotency-Key") ? ["Idempotency-Key"] : []),
    ...(headerParameters.some((parameter) => parameter.name === "If-Match") ? ["If-Match"] : []),
  ];
  const actualNames = headerParameters.map((parameter) => parameter.name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`${operationId} has an unsupported or misordered header binding`);
  }
  const parameter = headerParameters[0];
  if (
    parameter?.name !== "ISECure-Contract-Version" ||
    parameter.required !== true ||
    parameter.schema?.type !== "integer" ||
    parameter.schema.const !== version ||
    JSON.stringify(Object.keys(parameter.schema).sort()) !== JSON.stringify(["const", "type"])
  ) {
    throw new Error(`${operationId} contract-version header disagrees with its operation contract`);
  }
}

function requireOptionalLength(value, operationId, headerName, field) {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${operationId} ${headerName} ${field} must be a non-negative integer`);
  }
  return value;
}

function requireSyntheticMockSafety(value) {
  const expected = {
    syntheticOnly: true,
    tenantAuthority: false,
    customerData: false,
    productionCredentials: false,
    genericTools: [],
    filesystemAccess: false,
    networkAccess: false,
    financialSideEffects: false,
  };
  if (
    value === null ||
    typeof value !== "object" ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(Object.keys(expected).sort()) ||
    Object.entries(expected).some(
      ([field, expectedValue]) => JSON.stringify(value[field]) !== JSON.stringify(expectedValue),
    )
  ) {
    throw new Error("generated processing mock does not satisfy the client safety boundary");
  }
}

function requireRequestBodyParity(openApi, binding, inputContract, operationId) {
  const schema = binding.operation.requestBody?.content?.["application/json"]?.schema;
  const hasBody = schema !== undefined;
  if (binding.method === "get" && hasBody) throw new Error(`${operationId} GET binding cannot have a request body`);
  if (binding.method === "post" && !hasBody) throw new Error(`${operationId} POST binding must have a request body`);
  if (binding.method !== "get" && binding.method !== "post") {
    throw new Error(`${operationId} uses an unsupported HTTP method`);
  }
  if (hasBody) {
    if (binding.operation.requestBody.required !== true) {
      throw new Error(`${operationId} JSON request body must be required`);
    }
    resolveSchema(openApi, schema, operationId);
    if (schema.$ref !== `#/components/schemas/${inputContract}`) {
      throw new Error(`${operationId} request body disagrees with its input contract`);
    }
  }
  return hasBody;
}

function requireSuccessResponseParity(binding, contract, operationId) {
  const status = contract.execution === "durable" ? "202" : "200";
  const response = binding.operation.responses?.[status];
  if (response === undefined || typeof response !== "object") {
    throw new Error(`${operationId} has no generated success response`);
  }
  const content = response.content;
  if (content === undefined || typeof content !== "object" || Array.isArray(content)) {
    throw new Error(`${operationId} success response has no generated content`);
  }
  const mediaTypes = Object.keys(content);
  if (mediaTypes.length !== 1) throw new Error(`${operationId} success response must have one media type`);
  const mediaType = mediaTypes[0];
  if (mediaType === "application/json") {
    const schema = content[mediaType]?.schema;
    if (schema?.$ref !== `#/components/schemas/${contract.result}`) {
      throw new Error(`${operationId} JSON success response disagrees with its result contract`);
    }
    if (response.headers !== undefined) throw new Error(`${operationId} JSON success response has unsupported headers`);
    return { kind: "json", status: Number(status), mediaType };
  }
  if (mediaType !== "application/xml") {
    throw new Error(`${operationId} has unsupported success media type ${String(mediaType)}`);
  }
  const schema = content[mediaType]?.schema;
  if (
    schema?.type !== "string" ||
    schema.format !== "binary" ||
    !Number.isSafeInteger(schema.maxLength) ||
    schema.maxLength < 1 ||
    schema.maxLength > 16 * 1024 * 1024
  ) {
    throw new Error(`${operationId} binary success response has an invalid byte bound`);
  }
  const headers = response.headers;
  if (headers === undefined || typeof headers !== "object" || Array.isArray(headers)) {
    throw new Error(`${operationId} binary success response has no integrity headers`);
  }
  const expectedHeaderNames = ["ISECure-Artifact-Id", "ISECure-Artifact-Sha256", "Content-Length"];
  if (JSON.stringify(Object.keys(headers).sort()) !== JSON.stringify(expectedHeaderNames.sort())) {
    throw new Error(`${operationId} binary success response has unsupported integrity headers`);
  }
  const artifactId = requireResponseHeader(headers, "ISECure-Artifact-Id", operationId);
  if (artifactId.type !== "string" || artifactId.format !== "uuid") {
    throw new Error(`${operationId} artifact identity header must be a UUID`);
  }
  const artifactDigest = requireResponseHeader(headers, "ISECure-Artifact-Sha256", operationId);
  if (artifactDigest.type !== "string" || artifactDigest.pattern !== "^sha256:[0-9a-f]{64}$") {
    throw new Error(`${operationId} artifact digest header must be a canonical SHA-256 digest`);
  }
  const contentLength = requireResponseHeader(headers, "Content-Length", operationId);
  if (contentLength.type !== "integer" || contentLength.minimum !== 1 || contentLength.maximum !== schema.maxLength) {
    throw new Error(`${operationId} content-length header disagrees with its binary byte bound`);
  }
  return {
    kind: "binary",
    status: Number(status),
    mediaType,
    maximumBytes: schema.maxLength,
    headers: {
      artifactId: "ISECure-Artifact-Id",
      artifactDigest: "ISECure-Artifact-Sha256",
      contentLength: "Content-Length",
    },
  };
}

function requireResponseHeader(headers, name, operationId) {
  const header = headers[name];
  if (header?.required !== true || header.schema === undefined || typeof header.schema !== "object") {
    throw new Error(`${operationId} ${name} response header must be required and inline`);
  }
  return header.schema;
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
