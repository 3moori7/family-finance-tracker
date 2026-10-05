import { defineConfig } from "@playwright/test";

// Read-only smoke checks against a deployed site:  PROD_URL=https://your-site npm run smoke:prod
// Nothing here signs in, writes data or tries passwords.
const baseURL = process.env.PROD_URL;
if (!baseURL) throw new Error("Set PROD_URL to the address of the deployed site");

export default defineConfig({
  testDir: "tests/prod",
  timeout: 30_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL, channel: "chrome", viewport: { width: 390, height: 844 } },
});
