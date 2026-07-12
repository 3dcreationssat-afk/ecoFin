// @vitest-environment node
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-decisions.db";

let db: typeof import("@/server/db/prisma");
let scenarios: typeof import("./decision-scenarios");
let repositories: typeof import("./repositories");

describe("decision scenario persistence and isolation", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    db = await import("@/server/db/prisma");
    scenarios = await import("./decision-scenarios");
    repositories = await import("./repositories");
  }, 120_000);

  afterAll(async () => db.prisma.$disconnect());

  it("seeds canonical scenarios and evaluates without mutating real records", async () => {
    expect(await db.prisma.decisionScenario.count()).toBe(4);
    const before = await realCounts();
    const dashboard = await scenarios.decisionSimulatorDashboard();
    expect(dashboard.evaluation).not.toBeNull();
    expect(await realCounts()).toEqual(before);
  });

  it("creates, renames, duplicates, archives, restores, and deletes scenarios with audit", async () => {
    const created = await scenarios.createDecisionScenario({ name: "Synthetic scenario" });
    await scenarios.updateDecisionScenario(created.id, {
      name: "Renamed scenario",
      action: "RENAME",
    });
    const duplicate = await scenarios.duplicateDecisionScenario(created.id);
    await scenarios.updateDecisionScenario(created.id, { action: "ARCHIVE" });
    expect((await scenarios.getDecisionScenario(created.id)).archivedAt).not.toBeNull();
    await scenarios.updateDecisionScenario(created.id, { action: "RESTORE" });
    await scenarios.deleteDecisionScenario(duplicate.id);
    await expect(scenarios.getDecisionScenario(duplicate.id)).rejects.toThrow("not found");
    expect(
      await db.prisma.auditLog.count({ where: { entityType: "DecisionScenario" } }),
    ).toBeGreaterThanOrEqual(6);
  });

  it("adds, edits, removes, and duplicates typed components", async () => {
    const created = await scenarios.createDecisionScenario({ name: "Component lifecycle" });
    const component = await scenarios.addScenarioComponent(created.id, {
      type: "RECURRING_EXPENSE",
      name: "Synthetic monthly cost",
      amountMinor: 12_345,
      frequency: "MONTHLY",
      startDate: new Date("2026-07-15"),
      durationMonths: 6,
      essentiality: "IMPORTANT",
    });
    await scenarios.updateScenarioComponent(component.id, {
      type: "RECURRING_EXPENSE",
      name: "Edited monthly cost",
      amountMinor: 20_000,
      frequency: "MONTHLY",
      startDate: new Date("2026-07-15"),
      durationMonths: 6,
      essentiality: "IMPORTANT",
    });
    const duplicate = await scenarios.duplicateDecisionScenario(created.id);
    expect(duplicate.components).toHaveLength(1);
    await scenarios.removeScenarioComponent(component.id);
    expect((await scenarios.getDecisionScenario(created.id)).components).toHaveLength(0);
    expect(
      await db.prisma.auditLog.count({ where: { entityType: "DecisionScenarioComponent" } }),
    ).toBeGreaterThanOrEqual(3);
  });

  it("rejects archived or invalid linked records", async () => {
    const created = await scenarios.createDecisionScenario({ name: "Invalid links" });
    const archived = await db.prisma.goal.findFirstOrThrow();
    await db.prisma.goal.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    await expect(
      scenarios.addScenarioComponent(created.id, {
        type: "SAVINGS_CHANGE",
        name: "Archived goal",
        amountMinor: 1_000,
        linkedGoalId: archived.id,
        startDate: new Date("2026-07-15"),
      }),
    ).rejects.toThrow("invalid or archived");
  });

  it("evaluates USER_DATA and lowers confidence for MIXED provenance", async () => {
    const household = await db.prisma.household.findFirstOrThrow();
    await db.prisma.household.update({
      where: { id: household.id },
      data: { workspaceMode: "USER_DATA" },
    });
    expect((await scenarios.decisionSimulatorDashboard()).evaluation).not.toBeNull();
    await db.prisma.household.update({
      where: { id: household.id },
      data: { workspaceMode: "MIXED" },
    });
    expect((await scenarios.decisionSimulatorDashboard()).evaluation?.confidence).not.toBe("HIGH");
  });

  it("demo reset restores scenarios and Start Fresh removes them", async () => {
    await repositories.resetDemoData();
    expect(await db.prisma.decisionScenario.count()).toBe(4);
    await repositories.startFreshWorkspace({ confirmation: "START FRESH" });
    expect(await db.prisma.decisionScenario.count()).toBe(0);
  });

  async function realCounts() {
    const [transactions, accounts, income, obligations, recurring, goals, debtPlans] =
      await Promise.all([
        db.prisma.transaction.count(),
        db.prisma.account.count(),
        db.prisma.expectedIncomeSchedule.count(),
        db.prisma.scheduledObligation.count(),
        db.prisma.recurringExpense.count(),
        db.prisma.goal.count(),
        db.prisma.debtPlan.count(),
      ]);
    return { transactions, accounts, income, obligations, recurring, goals, debtPlans };
  }
});
