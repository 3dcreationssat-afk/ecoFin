import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backupRoot } from "@/domain/backup/backup";
import { parseTransactionQuery } from "@/domain/transactions/query";

const parseQueryForTest = (value: string) => parseTransactionQuery(new URLSearchParams(value));

process.env.DATABASE_URL = "file:./vitest-integration.db";

let repositories: typeof import("./repositories");
let prismaModule: typeof import("@/server/db/prisma");
let transactionViews: typeof import("./transaction-views");

describe("persistent repositories", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-integration.db" },
    });
    repositories = await import("./repositories");
    prismaModule = await import("@/server/db/prisma");
    transactionViews = await import("./transaction-views");
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
      openingBalanceMinor: 12345,
      openingBalanceDate: new Date("2026-07-01"),
      openingBalanceSource: "USER_OPENING_BALANCE",
      reportedBalanceMinor: 12345,
      reportedAvailableMinor: 12345,
      reportedBalanceAsOf: new Date(),
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

  it("persists, filters, defaults, renames, updates, and archives saved transaction views", async () => {
    const query = parseQueryForTest("status=NEEDS_REVIEW&pageSize=50");
    const created = await transactionViews.createSavedView({ name: " Needs review ", query });
    await expect(transactionViews.createSavedView({ name: "needs REVIEW", query })).rejects.toThrow(
      "already exists",
    );
    await transactionViews.updateSavedView(created.id, { isDefault: true });
    expect((await transactionViews.defaultSavedView())?.id).toBe(created.id);
    await transactionViews.updateSavedView(created.id, {
      name: "Review queue",
      query: parseQueryForTest("excluded=excluded"),
    });
    const filtered = await transactionViews.transactionPage(
      parseQueryForTest("excluded=excluded&pageSize=25"),
    );
    expect(filtered.items.every((item) => item.excluded)).toBe(true);
    await transactionViews.updateSavedView(created.id, { isDefault: false });
    expect(await transactionViews.defaultSavedView()).toBeNull();
    await transactionViews.updateSavedView(created.id, { isArchived: true });
    expect(await transactionViews.listSavedViews()).toHaveLength(0);
  });

  it("resets the active demo database to canonical seed counts and records reset audit", async () => {
    const household = await repositories.getHousehold();
    await repositories.createAccount({
      householdId: household.id,
      name: "Reset Test Account",
      institution: "Local",
      type: "CHECKING",
      openingBalanceMinor: 999,
      openingBalanceDate: new Date("2026-07-01"),
      openingBalanceSource: "USER_OPENING_BALANCE",
      reportedBalanceMinor: 999,
      reportedAvailableMinor: 999,
      reportedBalanceAsOf: new Date(),
      lastUpdated: new Date(),
    });
    await repositories.createGoal({
      householdId: household.id,
      name: "Reset Test Goal",
      targetMinor: 1000,
      currentMinor: 0,
      plannedMonthlyMinor: 100,
      requiredMonthlyMinor: 100,
      priority: 999,
    });
    const result = await repositories.resetDemoDataWithResult({
      confirmation: "RESET DEMO DATA",
    });
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Demonstration data was reset.");
    expect(result.database).toMatchObject({
      provider: "sqlite",
      filename: "vitest-integration.db",
    });
    expect(result.counts).toMatchObject({
      households: 1,
      accounts: 6,
      categories: 14,
      goals: 4,
      goalContributions: 2,
      transactions: 20,
      importBatches: 0,
      transferMatches: 0,
      recurringExpenses: 3,
      recurringLinks: 0,
      decisionScenarios: 4,
      decisionScenarioComponents: 4,
      auditEvents: 2,
    });
    expect(await prismaModule.prisma.account.count({ where: { name: "Reset Test Account" } })).toBe(
      0,
    );
    expect(await prismaModule.prisma.goal.count({ where: { name: "Reset Test Goal" } })).toBe(0);
    expect(
      await prismaModule.prisma.auditLog.count({
        where: { action: "demo_reset", source: "reset" },
      }),
    ).toBe(1);
    const repeated = await repositories.resetDemoDataWithResult({
      confirmation: "RESET DEMO DATA",
    });
    expect(repeated.counts).toMatchObject({
      households: 1,
      accounts: 6,
      categories: 14,
      goals: 4,
      transactions: 20,
    });
    expect(await repositories.workspaceState()).toBe("DEMONSTRATION");
  });

  it("starts fresh without recreating demo records and preserves backup files", async () => {
    await repositories.resetDemoDataWithResult({ confirmation: "RESET DEMO DATA" });
    await transactionViews.createSavedView({
      name: "Removed by start fresh",
      query: parseQueryForTest("status=FLAGGED"),
    });
    const backupDir = backupRoot();
    mkdirSync(backupDir, { recursive: true });
    const backupPath = join(backupDir, "start-fresh-preservation-test.zip");
    writeFileSync(backupPath, "synthetic backup placeholder");
    const household = await repositories.getHousehold();
    const backup = await prismaModule.prisma.backupRecord.create({
      data: {
        householdId: household.id,
        filename: "start-fresh-preservation-test.zip",
        sizeBytes: 28,
        hash: "synthetic",
        appVersion: "test",
        schemaVersion: "test",
        countsJson: "{}",
        status: "READY",
        notes: "start fresh preservation test",
      },
    });
    expect(existsSync(backupPath)).toBe(true);

    const result = await repositories.startFreshWorkspace({ confirmation: "START FRESH" });

    expect(result.ok).toBe(true);
    expect(result.workspaceState).toBe("EMPTY");
    expect(result.before).toMatchObject({
      households: 1,
      accounts: 6,
      categories: 14,
      goals: 4,
      transactions: 20,
    });
    expect(result.after).toMatchObject({
      households: 1,
      accounts: 0,
      categories: 0,
      goals: 0,
      transactions: 0,
      importBatches: 0,
      transferMatches: 0,
      recurringExpenses: 0,
    });
    expect(await repositories.workspaceState()).toBe("EMPTY");
    expect(await prismaModule.prisma.transactionSavedView.count()).toBe(0);
    expect(await prismaModule.prisma.backupRecord.count({ where: { id: backup.id } })).toBe(1);
    expect(existsSync(backupPath)).toBe(true);
    expect(
      await prismaModule.prisma.auditLog.count({
        where: { action: "workspace_start_fresh", source: "workspace" },
      }),
    ).toBe(1);

    const repeated = await repositories.startFreshWorkspace({ confirmation: "START FRESH" });
    expect(repeated.after).toMatchObject({ accounts: 0, transactions: 0, goals: 0 });
    expect(await repositories.workspaceState()).toBe("EMPTY");
  });

  it("tracks user and mixed workspace states with provenance instead of names", async () => {
    await repositories.startFreshWorkspace({ confirmation: "START FRESH" });
    const household = await repositories.getHousehold();
    await repositories.createAccount({
      householdId: household.id,
      name: "Everyday Checking",
      institution: "Other",
      type: "CHECKING",
      openingBalanceMinor: 100,
      openingBalanceDate: new Date("2026-07-01"),
      openingBalanceSource: "USER_OPENING_BALANCE",
      reportedBalanceMinor: 100,
      reportedAvailableMinor: 100,
      reportedBalanceAsOf: new Date(),
      lastUpdated: new Date(),
    });
    expect(await repositories.workspaceState()).toBe("USER_DATA");

    await repositories.resetDemoDataWithResult({ confirmation: "RESET DEMO DATA" });
    const demoHousehold = await repositories.getHousehold();
    await repositories.createAccount({
      householdId: demoHousehold.id,
      name: "User-created account",
      institution: "Other",
      type: "CHECKING",
      openingBalanceMinor: 100,
      openingBalanceDate: new Date("2026-07-01"),
      openingBalanceSource: "USER_OPENING_BALANCE",
      reportedBalanceMinor: 100,
      reportedAvailableMinor: 100,
      reportedBalanceAsOf: new Date(),
      lastUpdated: new Date(),
    });
    expect(await repositories.workspaceState()).toBe("MIXED");
  });
});
