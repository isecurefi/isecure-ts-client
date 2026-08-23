import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  files: string[];
  exports: Record<string, { browser: string; import: string; types: string }>;
}

describe("Bank Simulation package isolation", () => {
  it("ships only through the existing experimental iso20022 subpath", async () => {
    const root = resolve(import.meta.dirname, "../..");
    const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as PackageManifest;
    const permanentEntry = await readFile(resolve(root, "src/index.ts"), "utf8");

    expect(Object.keys(manifest.exports)).toEqual([".", "./wsapi-types", "./iso20022"]);
    expect(manifest.exports["./iso20022"]).toEqual({
      types: "./dist/iso20022/index.d.ts",
      browser: "./dist/iso20022/index.js",
      import: "./dist/iso20022/index.js",
    });
    expect(manifest.files).toEqual(["dist", "README.md", "CHANGELOG.md", "STABILITY.md", "LICENSE"]);
    expect(permanentEntry).toContain("export { WSChannel");
    expect(permanentEntry).not.toContain("iso20022");
    expect(permanentEntry).not.toContain("simulation");
  });
});
