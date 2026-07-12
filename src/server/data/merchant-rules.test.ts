import { execSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
process.env.DATABASE_URL = "file:./vitest-merchant-rules.db";
let prismaModule: typeof import("@/server/db/prisma");
let rules: typeof import("./merchant-rules");
let bulk: typeof import("./transaction-bulk");
let repositories: typeof import("./repositories");
describe("merchant rule and bulk services", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    prismaModule = await import("@/server/db/prisma");
    rules = await import("./merchant-rules");
    bulk = await import("./transaction-bulk");
    repositories = await import("./repositories");
  }, 120000);
  afterAll(async () => prismaModule.prisma.$disconnect());
  it("creates, previews, applies, updates, disables, and archives rules", async () => {
    const household = await repositories.getHousehold();
    const category = household.categories.find((item) => item.name === "Groceries")!;
    const input = {
      name: "Whole Foods cleanup",
      priority: 10,
      active: true,
      matchField: "ORIGINAL_DESCRIPTION",
      matchType: "CONTAINS",
      pattern: "whole foods",
      normalizedMerchant: "Whole Foods Clean",
      categoryId: category.id,
      transactionType: null,
      markReviewed: true,
      notes: "synthetic",
    };
    const preview = await rules.previewMerchantRule(input);
    expect(preview.matchedCount).toBeGreaterThan(0);
    const created = await rules.createMerchantRule(input, false);
    expect(created.application).toBeUndefined();
    const transaction = household.transactions.find((item) =>
      item.originalDescription.toLowerCase().includes("whole foods"),
    )!;
    expect(
      (await prismaModule.prisma.transaction.findUnique({ where: { id: transaction.id } }))
        ?.normalizedMerchant,
    ).not.toBe("Whole Foods Clean");
    const applied = await rules.updateMerchantRule(
      created.rule.id,
      { ...input, name: "Whole Foods cleanup updated" },
      true,
    );
    expect(applied.application?.applied).toBeGreaterThan(0);
    await rules.setMerchantRuleActive(created.rule.id, false);
    expect((await rules.listMerchantRules())[0].active).toBe(false);
    await rules.archiveMerchantRule(created.rule.id);
    expect(await rules.listMerchantRules()).toHaveLength(0);
  });
  it("applies audited all-or-nothing bulk review actions", async () => {
    const household = await repositories.getHousehold();
    const ids = household.transactions.slice(0, 2).map((item) => item.id);
    const result = await bulk.bulkUpdateTransactions({
      transactionIds: ids,
      action: "MARK_REVIEWED",
    });
    expect("changed" in result ? result.changed : 0).toBe(2);
    expect(
      await prismaModule.prisma.transaction.count({
        where: { id: { in: ids }, reviewStatus: "REVIEWED", reviewSource: "BULK_USER" },
      }),
    ).toBe(2);
    expect(
      await prismaModule.prisma.auditLog.count({
        where: { entityType: "BulkTransactionOperation" },
      }),
    ).toBe(1);
    await expect(
      bulk.bulkUpdateTransactions({
        transactionIds: [ids[0], "missing"],
        action: "EXCLUDE",
        confirmation: "CONFIRM BULK CHANGE",
      }),
    ).rejects.toThrow("Nothing was changed");
  });
  it("protects later manual corrections from reapplication", async () => {
    const household = await repositories.getHousehold();
    const transaction = household.transactions.find((item) =>
      item.originalDescription.toLowerCase().includes("whole foods"),
    )!;
    await repositories.updateTransactionEditable(transaction.id, {
      normalizedMerchant: "Manual merchant",
      categoryId: transaction.categoryId,
      type: transaction.type,
      reviewStatus: transaction.reviewStatus,
      excluded: transaction.excluded,
      notes: transaction.notes,
    });
    const created = await rules.createMerchantRule(
      {
        name: "Manual lock test",
        priority: 1,
        active: true,
        matchField: "ORIGINAL_DESCRIPTION",
        matchType: "CONTAINS",
        pattern: "whole foods",
        normalizedMerchant: "Should not win",
        categoryId: null,
        transactionType: null,
        markReviewed: false,
        notes: null,
      },
      true,
    );
    expect(created.application?.skipped).toBeGreaterThan(0);
    expect(
      (await prismaModule.prisma.transaction.findUnique({ where: { id: transaction.id } }))
        ?.normalizedMerchant,
    ).toBe("Manual merchant");
  });
  it("start fresh removes rules", async () => {
    await repositories.startFreshWorkspace({ confirmation: "START FRESH" });
    expect(await prismaModule.prisma.merchantRule.count()).toBe(0);
  });
});
