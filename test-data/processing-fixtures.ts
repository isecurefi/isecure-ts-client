import { readFileSync } from "node:fs";
import { iso20022Operations, type Iso20022OperationId } from "../src/generated/iso20022-contracts.js";

interface Fixture {
  scenario: string;
  outcome: { status: number; body: Record<string, unknown> };
}
const mock = JSON.parse(readFileSync(new URL("./generated/iso20022-scenarios.json", import.meta.url), "utf8")) as {
  operations: { operationId: Iso20022OperationId; fixtures: Fixture[] }[];
};

export function successFixture(operationId: Iso20022OperationId): Fixture["outcome"] {
  const fixture = mock.operations
    .find((operation) => operation.operationId === operationId)
    ?.fixtures.find((item) => item.scenario === "success");
  if (!fixture) throw new Error(`Missing synthetic success fixture for ${operationId}`);
  return structuredClone(fixture.outcome);
}

export const fixtureFetch: typeof globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  const match = Object.entries(iso20022Operations).find(([, operation]) => {
    const pattern = operation.path
      .split(/\{[^}]+\}/u)
      .map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join("[^/]+");
    return operation.method === (init?.method ?? "GET") && new RegExp(`${pattern}$`, "u").test(url.pathname);
  });
  if (!match) throw new Error("No synthetic fixture for requested operation");
  const fixture = successFixture(match[0] as Iso20022OperationId);
  return Promise.resolve(Response.json(fixture.body, { status: fixture.status }));
};

export function requestUrl(input: RequestInfo | URL | undefined): string {
  if (input === undefined) throw new Error("Missing request");
  return input instanceof Request ? input.url : input.toString();
}
