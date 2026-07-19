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
  it("applies safe mixed review recommendations and leaves uncertain rows flagged", async () => {
    const household = await repositories.getHousehold();
    const creditAccount = await prismaModule.prisma.account.findFirstOrThrow({
      where: { householdId: household.id, type: "CREDIT" },
    });
    const examples = [
      { description: "Payment Thank You-Mobile", amountMinor: 39454 },
      { description: "YOUR CASH REWARD/REFUND IS", amountMinor: 29214 },
      { description: "FOREIGN TRANSACTION FEE", amountMinor: -34 },
      { description: "MYSTERY CREDIT", amountMinor: 1234 },
    ];
    const created = await Promise.all(
      examples.map((example, index) =>
        prismaModule.prisma.transaction.create({
          data: {
            householdId: household.id,
            accountId: creditAccount.id,
            sourceType: "CSV_IMPORT",
            originalDescription: example.description,
            originalAmountText: String(example.amountMinor),
            originalDateText: "07/18/2026",
            normalizedMerchant: example.description,
            amountMinor: example.amountMinor,
            transactionDate: new Date(`2026-07-${String(10 + index).padStart(2, "0")}T12:00:00Z`),
            type: "UNKNOWN",
            reviewStatus: "FLAGGED",
            typeSource: "IMPORT_REPAIR_REVIEW",
            reviewSource: "IMPORT_DEFAULT",
            isDemo: true,
          },
        }),
      ),
    );

    const result = await bulk.bulkUpdateTransactions({
      transactionIds: created.map((transaction) => transaction.id),
      action: "APPLY_REVIEW_RECOMMENDATIONS",
      confirmation: "CONFIRM BULK CHANGE",
    });
    expect(result).toMatchObject({ selected: 4, changed: 3, skipped: 1 });
    const updated = await prismaModule.prisma.transaction.findMany({
      where: { id: { in: created.map((transaction) => transaction.id) } },
      orderBy: { transactionDate: "asc" },
    });
    expect(updated[0]).toMatchObject({
      type: "CREDIT_CARD_PAYMENT",
      reviewStatus: "REVIEWED",
      affectsIncomeSpendingReports: false,
    });
    expect(updated[1]).toMatchObject({
      type: "REFUND",
      reviewStatus: "REVIEWED",
      affectsIncomeSpendingReports: true,
    });
    expect(updated[2]).toMatchObject({
      type: "FEE",
      reviewStatus: "REVIEWED",
      affectsIncomeSpendingReports: true,
    });
    expect(updated[3]).toMatchObject({ type: "UNKNOWN", reviewStatus: "FLAGGED" });
  });
  it("start fresh removes rules", async () => {
    await repositories.startFreshWorkspace({ confirmation: "START FRESH" });
    expect(await prismaModule.prisma.merchantRule.count()).toBe(0);
  });
});
