// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-start-fresh.db";

let route: typeof import("./route");
let prismaModule: typeof import("@/server/db/prisma");

function request(body: unknown) {
  return new Request("http://localhost/api/workspace/start-fresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("start fresh API route", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-start-fresh.db" },
    });
    route = await import("./route");
    prismaModule = await import("@/server/db/prisma");
  }, 120_000);

  afterAll(async () => {
    await prismaModule?.prisma.$disconnect();
  });

  it("rejects non-exact confirmation with a structured error", async () => {
    const response = await route.POST(request({ confirmation: "START" }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      ok: false,
      code: "START_FRESH_CONFIRMATION_INVALID",
      message: "Type START FRESH to confirm removing the sample workspace.",
    });
  });

  it("returns before and after counts when the workspace is emptied", async () => {
    const response = await route.POST(request({ confirmation: "START FRESH" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      message: "Fresh workspace is ready.",
      workspaceState: "EMPTY",
      before: {
        households: 1,
        accounts: 6,
        categories: 14,
        goals: 4,
        transactions: 20,
      },
      after: {
        households: 1,
        accounts: 0,
        categories: 0,
        goals: 0,
        transactions: 0,
        importBatches: 0,
        transferMatches: 0,
        recurringExpenses: 0,
      },
      database: { provider: "sqlite", filename: "vitest-start-fresh.db" },
    });
  });

  it("returns a structured failure response without a raw stack trace", async () => {
    const response = await route.POST(
      request({ confirmation: "START FRESH", simulateFailure: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      code: "START_FRESH_FAILED",
      message: "Fresh workspace could not be created.",
      details: "Simulated start-fresh failure.",
    });
    expect(JSON.stringify(body)).not.toContain("at ");
  });
});
