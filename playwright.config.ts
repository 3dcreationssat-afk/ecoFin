import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${port}`;
const serverCommand =
  process.env.E2E_SERVER_MODE === "production"
    ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
    : `npm run dev -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !process.env.E2E_PORT,
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
