import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        index: "src/index.ts",
        iso20022: "src/iso20022/index.ts",
      },
      fileName: (_format, entryName) =>
        entryName === "index" ? "isecure-ts-client.js" : "isecure-ts-client-iso20022.js",
      formats: ["es"],
    },
    outDir: ".browser-check",
  },
});
