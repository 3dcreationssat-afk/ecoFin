// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-recurring.db";

let recurring: typeof import("./recurring");
let imports: typeof import("./imports");
let prismaModule: typeof import("@/server/db/prisma");

describe("recurring expense service", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-recurring.db" },
    });
    recurring = await import("./recurring");
    imports = await import("./imports");
    prismaModule = await import("@/server/db/prisma");
  }, 120_000);

  afterAll(async () => {
    await prismaModule?.prisma.$disconnect();
  });

  it("scans idempotently, records evidence, confirms, rejects, and audits", async () => {
    const first = await recurring.scanRecurringExpenses();
    const second = await recurring.scanRecurringExpenses();
    expect(first.createdCount).toBeGreaterThanOrEqual(2);
    expect(second.createdCount).toBe(0);
    const suggested = await prismaModule.prisma.recurringExpense.findMany({
      where: { status: "SUGGESTED" },
      include: { transactions: true },
    });
    expect(suggested.some((item) => item.transactions.length >= 3)).toBe(true);
    const confirmable = suggested[0];
    await recurring.confirmRecurringExpense(confirmable.id, { notes: "verified" });
    await expect(
      recurring.rejectRecurringExpense(confirmable.id, { notes: "changed mind" }),
    ).resolves.toMatchObject({ status: "REJECTED" });
    const audits = await prismaModule.prisma.auditLog.findMany({
      where: { entityType: "RecurringExpense", entityId: confirmable.id },
    });
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(["candidate_created", "candidate_confirmed", "candidate_rejected"]),
    );
  });

  it("supports manual creation, updates, cancellation, reactivation, savings, and quality counts", async () => {
    const household = await prismaModule.prisma.household.findFirstOrThrow();
    const category = await prismaModule.prisma.category.findFirstOrThrow({
      where: { householdId: household.id, type: "EXPENSE" },
    });
    const manual = await recurring.createManualRecurringExpense({
      householdId: household.id,
      displayName: "Manual Gym",
      merchantPattern: "Manual Gym",
      serviceName: "Gym",
      categoryId: category.id,
      frequency: "MONTHLY",
      typicalAmountMinor: 3999,
      classification: "OPTIONAL",
      recommendation: "CONSIDER_CANCELING",
      recurringType: "MEMBERSHIP",
    });
    expect(manual.status).toBe("CONFIRMED");
    await recurring.updateRecurringExpense(manual.id, {
      displayName: "Manual Gym Updated",
      recommendation: "REVIEW",
    });
    await recurring.markRecurringCanceled(manual.id, {
      confirmation: "MARK CANCELED",
      canceledAt: "2026-07-12",
      reactivateOnFutureMatch: true,
    });
    const reactivated = await recurring.reactivateRecurringExpense(manual.id, {});
    expect(reactivated.status).toBe("CONFIRMED");
    const savings = await recurring.selectedCancellationSavings({ ids: [manual.id] });
    expect(savings.monthlySavingsMinor).toBe(3999);
    const quality = await recurring.recurringDataQuality();
    expect(quality.unlinkedRecurringTransactions).toBeGreaterThanOrEqual(0);
  });

  it("keeps dashboard payloads bounded and revalidates confirmed patterns that become ineligible", async () => {
    await recurring.scanRecurringExpenses();
    const workspaceBefore = await prismaModule.prisma.workspaceMetadata.findFirstOrThrow();
    const transactionCountBefore = await prismaModule.prisma.transaction.count();
    const dashboard = await recurring.recurringDashboard();
    expect((await prismaModule.prisma.workspaceMetadata.findFirstOrThrow()).id).toBe(
      workspaceBefore.id,
    );
    expect(await prismaModule.prisma.transaction.count()).toBe(transactionCountBefore);
    expect(dashboard.items.every((item) => "supportCount" in item && !("support" in item))).toBe(
      true,
    );
    const priceIncrease = dashboard.items.find((item) => item.priceChangeAmountMinor > 0);
    if (priceIncrease) {
      expect(priceIncrease.priceChangePreviousAmountMinor).toBeGreaterThan(0);
      expect(priceIncrease.priceChangeCurrentAmountMinor).toBeGreaterThan(
        priceIncrease.priceChangePreviousAmountMinor ?? 0,
      );
      expect(
        (priceIncrease.priceChangeCurrentAmountMinor ?? 0) -
          (priceIncrease.priceChangePreviousAmountMinor ?? 0),
      ).toBe(priceIncrease.priceChangeAmountMinor);
    }
    const candidate = await prismaModule.prisma.recurringExpense.findFirstOrThrow({
      where: { status: "SUGGESTED" },
      include: { transactions: true },
    });
    const evidence = await recurring.recurringEvidence(candidate.id);
    expect(evidence.support).toHaveLength(candidate.transactions.length);
    await recurring.confirmRecurringExpense(candidate.id, {});
    await prismaModule.prisma.transaction.updateMany({
      where: { recurringLinks: { some: { recurringExpenseId: candidate.id } } },
      data: { amountMinor: 1 },
    });
    await recurring.scanRecurringExpenses();
    expect(
      await prismaModule.prisma.recurringExpense.findUniqueOrThrow({ where: { id: candidate.id } }),
    ).toMatchObject({ status: "NEEDS_REVIEW" });
    expect(
      await prismaModule.prisma.scheduledObligation.findFirst({
        where: { recurringExpenseId: candidate.id },
      }),
    ).toMatchObject({ active: false });
  });

  it("runs after import confirmation and removes links when imported rows are undone", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts.find((item) => item.type === "CHECKING")!;
    const content = [
      "Date,Description,Amount",
      "04/15/2026,Synthetic Streaming,-8.99",
      "05/15/2026,Synthetic Streaming,-8.99",
      "06/15/2026,Synthetic Streaming,-8.99",
    ].join("\n");
    const validated = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-recurring.csv",
      fileSize: content.length,
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        saveProfile: false,
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
      },
    });
    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      confirm: "IMPORT CSV",
    });
    const summary = JSON.parse(imported.summaryJson ?? "{}") as {
      recurringCandidatesFound?: number;
    };
    expect(summary.recurringCandidatesFound).toBeGreaterThan(0);
    const links = await prismaModule.prisma.recurringExpenseTransaction.count({
      where: { transaction: { importBatchId: imported.id } },
    });
    expect(links).toBeGreaterThan(0);
    const importedCandidate = await prismaModule.prisma.recurringExpense.findFirstOrThrow({
      where: { merchantKey: "synthetic streaming" },
    });
    await imports.undoImportBatch(imported.id, { confirm: "UNDO IMPORT" });
    expect(
      await prismaModule.prisma.recurringExpenseTransaction.count({
        where: { transaction: { importBatchId: imported.id } },
      }),
    ).toBe(0);
    await recurring.scanRecurringExpenses();
    expect(
      await prismaModule.prisma.recurringExpense.findUniqueOrThrow({
        where: { id: importedCandidate.id },
      }),
    ).toMatchObject({ status: "INACTIVE", nextExpectedDate: null });
    expect(
      await prismaModule.prisma.auditLog.findFirst({
        where: {
          entityType: "RecurringExpense",
          entityId: importedCandidate.id,
          action: "candidate_inactivated",
        },
      }),
    ).toBeTruthy();
  });
});
