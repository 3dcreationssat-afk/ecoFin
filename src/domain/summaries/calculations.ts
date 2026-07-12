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

export type TransactionSummaryInput = {
  amountMinor: number;
  type?: string | null;
  categoryId?: string | null;
  excluded?: boolean | null;
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

export function householdTransactionSummary(transactions: TransactionSummaryInput[]) {
  const included = transactions.filter((transaction) => !transaction.excluded);
  const householdIncomeMinor = included
    .filter((transaction) => ["CREDIT", "INCOME"].includes(transaction.type ?? ""))
    .reduce((total, transaction) => total + Math.max(transaction.amountMinor, 0), 0);
  const householdSpendingMinor = included
    .filter((transaction) =>
      ["DEBIT", "EXPENSE", "FEE", "INTEREST"].includes(transaction.type ?? ""),
    )
    .reduce((total, transaction) => total + Math.abs(Math.min(transaction.amountMinor, 0)), 0);
  const transferMovementMinor = included
    .filter((transaction) => ["TRANSFER_IN", "TRANSFER_OUT"].includes(transaction.type ?? ""))
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  return {
    householdIncomeMinor,
    householdSpendingMinor,
    transferMovementMinor,
    accountActivityMinor: included.reduce(
      (total, transaction) => total + Math.abs(transaction.amountMinor),
      0,
    ),
  };
}

export function dataQualityRules(input: {
  transactions: { categoryId?: string | null; reviewStatus: string; type?: string | null }[];
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
  importBatches?: {
    status: string;
    rejectedRowCount: number;
    duplicateCandidateCount: number;
    repeatedFile?: boolean;
  }[];
  transfers?: {
    suggestedHigh: number;
    creditCard: number;
    broken: number;
    rejected: number;
    markedWithoutMatch: number;
    excludedCandidates: number;
  };
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
  const importBatches = input.importBatches ?? [];
  const failedImportBatches = importBatches.filter((batch) => batch.status === "FAILED").length;
  const partialImportBatches = importBatches.filter(
    (batch) => batch.status === "PARTIALLY_IMPORTED",
  ).length;
  const invalidImportRows = importBatches.reduce(
    (total, batch) => total + batch.rejectedRowCount,
    0,
  );
  const duplicateImportCandidates = importBatches.reduce(
    (total, batch) => total + batch.duplicateCandidateCount,
    0,
  );
  const repeatedFileAttempts = importBatches.filter((batch) => batch.repeatedFile).length;
  const unknownTypeTransactions = input.transactions.filter(
    (transaction) =>
      !transaction.type ||
      ![
        "DEBIT",
        "CREDIT",
        "INCOME",
        "EXPENSE",
        "TRANSFER_OUT",
        "TRANSFER_IN",
        "REFUND",
        "FEE",
        "INTEREST",
      ].includes(transaction.type),
  ).length;
  const transfers = input.transfers ?? {
    suggestedHigh: 0,
    creditCard: 0,
    broken: 0,
    rejected: 0,
    markedWithoutMatch: 0,
    excludedCandidates: 0,
  };
  return {
    uncategorized,
    unreviewed,
    staleAccounts,
    missingDebtTerms,
    incompleteGoals,
    failedImportBatches,
    partialImportBatches,
    invalidImportRows,
    duplicateImportCandidates,
    repeatedFileAttempts,
    unknownTypeTransactions,
    highConfidenceTransferCandidates: transfers.suggestedHigh,
    possibleCreditCardPayments: transfers.creditCard,
    brokenTransferRelationships: transfers.broken,
    rejectedTransferCandidates: transfers.rejected,
    transferMarkedWithoutCounterpart: transfers.markedWithoutMatch,
    excludedTransferCandidates: transfers.excludedCandidates,
  };
}
