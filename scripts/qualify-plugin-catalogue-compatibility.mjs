// Executes retained SDK packages against synthetic old/new server responses. No real credentials or network.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

const [legacyRoot] = process.argv.slice(2);
assert(legacyRoot && path.isAbsolute(legacyRoot), "Pass the absolute installed legacy SDK directory");
const candidateRoot = fileURLToPath(new URL("../", import.meta.url));
const report = [];
// Opaque synthetic release text exercises transport preservation, not native package admission.
const entry = (version) => ({
  provider_id: "isecure.provider.synthetic",
  package_id: "isecure.connector.synthetic",
  package_version: version,
  package_digest: `sha256:${"a".repeat(64)}`,
  connector_manifest_digest: `sha256:${"b".repeat(64)}`,
  discovery: [{ locale: "en", title: "Synthetic connector", summary: "Transport fixture", search_terms: [] }],
  availability: "available",
  qualification_state: "qualified",
  limitation_codes: [],
  released_at: "2026-10-01T00:00:00Z",
  release_entry: JSON.stringify({ fixture: "opaque transport-only release", version, text: 'Å & "quoted"' }),
  future_entry_metadata: { additive: true },
});
for (const [clientKind, root] of [
  ["released", legacyRoot],
  ["candidate", candidateRoot],
]) {
  const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(metadata.name, "isecure-ts-client");
  if (clientKind === "released") assert.equal(metadata.version, "4.0.0");
  const { createPlatformClient } = await import(pathToFileURL(path.join(root, "dist/platform/index.js")));
  const { Iso20022HttpTransport, Iso20022HttpError } = await import(
    pathToFileURL(path.join(root, "dist/iso20022/index.js"))
  );
  for (const serverKind of ["legacy", "versioned"]) {
    for (const requestedFormat of clientKind === "released" ? [undefined] : [undefined, 2]) {
      for (const payloadKind of ["empty", "releases", "mixed"]) {
        const requests = [];
        const entries = payloadKind === "empty" ? [] : [entry("1.0.0"), entry("1.1.0")];
        // Malformed transport members must reach the caller's per-entry admission unchanged.
        if (payloadKind === "mixed") entries.splice(1, 0, null, { future_entry_shape: true });
        const responseFor = (format) => ({
          context: { contract_version: "1" },
          entries,
          ...(payloadKind === "empty" ? {} : { future_catalogue_metadata: { additive: true } }),
          ...(format === "2"
            ? {
                catalogue_format_version: 2,
                entry_issues:
                  payloadKind === "empty"
                    ? []
                    : [
                        {
                          provider_id: "isecure.provider.synthetic",
                          package_id: "isecure.connector.synthetic",
                          package_version: "2.0.0",
                          reason: "invalid_entry",
                          future_issue_metadata: true,
                        },
                      ],
              }
            : {}),
        });
        const transport = new Iso20022HttpTransport({
          baseUrl: "https://synthetic.example.test/",
          bootstrapAuthentication: () => ({ apiKey: "synthetic-key", idToken: "synthetic-token" }),
          processingAudience: "isecure-processing-gpgtest-v1",
          fetch: (input) => {
            const url = new URL(input instanceof globalThis.Request ? input.url : input.toString());
            if (url.pathname.endsWith("/session"))
              return Promise.resolve(
                globalThis.Response.json({
                  audience: "isecure-processing-gpgtest-v1",
                  expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 600,
                  processingSession: "A".repeat(43),
                  schemaVersion: 1,
                  tokenType: "Processing",
                }),
              );
            assert.equal(url.pathname, "/v1/plugin-catalogue");
            requests.push(Object.fromEntries(url.searchParams));
            if (serverKind === "legacy" && url.searchParams.has("catalogue_format_version")) {
              return Promise.resolve(
                globalThis.Response.json({ issues: [{ issue_code: "input_invalid" }] }, { status: 400 }),
              );
            }
            return Promise.resolve(
              globalThis.Response.json(responseFor(url.searchParams.get("catalogue_format_version"))),
            );
          },
        });
        await transport.exchangeProcessingSession();
        const client = createPlatformClient(transport);
        const input = requestedFormat === undefined ? {} : { catalogue_format_version: requestedFormat };
        if (serverKind === "legacy" && requestedFormat === 2) {
          await assert.rejects(
            client.pluginCatalogue.list(input),
            (error) =>
              error instanceof Iso20022HttpError &&
              error.status === 400 &&
              error.body.issues[0].issue_code === "input_invalid",
          );
          // Selection fallback is the caller's policy; the SDK preserves the exact refusal.
          assert.deepEqual(await client.pluginCatalogue.list({}), responseFor(null));
          assert.deepEqual(requests, [{ catalogue_format_version: "2" }, {}]);
        } else {
          const result = await client.pluginCatalogue.list(input);
          assert.deepEqual(result, responseFor(requestedFormat === 2 ? "2" : null));
          assert.deepEqual(requests, [requestedFormat === 2 ? { catalogue_format_version: "2" } : {}]);
        }
        report.push({
          clientKind,
          sdkVersion: metadata.version,
          serverKind,
          requestedFormat: requestedFormat ?? "default",
          payloadKind,
          passed: true,
        });
      }
    }
  }
}
process.stdout.write(
  `${JSON.stringify({ scope: "synthetic transport compatibility; no deployment or plugin execution claim", cases: report }, null, 2)}\n`,
);
