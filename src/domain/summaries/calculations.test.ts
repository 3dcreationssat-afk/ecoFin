import { describe, expect, it } from "vitest";
import { accountSummaries, dataQualityRules, goalProgress, goalSummaries } from "./calculations";

describe("summary calculations", () => {
  it("calculates assets, debts, and net worth from active accounts", () => {
    expect(
      accountSummaries([
        { balanceMinor: 10000, type: "CHECKING" },
        { balanceMinor: -2500, type: "CREDIT" },
        { balanceMinor: 999999, type: "SAVINGS", archivedAt: new Date() },
      ]),
    ).toEqual({
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
    });
  });
});
