import { execSync } from "node:child_process";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

process.env.DATABASE_URL = "file:./vitest-integration.db";

let repositories: typeof import("./repositories");
let prismaModule: typeof import("@/server/db/prisma");

describe("persistent repositories", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-integration.db" },
    });
    repositories = await import("./repositories");
    prismaModule = await import("@/server/db/prisma");
  }, 120_000);

  afterAll(async () => {
    await prismaModule.prisma.$disconnect();
  });

  it("persists household updates and records audit", async () => {
    const household = await repositories.getHousehold();
    await repositories.updateHousehold({
      name: "Integration Household",
      currency: "USD",
      financialMonthStart: 2,
      incomeSchedule: "MONTHLY",
      checkingBufferMinor: 200000,
      emergencyFundTargetMinor: 1600000,
      debtStrategy: "SNOWBALL",
    });
    const updated = await repositories.getHousehold();
    expect(updated.name).toBe("Integration Household");
    const audits = await prismaModule.prisma.auditLog.findMany({
      where: { entityType: "Household", entityId: household.id, field: "name" },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("creates, archives, and restores accounts", async () => {
    const household = await repositories.getHousehold();
    const account = await repositories.createAccount({
      householdId: household.id,
      name: "Integration Checking",
      institution: "Local",
      type: "CHECKING",
      balanceMinor: 12345,
      availableMinor: 12345,
      lastUpdated: new Date(),
      notes: "test",
    });
    expect(account.id).toBeTruthy();
    expect((await repositories.setAccountArchived(account.id, true)).archivedAt).toBeTruthy();
    expect((await repositories.setAccountArchived(account.id, false)).archivedAt).toBeNull();
  });

  it("rejects invalid category hierarchy", async () => {
    const household = await repositories.getHousehold();
    const category = await repositories.createCategory({
      householdId: household.id,
      name: "Integration Parent",
      group: "Test",
      type: "EXPENSE",
      budgetMinor: 0,
      sortOrder: 999,
    });
    await expect(
      repositories.updateCategory(category.id, { parentId: category.id }),
    ).rejects.toThrow();
  });

  it("records goal contributions rather than silently overwriting history", async () => {
    const household = await repositories.getHousehold();
    const goal = household.goals[0];
    const before = goal.currentMinor;
    const result = await repositories.contributeToGoal(goal.id, {
      amountMinor: 1234,
      contributionDate: new Date(),
      note: "integration",
    });
    expect(result.goal.currentMinor).toBe(before + 1234);
    const contributions = await prismaModule.prisma.goalContribution.findMany({
      where: { goalId: goal.id },
    });
    expect(contributions.length).toBeGreaterThan(1);
  });

  it("updates transaction normalized values while preserving original fields and creating audit", async () => {
    const household = await repositories.getHousehold();
    const transaction = household.transactions[0];
    const updated = await repositories.updateTransactionEditable(transaction.id, {
      normalizedMerchant: "Whole Foods Edited",
      categoryId: transaction.categoryId,
      type: transaction.type,
      reviewStatus: "REVIEWED",
      excluded: true,
      notes: "integration note",
    });
    expect(updated.normalizedMerchant).toBe("Whole Foods Edited");
    expect(updated.originalDescription).toBe(transaction.originalDescription);
    expect(updated.amountMinor).toBe(transaction.amountMinor);
    expect(updated.excluded).toBe(true);
    const audit = await repositories.transactionAudit(transaction.id);
    expect(audit.some((entry) => entry.field === "normalizedMerchant")).toBe(true);
    expect(audit.some((entry) => entry.field === "excluded")).toBe(true);
  });
});
