import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
// Keep the database outside Playwright's output directory. Playwright clears its
// artifacts before a run, which otherwise races the web server on Windows.
const e2eDatabasePath = resolve(process.cwd(), "prisma", "vitest-playwright.db");
const e2eDatabaseUrl = `file:${e2eDatabasePath.replaceAll("\\", "/")}`;
const serverMode = process.env.E2E_SERVER_MODE ?? "production";
const serverCommand =
  serverMode === "production"
    ? `npm run db:reset && npx tsx scripts/seed-playwright-plaid.ts && npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`
    : `npm run db:reset && npx tsx scripts/seed-playwright-plaid.ts && npm run dev -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./playwright-artifacts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  webServer:
    process.env.E2E_EXTERNAL_SERVER === "true"
      ? undefined
      : {
          command: serverCommand,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            DATABASE_URL: e2eDatabaseUrl,
            FINANCIAL_COMPASS_WORKSPACE_TYPE: "TEST",
            FINANCIAL_COMPASS_EXPECTED_WORKSPACE_ID: "",
            FINANCIAL_COMPASS_PLAYWRIGHT_FIXTURES: "true",
            FINANCIAL_COMPASS_REAL_DATABASE_PATH:
              process.env.FINANCIAL_COMPASS_REAL_DATABASE_PATH ?? "",
            PLAID_ENV: "",
            PLAID_CLIENT_ID: "",
            PLAID_SECRET: "",
            PLAID_TOKEN_ENCRYPTION_KEY: "",
            PLAID_REDIRECT_URI: "",
            PLAID_WEBHOOK_URL: "",
          },
        },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      grep: /theme selection|navigation reaches accounts|debt planner remains usable|decision simulator remains usable|data quality and .*recurring review|transfer review remains usable|drawer closes with escape|tablet drawer/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
