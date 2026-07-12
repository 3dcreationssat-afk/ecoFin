export type AccountSummaryInput = {
  ledgerBalanceMinor: number | null;
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
  affectsIncomeSpendingReports?: boolean | null;
  transactionDate?: Date | string;
};

export type CategorySummaryInput = {
  id: string;
  name: string;
  group: string;
  type: string;
  budgetMinor: number;
  sortOrder: number;
  archivedAt?: Date | string | null;
};

export function accountSummaries(accounts: AccountSummaryInput[]) {
  const active = accounts.filter((account) => !account.archivedAt);
  const cashAccounts = active.filter((account) =>
    ["CHECKING", "SAVINGS", "OTHER"].includes(account.type),
  );
  const totalAssetsMinor = active
    .filter((account) => !["CREDIT", "LOAN", "MORTGAGE"].includes(account.type))
    .reduce((total, account) => total + Math.max(account.ledgerBalanceMinor ?? 0, 0), 0);
  const totalDebtsMinor = active
    .filter((account) => ["CREDIT", "LOAN", "MORTGAGE"].includes(account.type))
    .reduce((total, account) => total + Math.max(account.ledgerBalanceMinor ?? 0, 0), 0);
  return {
    availableCashMinor: cashAccounts.reduce(
      (total, account) => total + Math.max(account.ledgerBalanceMinor ?? 0, 0),
      0,
    ),
    cashAccountCount: cashAccounts.length,
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
  const included = includedTransactions(transactions);
  return summarizeTransactions(included);
}

export function currentPeriodSummary(
  transactions: TransactionSummaryInput[],
  asOf = inferredAsOf(transactions),
) {
  const current = monthBounds(asOf);
  const priorAsOf = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1));
  const prior = monthBounds(priorAsOf);
  const currentTransactions = includedTransactions(transactions).filter((transaction) =>
    inRange(transaction.transactionDate, current.start, current.end),
  );
  const priorTransactions = includedTransactions(transactions).filter((transaction) =>
    inRange(transaction.transactionDate, prior.start, prior.end),
  );
  return {
    asOf,
    currentPeriod: current,
    priorPeriod: prior,
    currentSummary: summarizeTransactions(currentTransactions),
    priorSummary: summarizeTransactions(priorTransactions),
  };
}

export function categoryBudgetSummaries(
  categories: CategorySummaryInput[],
  transactions: TransactionSummaryInput[],
  asOf = inferredAsOf(transactions),
) {
  const period = monthBounds(asOf);
  const elapsedDays = Math.max(1, asOf.getUTCDate());
  const daysInMonth = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const included = includedTransactions(transactions).filter((transaction) =>
    inRange(transaction.transactionDate, period.start, period.end),
  );
  return categories
    .filter((category) => !category.archivedAt && category.type === "EXPENSE")
    .map((category) => {
      const actualMinor = included
        .filter(
          (transaction) =>
            transaction.categoryId === category.id &&
            ["DEBIT", "EXPENSE", "FEE", "INTEREST"].includes(transaction.type ?? ""),
        )
        .reduce((total, transaction) => total + Math.abs(Math.min(transaction.amountMinor, 0)), 0);
      const forecastMinor = Math.round((actualMinor * daysInMonth) / elapsedDays);
      const remainingMinor = category.budgetMinor - actualMinor;
      const usedPercent =
        category.budgetMinor <= 0 ? 0 : Math.round((actualMinor / category.budgetMinor) * 100);
      return {
        id: category.id,
        name: category.name,
        group: category.group,
        sortOrder: category.sortOrder,
        budgetMinor: category.budgetMinor,
        actualMinor,
        forecastMinor,
        remainingMinor,
        usedPercent,
        status:
          forecastMinor > category.budgetMinor
            ? "Projected over"
            : usedPercent >= 90
              ? "Approaching limit"
              : "On track",
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.sortOrder - b.sortOrder);
}

function summarizeTransactions(included: TransactionSummaryInput[]) {
  const householdIncomeMinor = included
    .filter((transaction) => ["CREDIT", "INCOME"].includes(transaction.type ?? ""))
    .reduce((total, transaction) => total + Math.max(transaction.amountMinor, 0), 0);
  const ordinarySpendingMinor = included
    .filter((transaction) =>
      ["DEBIT", "EXPENSE", "FEE", "INTEREST"].includes(transaction.type ?? ""),
    )
    .reduce((total, transaction) => total + Math.abs(Math.min(transaction.amountMinor, 0)), 0);
  const refundMinor = included
    .filter((transaction) => transaction.type === "REFUND")
    .reduce((total, transaction) => total + Math.max(transaction.amountMinor, 0), 0);
  const householdSpendingMinor = Math.max(0, ordinarySpendingMinor - refundMinor);
  const transferMovementMinor = included
    .filter((transaction) => ["TRANSFER_IN", "TRANSFER_OUT"].includes(transaction.type ?? ""))
    .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
  return {
    householdIncomeMinor,
    householdSpendingMinor,
    netCashFlowMinor: householdIncomeMinor - householdSpendingMinor,
    transferMovementMinor,
    accountActivityMinor: included.reduce(
      (total, transaction) => total + Math.abs(transaction.amountMinor),
      0,
    ),
  };
}

function includedTransactions(transactions: TransactionSummaryInput[]) {
  return transactions.filter(
    (transaction) => !transaction.excluded && transaction.affectsIncomeSpendingReports !== false,
  );
}

function monthBounds(asOf: Date) {
  return {
    start: new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)),
    end: new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1)),
  };
}

function inRange(value: Date | string | undefined, start: Date, end: Date) {
  if (!value) return false;
  const date = new Date(value);
  return date >= start && date < end;
}

function inferredAsOf(transactions: TransactionSummaryInput[]) {
  const latest = transactions
    .map((transaction) =>
      transaction.transactionDate ? new Date(transaction.transactionDate).getTime() : Number.NaN,
    )
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  return Number.isFinite(latest) ? new Date(latest) : new Date();
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
  recurring?: {
    unconfirmed: number;
    lowConfidence: number;
    withoutCategory: number;
    priceIncreases: number;
    chargesAfterCanceled: number;
    missingExpected: number;
    duplicateServices: number;
    unlinkedRecurringTransactions: number;
    inactiveStillActive: number;
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
  const recurring = input.recurring ?? {
    unconfirmed: 0,
    lowConfidence: 0,
    withoutCategory: 0,
    priceIncreases: 0,
    chargesAfterCanceled: 0,
    missingExpected: 0,
    duplicateServices: 0,
    unlinkedRecurringTransactions: 0,
    inactiveStillActive: 0,
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
    unconfirmedRecurringCandidates: recurring.unconfirmed,
    lowConfidenceRecurringCandidates: recurring.lowConfidence,
    recurringWithoutCategory: recurring.withoutCategory,
    recurringPriceIncreases: recurring.priceIncreases,
    recurringChargesAfterCanceled: recurring.chargesAfterCanceled,
    recurringMissingExpectedCharge: recurring.missingExpected,
    duplicateRecurringServices: recurring.duplicateServices,
    unlinkedRecurringExpenseTransactions: recurring.unlinkedRecurringTransactions,
    inactiveRecurringStillExpected: recurring.inactiveStillActive,
  };
}
