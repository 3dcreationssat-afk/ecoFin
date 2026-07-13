import { describe, expect, it } from "vitest";
import {
  accountSummaries,
  categoryBudgetSummaries,
  currentPeriodSummary,
  dataQualityRules,
  goalProgress,
  goalSummaries,
  householdTransactionSummary,
} from "./calculations";

describe("summary calculations", () => {
  it("calculates assets, debts, and net worth from active accounts", () => {
    expect(
      accountSummaries([
        { ledgerBalanceMinor: 10000, type: "CHECKING" },
        { ledgerBalanceMinor: 2500, type: "CREDIT" },
        { ledgerBalanceMinor: 999999, type: "SAVINGS", archivedAt: new Date() },
      ]),
    ).toEqual({
      availableCashMinor: 10000,
      cashAccountCount: 1,
      totalAssetsMinor: 10000,
      totalDebtsMinor: 2500,
      netWorthMinor: 7500,
      activeCount: 2,
    });
  });

  it("calculates goal totals and progress", () => {
    const goals = [
      { targetMinor: 10000, currentMinor: 2500, plannedMonthlyMinor: 1000 },
      { targetMinor: 30000, currentMinor: 7500, plannedMonthlyMinor: 2000 },
    ];
    expect(goalSummaries(goals)).toEqual({
      totalSavedMinor: 10000,
      totalTargetMinor: 40000,
      plannedMonthlyMinor: 3000,
      progressPercent: 25,
    });
    expect(goalProgress(goals[0])).toBe(25);
  });

  it("excludes confirmed transfers from household income and spending while preserving account activity", () => {
    expect(
      householdTransactionSummary([
        { amountMinor: 325000, type: "INCOME" },
        { amountMinor: -8742, type: "EXPENSE" },
        { amountMinor: -50000, type: "TRANSFER_OUT" },
        { amountMinor: 50000, type: "TRANSFER_IN" },
        { amountMinor: -1000, type: "FEE" },
      ]),
    ).toEqual({
      householdIncomeMinor: 325000,
      householdSpendingMinor: 9742,
      netCashFlowMinor: 315258,
      transferMovementMinor: 100000,
      accountActivityMinor: 434742,
    });
  });

  it("treats refunds as spending reversals without classifying them as income", () => {
    expect(
      householdTransactionSummary([
        { amountMinor: -10000, type: "EXPENSE" },
        { amountMinor: 2500, type: "REFUND" },
      ]),
    ).toMatchObject({
      householdIncomeMinor: 0,
      householdSpendingMinor: 7500,
      netCashFlowMinor: -7500,
    });
  });

  it("keeps card purchases out of income, credits out of spending, and matched payments out of both", () => {
    expect(
      householdTransactionSummary([
        { amountMinor: -5000, type: "DEBIT" },
        { amountMinor: 1200, type: "REFUND" },
        {
          amountMinor: 5000,
          type: "TRANSFER_IN",
          affectsIncomeSpendingReports: false,
        },
        {
          amountMinor: -5000,
          type: "TRANSFER_OUT",
          affectsIncomeSpendingReports: false,
        },
      ]),
    ).toMatchObject({
      householdIncomeMinor: 0,
      householdSpendingMinor: 3800,
      netCashFlowMinor: -3800,
    });
  });

  it("summarizes current and prior periods from dated transactions", () => {
    const result = currentPeriodSummary(
      [
        { amountMinor: 200000, type: "INCOME", transactionDate: "2026-07-05" },
        { amountMinor: -50000, type: "EXPENSE", transactionDate: "2026-07-06" },
        { amountMinor: -10000, type: "TRANSFER_OUT", transactionDate: "2026-07-07" },
        { amountMinor: 100000, type: "INCOME", transactionDate: "2026-06-05" },
        { amountMinor: -25000, type: "EXPENSE", transactionDate: "2026-06-06" },
      ],
      new Date("2026-07-12T00:00:00.000Z"),
    );
    expect(result.currentSummary).toMatchObject({
      householdIncomeMinor: 200000,
      householdSpendingMinor: 50000,
      netCashFlowMinor: 150000,
      transferMovementMinor: 10000,
    });
    expect(result.priorSummary).toMatchObject({
      householdIncomeMinor: 100000,
      householdSpendingMinor: 25000,
      netCashFlowMinor: 75000,
    });
  });

  it("derives category budget actuals and current-pace forecasts", () => {
    const [row] = categoryBudgetSummaries(
      [
        {
          id: "groceries",
          name: "Groceries",
          group: "Essential Variable",
          type: "EXPENSE",
          budgetMinor: 60000,
          sortOrder: 1,
        },
      ],
      [
        {
          amountMinor: -30000,
          type: "EXPENSE",
          categoryId: "groceries",
          transactionDate: "2026-07-06",
        },
        {
          amountMinor: -9999,
          type: "TRANSFER_OUT",
          categoryId: "groceries",
          transactionDate: "2026-07-06",
        },
      ],
      new Date("2026-07-15T00:00:00.000Z"),
    );
    expect(row).toMatchObject({
      actualMinor: 30000,
      forecastMinor: 62000,
      remainingMinor: 30000,
      usedPercent: 50,
      status: "Projected over",
    });
  });

  it("runs deterministic data-quality rules without pretending advanced detection exists", () => {
    const result = dataQualityRules({
      transactions: [
        { categoryId: null, reviewStatus: "NEEDS_REVIEW", type: "DEBIT" },
        { categoryId: "cat", reviewStatus: "REVIEWED", type: "UNKNOWN" },
      ],
      accounts: [
        {
          lastUpdated: new Date("2026-06-20"),
          type: "CREDIT",
          aprBasisPoints: null,
          minimumPaymentMinor: null,
        },
      ],
      goals: [{ linkedAccountId: null, targetMinor: 1000 }],
      importBatches: [
        {
          status: "FAILED",
          rejectedRowCount: 2,
          duplicateCandidateCount: 1,
          repeatedFile: true,
        },
        {
          status: "PARTIALLY_IMPORTED",
          rejectedRowCount: 1,
          duplicateCandidateCount: 3,
        },
      ],
      transfers: {
        suggestedHigh: 2,
        creditCard: 1,
        broken: 1,
        rejected: 3,
        markedWithoutMatch: 4,
        excludedCandidates: 1,
      },
      recurring: {
        unconfirmed: 2,
        lowConfidence: 1,
        withoutCategory: 3,
        priceIncreases: 4,
        chargesAfterCanceled: 1,
        missingExpected: 2,
        duplicateServices: 1,
        unlinkedRecurringTransactions: 5,
        inactiveStillActive: 1,
      },
      asOf: new Date("2026-07-11"),
    });
    expect(result).toEqual({
      uncategorized: 1,
      unreviewed: 1,
      staleAccounts: 1,
      missingDebtTerms: 1,
      incompleteGoals: 1,
      failedImportBatches: 1,
      partialImportBatches: 1,
      invalidImportRows: 3,
      duplicateImportCandidates: 4,
      repeatedFileAttempts: 1,
      unknownTypeTransactions: 1,
      highConfidenceTransferCandidates: 2,
      possibleCreditCardPayments: 1,
      brokenTransferRelationships: 1,
      rejectedTransferCandidates: 3,
      transferMarkedWithoutCounterpart: 4,
      excludedTransferCandidates: 1,
      unconfirmedRecurringCandidates: 2,
      lowConfidenceRecurringCandidates: 1,
      recurringWithoutCategory: 3,
      recurringPriceIncreases: 4,
      recurringChargesAfterCanceled: 1,
      recurringMissingExpectedCharge: 2,
      duplicateRecurringServices: 1,
      unlinkedRecurringExpenseTransactions: 5,
      inactiveRecurringStillExpected: 1,
    });
  });
});
