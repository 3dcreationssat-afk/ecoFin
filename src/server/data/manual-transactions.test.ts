// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-manual-transactions.db";

let repositories: typeof import("./repositories");
let prismaModule: typeof import("@/server/db/prisma");

describe("manual transaction creation", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-manual-transactions.db" },
    });
    prismaModule = await import("@/server/db/prisma");
    repositories = await import("./repositories");
  }, 120_000);

  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("persists an audited integer-minor-unit entry and recalculates its account", async () => {
    const household = await repositories.getHousehold();
    const account = household.accounts.find((candidate) => !candidate.archivedAt)!;
    const transaction = await repositories.createManualTransaction({
      accountId: account.id,
      categoryId: null,
      description: "Synthetic manual expense",
      merchant: "Synthetic merchant",
      amount: "12.34",
      direction: "MONEY_OUT",
      transactionDate: "2026-07-18",
      type: "EXPENSE",
      notes: "Isolated test entry",
    });
    expect(transaction).toMatchObject({
      amountMinor: -1234,
      sourceType: "MANUAL",
      reviewStatus: "REVIEWED",
      merchantSource: "USER",
      typeSource: "USER",
    });
    expect(
      await prismaModule.prisma.auditLog.count({
        where: { entityType: "Transaction", entityId: transaction.id, action: "create" },
      }),
    ).toBe(1);
    expect(
      await prismaModule.prisma.account.findUniqueOrThrow({ where: { id: account.id } }),
    ).toMatchObject({ ledgerCalculatedAt: expect.any(Date) });
  });

  it("rejects an account outside the active household contract", async () => {
    await expect(
      repositories.createManualTransaction({
        accountId: "missing-account",
        description: "Synthetic invalid entry",
        merchant: "Synthetic merchant",
        amount: "10.00",
        direction: "MONEY_IN",
        transactionDate: "2026-07-18",
        type: "INCOME",
      }),
    ).rejects.toThrow(/Account is invalid/);
  });
});
