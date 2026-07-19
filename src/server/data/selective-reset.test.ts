// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-selective-reset.db";
process.env.FINANCIAL_COMPASS_PROJECT_ROOT = process.cwd();
process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE = "TEST";

let reset: typeof import("./selective-reset");
let prismaModule: typeof import("@/server/db/prisma");

describe("selective workspace reset", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-selective-reset.db" },
    });
    prismaModule = await import("@/server/db/prisma");
    reset = await import("./selective-reset");
  }, 120_000);

  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("clears transactions but preserves accounts, import metadata, rules, and a safety backup", async () => {
    const before = {
      transactions: await prismaModule.prisma.transaction.count(),
      accounts: await prismaModule.prisma.account.count(),
      imports: await prismaModule.prisma.importBatch.count(),
      rules: await prismaModule.prisma.merchantRule.count(),
    };
    const result = await reset.runSelectiveReset({
      scope: "TRANSACTIONS",
      confirmation: "CLEAR TRANSACTIONS",
    });
    expect(result.safetyBackup).toMatch(/financial-compass-backup/);
    expect(await prismaModule.prisma.transaction.count()).toBe(0);
    expect(await prismaModule.prisma.account.count()).toBe(before.accounts);
    expect(await prismaModule.prisma.importBatch.count()).toBe(before.imports);
    expect(await prismaModule.prisma.merchantRule.count()).toBe(before.rules);
    expect(before.transactions).toBeGreaterThan(0);
  });

  it("clears CSV history while preserving the remaining workspace", async () => {
    const accounts = await prismaModule.prisma.account.count();
    const result = await reset.runSelectiveReset({
      scope: "CSV_HISTORY",
      confirmation: "CLEAR CSV HISTORY",
    });
    expect(result.safetyBackup).toMatch(/financial-compass-backup/);
    expect(await prismaModule.prisma.importBatch.count()).toBe(0);
    expect(await prismaModule.prisma.importRow.count()).toBe(0);
    expect(await prismaModule.prisma.account.count()).toBe(accounts);
  });

  it("handles an empty Plaid disconnect scope without touching local accounts", async () => {
    const accounts = await prismaModule.prisma.account.count();
    const result = await reset.runSelectiveReset({
      scope: "PLAID_CONNECTIONS",
      confirmation: "DISCONNECT PLAID",
    });
    expect(result.removed).toEqual({ connectedInstitutions: 0 });
    expect(await prismaModule.prisma.account.count()).toBe(accounts);
  });

  it("resets household financial data while preserving identity, categories, audit, and backup", async () => {
    const before = {
      householdId: (await prismaModule.prisma.household.findFirstOrThrow()).id,
      categories: await prismaModule.prisma.category.count(),
      audits: await prismaModule.prisma.auditLog.count(),
    };
    const result = await reset.runSelectiveReset({
      scope: "HOUSEHOLD_FINANCIAL",
      confirmation: "RESET FINANCIAL DATA",
    });
    expect(result.safetyBackup).toMatch(/financial-compass-backup/);
    expect(await prismaModule.prisma.account.count()).toBe(0);
    expect(await prismaModule.prisma.transaction.count()).toBe(0);
    expect(await prismaModule.prisma.goal.count()).toBe(0);
    expect(await prismaModule.prisma.household.findFirstOrThrow()).toMatchObject({
      id: before.householdId,
      workspaceMode: "EMPTY",
    });
    expect(await prismaModule.prisma.category.count()).toBe(before.categories);
    expect(await prismaModule.prisma.auditLog.count()).toBeGreaterThan(before.audits);
  });
});
