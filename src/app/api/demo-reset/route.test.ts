// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-demo-reset.db";

let route: typeof import("./route");
let prismaModule: typeof import("@/server/db/prisma");

function request(body: unknown) {
  return new Request("http://localhost/api/demo-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("demo reset API route", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-demo-reset.db" },
    });
    route = await import("./route");
    prismaModule = await import("@/server/db/prisma");
  }, 120_000);

  afterAll(async () => {
    await prismaModule?.prisma.$disconnect();
  });

  it("rejects empty, incorrect, and trailing-space confirmations with structured errors", async () => {
    for (const confirmation of ["", "RESET", "RESET DEMO DATA "]) {
      const response = await route.POST(request({ confirmation }));
      const body = await response.json();
      expect(response.status).toBe(422);
      expect(body).toMatchObject({
        ok: false,
        code: "RESET_CONFIRMATION_INVALID",
        message: "Type RESET DEMO DATA to confirm the single-household demo reset.",
      });
    }
  });

  it("accepts exact confirmation, modifies the active database, and returns counts", async () => {
    const household = await prismaModule.prisma.household.findFirstOrThrow();
    await prismaModule.prisma.category.create({
      data: {
        householdId: household.id,
        name: "API Reset Probe",
        group: "Probe",
        type: "EXPENSE",
        budgetMinor: 0,
        sortOrder: 999,
      },
    });
    const response = await route.POST(request({ confirmation: "RESET DEMO DATA" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      message: "Demonstration data was reset.",
      counts: {
        households: 1,
        accounts: 6,
        categories: 14,
        goals: 4,
        goalContributions: 2,
        transactions: 20,
        importBatches: 0,
        transferMatches: 0,
        recurringExpenses: 2,
        recurringLinks: 0,
        auditEvents: 2,
      },
      database: { provider: "sqlite", filename: "vitest-demo-reset.db" },
    });
    expect(await prismaModule.prisma.category.count({ where: { name: "API Reset Probe" } })).toBe(
      0,
    );
  });

  it("returns a structured failure response without a raw stack trace", async () => {
    const response = await route.POST(
      request({ confirmation: "RESET DEMO DATA", simulateFailure: true }),
    );
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      code: "RESET_FAILED",
      message: "Demonstration data could not be reset.",
      details: "Simulated demo reset failure.",
    });
    expect(JSON.stringify(body)).not.toContain("at ");
  });
});
