import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve("src/shared"),
      "@renderer": resolve("src/renderer/src"),
    },
  },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", "out/**", "release/**"],
    coverage: { reporter: ["text"] },
  },
});
