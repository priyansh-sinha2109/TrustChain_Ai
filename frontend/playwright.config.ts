import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://localhost:3107", channel: "chrome", viewport: { width: 1365, height: 900 } },
  webServer: { command: "npm run start -- --port 3107", url: "http://localhost:3107", reuseExistingServer: false },
});
