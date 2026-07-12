// @vitest-environment node
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-debt-plans.db";

let db: typeof import("@/server/db/prisma");
let plans: typeof import("./debt-plans");
let repositories: typeof import("./repositories");

describe("debt plan persistence", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    db = await import("@/server/db/prisma");
    plans = await import("./debt-plans");
    repositories = await import("./repositories");
  }, 120_000);

  afterAll(async () => db.prisma.$disconnect());

  it("loads the canonical saved plan and persists strategy, extra, order, and audit", async () => {
    const seeded = await plans.getDebtPlan();
    expect(seeded).toMatchObject({ strategy: "AVALANCHE", extraPaymentMinor: 25_000, saved: true });
    const debts = await db.prisma.account.findMany({
      where: {
        type: { in: ["CREDIT", "LOAN", "MORTGAGE"] },
        ledgerBalanceMinor: { gt: 0 },
      },
      orderBy: { id: "asc" },
    });
    const order = debts.map((debt) => debt.id).reverse();
    await plans.saveDebtPlan({ strategy: "CUSTOM", extraPaymentMinor: 12_345, customOrder: order });
    const saved = await plans.getDebtPlan();
    expect(saved).toMatchObject({
      strategy: "CUSTOM",
      extraPaymentMinor: 12_345,
      customOrder: order,
    });
    expect(await db.prisma.auditLog.count({ where: { entityType: "DebtPlan" } })).toBeGreaterThan(
      0,
    );
  });

  it("rejects incomplete custom order and retains the saved plan", async () => {
    await expect(
      plans.saveDebtPlan({ strategy: "CUSTOM", extraPaymentMinor: 0, customOrder: [] }),
    ).rejects.toThrow("every eligible active debt");
    expect((await plans.getDebtPlan()).strategy).toBe("CUSTOM");
  });

  it("demo reset restores the canonical plan and Start Fresh removes it", async () => {
    await repositories.resetDemoData();
    expect(await db.prisma.debtPlan.count()).toBe(1);
    await repositories.startFreshWorkspace({ confirmation: "START FRESH" });
    expect(await db.prisma.debtPlan.count()).toBe(0);
  });
});
