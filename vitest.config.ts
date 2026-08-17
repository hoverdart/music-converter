import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["tests/e2e/**", "tests/offline/**", "node_modules/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: { reporter: ["text", "html"] }
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } }
});
