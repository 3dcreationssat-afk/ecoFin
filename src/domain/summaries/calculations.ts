export type AccountSummaryInput = {
  balanceMinor: number;
  type: string;
  archivedAt?: Date | string | null;
};

export type GoalSummaryInput = {
  targetMinor: number;
  currentMinor: number;
  plannedMonthlyMinor: number;
  archivedAt?: Date | string | null;
};

export function accountSummaries(accounts: AccountSummaryInput[]) {
  const active = accounts.filter((account) => !account.archivedAt);
  const totalAssetsMinor = active
    .filter((account) => account.balanceMinor > 0)
    .reduce((total, account) => total + account.balanceMinor, 0);
  const totalDebtsMinor = active
    .filter((account) => account.balanceMinor < 0)
    .reduce((total, account) => total + Math.abs(account.balanceMinor), 0);
  return {
    totalAssetsMinor,
    totalDebtsMinor,
    netWorthMinor: totalAssetsMinor - totalDebtsMinor,
    activeCount: active.length,
  };
}

export function goalSummaries(goals: GoalSummaryInput[]) {
  const active = goals.filter((goal) => !goal.archivedAt);
  const totalSavedMinor = active.reduce((total, goal) => total + goal.currentMinor, 0);
  const totalTargetMinor = active.reduce((total, goal) => total + goal.targetMinor, 0);
  const plannedMonthlyMinor = active.reduce((total, goal) => total + goal.plannedMonthlyMinor, 0);
  return {
    totalSavedMinor,
    totalTargetMinor,
    plannedMonthlyMinor,
    progressPercent:
      totalTargetMinor === 0 ? 0 : Math.round((totalSavedMinor / totalTargetMinor) * 100),
  };
}

export function goalProgress(goal: GoalSummaryInput) {
  return goal.targetMinor === 0
    ? 0
    : Math.min(100, Math.round((goal.currentMinor / goal.targetMinor) * 100));
}

export function dataQualityRules(input: {
  transactions: { categoryId?: string | null; reviewStatus: string }[];
  accounts: {
    lastUpdated: Date;
    type: string;
    aprBasisPoints?: number | null;
    minimumPaymentMinor?: number | null;
  }[];
  goals: {
    linkedAccountId?: string | null;
    targetMinor: number;
    archivedAt?: Date | string | null;
  }[];
  asOf: Date;
}) {
  const staleBefore = new Date(input.asOf);
  staleBefore.setDate(staleBefore.getDate() - 10);
  const uncategorized = input.transactions.filter((transaction) => !transaction.categoryId).length;
  const unreviewed = input.transactions.filter(
    (transaction) => transaction.reviewStatus !== "REVIEWED",
  ).length;
  const staleAccounts = input.accounts.filter(
    (account) => account.lastUpdated < staleBefore,
  ).length;
  const missingDebtTerms = input.accounts.filter(
    (account) =>
      ["CREDIT", "LOAN", "MORTGAGE"].includes(account.type) &&
      (account.aprBasisPoints == null || account.minimumPaymentMinor == null),
  ).length;
  const incompleteGoals = input.goals.filter(
    (goal) => !goal.archivedAt && (goal.targetMinor <= 0 || !goal.linkedAccountId),
  ).length;
  return { uncategorized, unreviewed, staleAccounts, missingDebtTerms, incompleteGoals };
}
