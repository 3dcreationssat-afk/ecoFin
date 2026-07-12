// @vitest-environment node
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
process.env.DATABASE_URL = "file:./vitest-planning.db";
let db: typeof import("@/server/db/prisma");
let planning: typeof import("./planning");
let cash: typeof import("./cash-flow");
describe("planning persistence", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    db = await import("@/server/db/prisma");
    planning = await import("./planning");
    cash = await import("./cash-flow");
  }, 120000);
  afterAll(async () => db.prisma.$disconnect());
  it("seeds nonzero validated income and obligations with policy separation", async () => {
    const p = await cash.getCashFlowProjection(new Date("2026-07-12"));
    expect(p.remainingExpectedIncomeMinor).toBeGreaterThan(0);
    expect(p.remainingEssentialObligationsMinor).toBeGreaterThan(0);
    expect(p.recommendedSafeToSaveMinor).toBeLessThan(p.maximumAvailableSurplusMinor);
    expect(p.safeToSpendMinor).toBeGreaterThan(0);
  });
  it("creates, edits, pauses, archives, and audits income and obligations", async () => {
    const h = await db.prisma.household.findFirstOrThrow();
    const income = await planning.createExpectedIncome({
      householdId: h.id,
      name: "One-time synthetic",
      amountMinor: 10000,
      frequency: "ONE_TIME",
      nextExpectedDate: new Date("2026-07-25"),
    });
    await planning.updateExpectedIncome(income.id, { name: "Edited synthetic" });
    await planning.setExpectedIncomeState(income.id, "PAUSE");
    const obligation = await planning.createObligation({
      householdId: h.id,
      name: "Medical synthetic",
      amountMinor: 5000,
      dueDate: new Date("2026-07-26"),
      frequency: "ONE_TIME",
      obligationType: "MEDICAL",
    });
    await planning.setObligationState(obligation.id, "ARCHIVE");
    expect(
      await db.prisma.auditLog.count({
        where: { entityType: { in: ["ExpectedIncomeSchedule", "ScheduledObligation"] } },
      }),
    ).toBeGreaterThanOrEqual(5);
  });
  it("marks received, paid, skipped, and partial occurrences without double matching", async () => {
    await planning.ensurePlanningOccurrences(new Date("2026-08-01"));
    const income = await db.prisma.expectedIncomeOccurrence.findFirstOrThrow({
      where: { status: "UPCOMING" },
    });
    await planning.actOnOccurrence("income", income.id, {
      action: "RECEIVED",
      amountMinor: income.expectedAmountMinor,
    });
    const obligations = await db.prisma.obligationOccurrence.findMany({
      where: { status: "UPCOMING" },
      take: 3,
    });
    await planning.actOnOccurrence("obligation", obligations[0].id, { action: "PAID" });
    await planning.actOnOccurrence("obligation", obligations[1].id, { action: "SKIPPED" });
    await planning.actOnOccurrence("obligation", obligations[2].id, {
      action: "PARTIALLY_PAID",
      amountMinor: 100,
    });
    expect(
      await db.prisma.obligationOccurrence.count({
        where: { status: { in: ["PAID", "SKIPPED", "PARTIALLY_PAID"] } },
      }),
    ).toBeGreaterThanOrEqual(3);
  });
  it("persists and audits savings policy", async () => {
    await planning.updateSavingsPolicy({
      savingsRecommendationMode: "CUSTOM",
      savingsTargetBps: 4000,
      minimumDiscretionaryReserveMinor: 200000,
      extraSafetyReserveMinor: 50000,
      minimumCashRetainedMinor: 300000,
      includeGoalContributionsInSafeToSave: true,
      emergencyShortfallIncreasesRecommendation: false,
      conservativeConfidenceAdjustmentBps: 2500,
    });
    expect((await db.prisma.household.findFirst())?.savingsTargetBps).toBe(4000);
    expect(
      await db.prisma.auditLog.count({ where: { action: "update_savings_policy" } }),
    ).toBeGreaterThanOrEqual(1);
  });
});
