import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/offline",
  timeout: 90_000,
  reporter: "html",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4179",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npx serve out --listen 4179",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: false
  }
});
