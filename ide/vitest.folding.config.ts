import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/verificationSetup.ts"],
    include: [
      "src/test/rustFolding.test.ts",
      "src/test/editorStore.test.ts",
    ],
  },
  resolve: {
    alias: { "@": path.join(configDir, "src") },
  },
});
