import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 20_000,
  use: {
    baseURL: "http://127.0.0.1:1411",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "UNO_SERVER_ADDR=127.0.0.1:8787 cargo run -p uno-server",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:1411",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
