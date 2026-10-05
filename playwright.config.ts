import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "@playwright/test";

const PORT = 3100;
const dataDir = path.join(os.tmpdir(), `ff-e2e-${process.pid}`);
fs.rmSync(dataDir, { recursive: true, force: true });

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // uses the Chrome already installed on the machine (no browser download)
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    locale: "en-US",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      PGLITE_DIR: path.join(dataDir, "pglite"),
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef",
      OWNER_EMAIL: "owner@example.com",
      OWNER_PASSWORD: "e2e-password-123",
      APP_URL: `http://localhost:${PORT}`,
      CRON_SECRET: "e2e-cron-secret-123",
      RESEND_API_KEY: "",
    },
  },
});
