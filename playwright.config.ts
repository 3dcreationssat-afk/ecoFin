import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
const e2eDatabasePath = resolve(process.cwd(), "test-results", "playwright", "e2e.sqlite");
const e2eDatabaseUrl = `file:${e2eDatabasePath.replaceAll("\\", "/")}`;
const serverCommand =
  process.env.E2E_SERVER_MODE === "production"
    ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
    : `npm run db:reset && npm run dev -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_URL: e2eDatabaseUrl,
      FINANCIAL_COMPASS_WORKSPACE_TYPE: "TEST",
      FINANCIAL_COMPASS_EXPECTED_WORKSPACE_ID: "",
      FINANCIAL_COMPASS_REAL_DATABASE_PATH: process.env.FINANCIAL_COMPASS_REAL_DATABASE_PATH ?? "",
    },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
