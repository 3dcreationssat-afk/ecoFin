import { categoryBudgetSummaries } from "@/domain/summaries/calculations";

export type OverviewSeverity = "Critical" | "Warning" | "Information";

export type OverviewActionItem = {
  id: string;
  type: string;
  severity: OverviewSeverity;
  title: string;
  explanation: string;
  impact: string;
  actionLabel: string;
  href: string;
  entityId?: string;
};

export type UpcomingObligation = {
  id: string;
  displayName: string;
  amountMinor: number;
  dueDate: Date;
  accountName: string | null;
  obligationType: "Debt minimum" | "Credit-card minimum" | "Recurring expense";
  sourceType: "account" | "recurring";
  sourceId: string;
  confidence: "High" | "Medium" | "Low";
  reservedStatus: "Planned" | "Not specifically reserved" | "Unknown";
  explanation?: string;
};

export type OverviewCategorySpending = {
  id: string;
  name: string;
  actualMinor: number;
  budgetMinor: number;
  differenceMinor: number;
  usedPercent: number;
  status: "Over budget" | "Approaching budget" | "On track" | "No budget";
  href: string;
};

export type OverviewGoalSnapshot = {
  id: string;
  name: string;
  currentMinor: number;
  targetMinor: number;
  progressPercent: number;
  status:
    | "On track"
    | "At risk"
    | "Behind"
    | "Completed"
    | "Missing target date"
    | "Missing contribution plan";
  targetDate: Date | null;
  plannedMonthlyMinor: number;
  requiredMonthlyMinor: number;
  href: string;
};

export type OverviewDebtSnapshot = {
  totalDebtMinor: number;
  monthlyMinimumsMinor: number;
  highestAprBasisPoints: number | null;
  strategy: string;
  recommendedDebt: {
    id: string;
    name: string;
    balanceMinor: number;
    aprBasisPoints: number | null;
    href: string;
  } | null;
  recommendationNote: string;
};

export type OverviewDashboard = {
  asOf: Date;
  actionItems: OverviewActionItem[];
  visibleActionItems: OverviewActionItem[];
  upcomingObligations: UpcomingObligation[];
  categorySpending: OverviewCategorySpending[];
  goals: OverviewGoalSnapshot[];
  debt: OverviewDebtSnapshot;
};

type AccountInput = {
  id: string;
  name: string;
  type: string;
  balanceMinor: number;
  aprBasisPoints?: number | null;
  minimumPaymentMinor?: number | null;
  dueDay?: number | null;
  lastUpdated: Date | string;
  archivedAt?: Date | string | null;
  status?: string | null;
};

type CategoryInput = {
  id: string;
  name: string;
  group: string;
  type: string;
  budgetMinor: number;
  sortOrder: number;
  archivedAt?: Date | string | null;
};

type TransactionInput = {
  id: string;
  amountMinor: number;
  type?: string | null;
  categoryId?: string | null;
  excluded?: boolean | null;
  transactionDate?: Date | string;
  reviewStatus?: string | null;
  possibleDuplicate?: boolean | null;
  normalizedMerchant?: string | null;
};

type GoalInput = {
  id: string;
  name: string;
  targetMinor: number;
  currentMinor: number;
  plannedMonthlyMinor: number;
  requiredMonthlyMinor: number;
  priority?: number | null;
  status?: string | null;
  targetDate?: Date | string | null;
  archivedAt?: Date | string | null;
};

type ImportBatchInput = {
  id: string;
  status: string;
  originalFilename?: string | null;
  rejectedRowCount: number;
  duplicateCandidateCount: number;
  repeatedFile?: boolean | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

type TransferMatchInput = {
  id: string;
  status: string;
  confidence: string;
  score: number;
  incomingTransaction?: { account?: { type: string } | null } | null;
};

type RecurringInput = {
  id: string;
  displayName: string;
  serviceName?: string | null;
  typicalAmountMinor: number;
  monthlyEquivalentMinor: number;
  confidence: string;
  confidenceScore: number;
  status: string;
  nextExpectedDate?: Date | string | null;
  priceChangeAmountMinor: number;
  canceledAt?: Date | string | null;
};

export type OverviewDashboardInput = {
  household: {
    checkingBufferMinor: number;
    debtStrategy: string;
    accounts: AccountInput[];
    categories: CategoryInput[];
    transactions: TransactionInput[];
    goals: GoalInput[];
    importBatches?: ImportBatchInput[];
    transferMatches?: TransferMatchInput[];
    recurringExpenses?: RecurringInput[];
  };
  asOf?: Date;
  visibleActionLimit?: number;
};

const EXPENSE_TYPES = new Set(["DEBIT", "EXPENSE", "FEE", "INTEREST"]);
const DEBT_TYPES = new Set(["CREDIT", "LOAN", "MORTGAGE"]);

export function buildOverviewDashboard(input: OverviewDashboardInput): OverviewDashboard {
  const asOf = input.asOf ?? inferredAsOf(input.household.transactions);
  const actionItems = buildActionItems(input.household, asOf);
  return {
    asOf,
    actionItems,
    visibleActionItems: actionItems.slice(0, input.visibleActionLimit ?? 6),
    upcomingObligations: buildUpcomingObligations(input.household, asOf),
    categorySpending: buildCategorySpending(input.household, asOf),
    goals: buildGoalSnapshots(input.household.goals),
    debt: buildDebtSnapshot(input.household),
  };
}

function buildActionItems(
  household: OverviewDashboardInput["household"],
  asOf: Date,
): OverviewActionItem[] {
  const items: OverviewActionItem[] = [];
  const activeAccounts = household.accounts.filter(isActive);
  const transactions = household.transactions.filter((transaction) => !transaction.excluded);
  const uncategorized = transactions.filter(
    (transaction) => !transaction.categoryId && EXPENSE_TYPES.has(transaction.type ?? ""),
  );
  const duplicateTransactions = transactions.filter((transaction) => transaction.possibleDuplicate);
  const transferMatches = household.transferMatches ?? [];
  const recurring = household.recurringExpenses ?? [];
  const importBatches = household.importBatches ?? [];

  const checkingBalanceMinor = activeAccounts
    .filter((account) => account.type === "CHECKING")
    .reduce((total, account) => total + account.balanceMinor, 0);
  if (household.checkingBufferMinor > 0 && checkingBalanceMinor < household.checkingBufferMinor) {
    items.push({
      id: "checking-buffer-risk",
      type: "checking-buffer-risk",
      severity: "Critical",
      title: "Checking balance is below buffer",
      explanation: "Current checking balances are below the configured household buffer.",
      impact: `Checking balance is short by ${household.checkingBufferMinor - checkingBalanceMinor} minor units.`,
      actionLabel: "Review cash flow",
      href: "/cash-flow",
    });
  }

  const soonDebt = buildDebtMinimumObligations(activeAccounts, asOf).filter(
    (obligation) => daysBetween(asOf, obligation.dueDate) <= 7,
  );
  for (const obligation of soonDebt.slice(0, 2)) {
    items.push({
      id: `upcoming-payment-${obligation.sourceId}`,
      type: "upcoming-payment",
      severity: "Warning",
      title: `${obligation.displayName} due soon`,
      explanation: `${obligation.obligationType} is due on ${isoDate(obligation.dueDate)}.`,
      impact: `Upcoming obligation: ${obligation.amountMinor} minor units.`,
      actionLabel: "Review debt",
      href: "/debt",
      entityId: obligation.sourceId,
    });
  }

  const highConfidenceTransfers = transferMatches.filter(
    (match) => match.status === "SUGGESTED" && match.confidence === "HIGH",
  );
  const creditCardPayments = highConfidenceTransfers.filter(
    (match) => match.incomingTransaction?.account?.type === "CREDIT",
  );
  if (creditCardPayments.length) {
    items.push({
      id: "credit-card-transfer-candidates",
      type: "credit-card-payment-candidate",
      severity: "Warning",
      title: `${creditCardPayments.length} possible credit-card payments`,
      explanation: "Card payments can distort income and spending until confirmed as transfers.",
      impact: "Affected calculation: household income, spending, and category totals.",
      actionLabel: "Match transfers",
      href: "/transactions#transfer-review",
    });
  } else if (highConfidenceTransfers.length) {
    items.push({
      id: "high-confidence-transfer-candidates",
      type: "transfer-candidate",
      severity: "Warning",
      title: `${highConfidenceTransfers.length} likely internal transfers`,
      explanation: "Likely transfers may be counted as income or spending until reviewed.",
      impact: "Affected calculation: household cash flow and spending totals.",
      actionLabel: "Match transfers",
      href: "/transactions#transfer-review",
    });
  }

  if (duplicateTransactions.length) {
    const first = duplicateTransactions.sort(byDateDescThenName)[0];
    items.push({
      id: "possible-duplicates",
      type: "possible-duplicate",
      severity: "Warning",
      title: `${duplicateTransactions.length} possible duplicate transactions`,
      explanation: first?.normalizedMerchant
        ? `${first.normalizedMerchant} and related rows may need duplicate review.`
        : "Imported rows may need duplicate review.",
      impact: "Affected calculation: account activity, spending, and reports.",
      actionLabel: "Review duplicates",
      href: "/transactions?status=FLAGGED",
      entityId: first?.id,
    });
  }

  if (uncategorized.length) {
    items.push({
      id: "uncategorized-transactions",
      type: "uncategorized-transactions",
      severity: "Warning",
      title: `${uncategorized.length} uncategorized transactions`,
      explanation: "Uncategorized expenses reduce spending and budget accuracy.",
      impact: "Affected calculation: spending by category and budget tracking.",
      actionLabel: "Categorize now",
      href: "/transactions?status=NEEDS_REVIEW",
    });
  }

  const unconfirmedRecurring = recurring.filter((item) =>
    ["SUGGESTED", "NEEDS_REVIEW"].includes(item.status),
  );
  if (unconfirmedRecurring.length) {
    items.push({
      id: "unconfirmed-recurring",
      type: "unconfirmed-recurring",
      severity: "Information",
      title: `${unconfirmedRecurring.length} recurring expenses need review`,
      explanation: "Detected recurring patterns are not confirmed obligations yet.",
      impact: "Affected calculation: upcoming obligations and recurring totals.",
      actionLabel: "Review recurring",
      href: "/recurring",
    });
  }

  const priceIncreases = recurring.filter(
    (item) => item.status !== "REJECTED" && item.priceChangeAmountMinor > 0,
  );
  if (priceIncreases.length) {
    const totalIncrease = priceIncreases.reduce(
      (total, item) => total + item.priceChangeAmountMinor,
      0,
    );
    items.push({
      id: "recurring-price-increases",
      type: "recurring-price-increase",
      severity: "Information",
      title: `${priceIncreases.length} recurring price increases`,
      explanation: "Recent recurring charges are higher than the prior pattern.",
      impact: `Observed increase: ${totalIncrease} minor units across flagged items.`,
      actionLabel: "Review recurring",
      href: "/recurring",
    });
  }

  const staleBefore = addDays(asOf, -30);
  const staleAccounts = activeAccounts.filter(
    (account) => new Date(account.lastUpdated) < staleBefore,
  );
  if (staleAccounts.length) {
    items.push({
      id: "stale-account-balances",
      type: "stale-account-balance",
      severity: "Information",
      title: `${staleAccounts.length} account balances may be stale`,
      explanation: "Accounts without recent updates lower dashboard confidence.",
      impact: "Affected calculation: available cash, debt, and net worth.",
      actionLabel: "Update accounts",
      href: "/accounts",
    });
  }

  const incompleteImports = importBatches.filter((batch) =>
    ["FAILED", "PARTIALLY_IMPORTED", "PREVIEW", "VALIDATED"].includes(batch.status),
  );
  if (incompleteImports.length) {
    items.push({
      id: "incomplete-imports",
      type: "incomplete-import",
      severity: "Information",
      title: `${incompleteImports.length} imports may need attention`,
      explanation: "Incomplete or failed imports can leave recent activity missing.",
      impact: "Affected calculation: balances, spending, and reports.",
      actionLabel: "Open imports",
      href: "/transactions",
    });
  }

  const underfundedGoals = household.goals.filter(
    (goal) =>
      isActive(goal) &&
      goal.targetMinor > goal.currentMinor &&
      goal.requiredMonthlyMinor > 0 &&
      goal.plannedMonthlyMinor < goal.requiredMonthlyMinor,
  );
  if (underfundedGoals.length) {
    items.push({
      id: "underfunded-goals",
      type: "goal-allocation",
      severity: "Information",
      title: `${underfundedGoals.length} goals need more monthly allocation`,
      explanation: "Planned contributions are below the required monthly amount.",
      impact: "Affected calculation: goal completion status.",
      actionLabel: "Review goals",
      href: "/goals",
    });
  }

  const missingDebtTerms = activeAccounts.filter(
    (account) =>
      DEBT_TYPES.has(account.type) &&
      account.balanceMinor < 0 &&
      (account.aprBasisPoints == null ||
        account.minimumPaymentMinor == null ||
        account.dueDay == null),
  );
  if (missingDebtTerms.length) {
    items.push({
      id: "missing-debt-terms",
      type: "missing-debt-metadata",
      severity: "Information",
      title: `${missingDebtTerms.length} debts are missing APR, minimum, or due date`,
      explanation: "Debt snapshots and obligations are less complete without account terms.",
      impact: "Affected calculation: debt recommendation and upcoming obligations.",
      actionLabel: "Update accounts",
      href: "/accounts",
    });
  }

  const highAprDebt = activeAccounts.filter(
    (account) =>
      DEBT_TYPES.has(account.type) &&
      account.balanceMinor < 0 &&
      (account.aprBasisPoints ?? 0) >= 2000,
  );
  if (highAprDebt.length) {
    items.push({
      id: "high-apr-debt",
      type: "high-apr-debt",
      severity: "Information",
      title: `${highAprDebt.length} debts have APR at or above 20%`,
      explanation: "High APR debts may deserve priority under avalanche strategy.",
      impact: "Affected calculation: recommended next debt.",
      actionLabel: "Review debt",
      href: "/debt",
    });
  }

  return items.sort(actionOrder);
}

function buildUpcomingObligations(
  household: OverviewDashboardInput["household"],
  asOf: Date,
): UpcomingObligation[] {
  const activeAccounts = household.accounts.filter(isActive);
  const debtMinimums = buildDebtMinimumObligations(activeAccounts, asOf);
  const obligations = [...debtMinimums];

  for (const item of household.recurringExpenses ?? []) {
    if (item.status !== "CONFIRMED" || !item.nextExpectedDate || item.typicalAmountMinor <= 0) {
      continue;
    }
    const dueDate = new Date(item.nextExpectedDate);
    if (!isWithinNextDays(dueDate, asOf, 30)) continue;
    if (looksLikeCardPayment(item.displayName) || looksLikeCardPayment(item.serviceName ?? "")) {
      continue;
    }
    const candidate: UpcomingObligation = {
      id: `recurring:${item.id}`,
      displayName: item.serviceName || item.displayName,
      amountMinor: item.typicalAmountMinor,
      dueDate,
      accountName: null,
      obligationType: "Recurring expense",
      sourceType: "recurring",
      sourceId: item.id,
      confidence:
        item.confidence === "HIGH" ? "High" : item.confidence === "MEDIUM" ? "Medium" : "Low",
      reservedStatus: "Not specifically reserved",
      explanation: "Expected date comes from the confirmed recurring expense record.",
    };
    if (!hasDuplicateObligation(obligations, candidate)) obligations.push(candidate);
  }

  return obligations.sort(
    (a, b) =>
      a.dueDate.getTime() - b.dueDate.getTime() ||
      sourceRank(a.sourceType) - sourceRank(b.sourceType) ||
      a.displayName.localeCompare(b.displayName),
  );
}

function buildDebtMinimumObligations(accounts: AccountInput[], asOf: Date): UpcomingObligation[] {
  return accounts
    .filter(
      (account) =>
        DEBT_TYPES.has(account.type) &&
        account.balanceMinor < 0 &&
        (account.minimumPaymentMinor ?? 0) > 0 &&
        account.dueDay,
    )
    .map((account) => {
      const dueDate = nextDueDate(asOf, account.dueDay ?? 1);
      return {
        id: `account:${account.id}`,
        displayName: account.name,
        amountMinor: account.minimumPaymentMinor ?? 0,
        dueDate,
        accountName: account.name,
        obligationType: account.type === "CREDIT" ? "Credit-card minimum" : "Debt minimum",
        sourceType: "account",
        sourceId: account.id,
        confidence: "High",
        reservedStatus: "Planned",
        explanation: "Due date and amount come from account payment terms.",
      } satisfies UpcomingObligation;
    })
    .filter((obligation) => isWithinNextDays(obligation.dueDate, asOf, 30));
}

function buildCategorySpending(
  household: OverviewDashboardInput["household"],
  asOf: Date,
): OverviewCategorySpending[] {
  const rows = categoryBudgetSummaries(household.categories, household.transactions, asOf).map(
    (row) =>
      categoryRow(
        row.id,
        row.name,
        row.actualMinor,
        row.budgetMinor,
        `/transactions?category=${row.id}&period=CURRENT_MONTH`,
      ),
  );
  const period = monthBounds(asOf);
  const uncategorizedActual = household.transactions
    .filter(
      (transaction) =>
        !transaction.excluded &&
        !transaction.categoryId &&
        EXPENSE_TYPES.has(transaction.type ?? "") &&
        inRange(transaction.transactionDate, period.start, period.end),
    )
    .reduce((total, transaction) => total + Math.abs(Math.min(transaction.amountMinor, 0)), 0);
  if (uncategorizedActual > 0) {
    rows.push(
      categoryRow(
        "uncategorized",
        "Uncategorized",
        uncategorizedActual,
        0,
        "/transactions?status=NEEDS_REVIEW",
      ),
    );
  }
  return rows
    .filter((row) => row.actualMinor > 0 || row.budgetMinor > 0)
    .sort(
      (a, b) =>
        severityRankForCategory(a.status) - severityRankForCategory(b.status) ||
        b.actualMinor - a.actualMinor ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 8);
}

function categoryRow(
  id: string,
  name: string,
  actualMinor: number,
  budgetMinor: number,
  href: string,
): OverviewCategorySpending {
  const usedPercent = budgetMinor <= 0 ? 0 : Math.round((actualMinor / budgetMinor) * 100);
  const status =
    budgetMinor <= 0
      ? "No budget"
      : actualMinor > budgetMinor
        ? "Over budget"
        : usedPercent >= 90
          ? "Approaching budget"
          : "On track";
  return {
    id,
    name,
    actualMinor,
    budgetMinor,
    differenceMinor: budgetMinor - actualMinor,
    usedPercent,
    status,
    href,
  };
}

function buildGoalSnapshots(goals: GoalInput[]): OverviewGoalSnapshot[] {
  return goals
    .filter(isActive)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100) || a.name.localeCompare(b.name))
    .slice(0, 4)
    .map((goal) => {
      const progressPercent =
        goal.targetMinor <= 0
          ? 0
          : Math.min(100, Math.round((goal.currentMinor / goal.targetMinor) * 100));
      return {
        id: goal.id,
        name: goal.name,
        currentMinor: goal.currentMinor,
        targetMinor: goal.targetMinor,
        progressPercent,
        status: goalStatus(goal),
        targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
        plannedMonthlyMinor: goal.plannedMonthlyMinor,
        requiredMonthlyMinor: goal.requiredMonthlyMinor,
        href: `/goals#goal-${goal.id}`,
      };
    });
}

function buildDebtSnapshot(household: OverviewDashboardInput["household"]): OverviewDebtSnapshot {
  const debts = household.accounts
    .filter(
      (account) => isActive(account) && DEBT_TYPES.has(account.type) && account.balanceMinor < 0,
    )
    .map((account) => ({ ...account, positiveBalanceMinor: Math.abs(account.balanceMinor) }));
  const strategy = household.debtStrategy || "AVALANCHE";
  const recommended =
    strategy === "SNOWBALL"
      ? [...debts].sort(
          (a, b) =>
            a.positiveBalanceMinor - b.positiveBalanceMinor ||
            (b.aprBasisPoints ?? 0) - (a.aprBasisPoints ?? 0) ||
            a.name.localeCompare(b.name),
        )[0]
      : strategy === "AVALANCHE"
        ? [...debts].sort(
            (a, b) =>
              (b.aprBasisPoints ?? -1) - (a.aprBasisPoints ?? -1) ||
              b.positiveBalanceMinor - a.positiveBalanceMinor ||
              a.name.localeCompare(b.name),
          )[0]
        : null;
  return {
    totalDebtMinor: debts.reduce((total, account) => total + account.positiveBalanceMinor, 0),
    monthlyMinimumsMinor: debts.reduce(
      (total, account) => total + (account.minimumPaymentMinor ?? 0),
      0,
    ),
    highestAprBasisPoints: debts.reduce<number | null>(
      (highest, account) =>
        account.aprBasisPoints == null
          ? highest
          : Math.max(highest ?? account.aprBasisPoints, account.aprBasisPoints),
      null,
    ),
    strategy,
    recommendedDebt: recommended
      ? {
          id: recommended.id,
          name: recommended.name,
          balanceMinor: recommended.positiveBalanceMinor,
          aprBasisPoints: recommended.aprBasisPoints ?? null,
          href: "/debt",
        }
      : null,
    recommendationNote:
      strategy === "CUSTOM"
        ? "Custom payoff ordering is not persisted yet."
        : strategy === "SNOWBALL"
          ? "Snowball recommends the lowest positive balance first."
          : "Avalanche recommends the highest APR first.",
  };
}

function goalStatus(goal: GoalInput): OverviewGoalSnapshot["status"] {
  if (goal.targetMinor > 0 && goal.currentMinor >= goal.targetMinor) return "Completed";
  if (!goal.targetDate) return "Missing target date";
  if (goal.targetMinor > goal.currentMinor && goal.plannedMonthlyMinor <= 0) {
    return "Missing contribution plan";
  }
  if (goal.requiredMonthlyMinor > 0 && goal.plannedMonthlyMinor < goal.requiredMonthlyMinor) {
    return "Behind";
  }
  if (
    goal.requiredMonthlyMinor > 0 &&
    goal.plannedMonthlyMinor < Math.ceil(goal.requiredMonthlyMinor * 1.1)
  ) {
    return "At risk";
  }
  return "On track";
}

function actionOrder(a: OverviewActionItem, b: OverviewActionItem) {
  return (
    severityRank(a.severity) - severityRank(b.severity) ||
    typeRank(a.type) - typeRank(b.type) ||
    a.title.localeCompare(b.title)
  );
}

function severityRank(severity: OverviewSeverity) {
  if (severity === "Critical") return 0;
  if (severity === "Warning") return 1;
  return 2;
}

function typeRank(type: string) {
  const ranks = [
    "checking-buffer-risk",
    "upcoming-payment",
    "credit-card-payment-candidate",
    "transfer-candidate",
    "possible-duplicate",
    "uncategorized-transactions",
    "unconfirmed-recurring",
    "recurring-price-increase",
    "stale-account-balance",
    "incomplete-import",
    "goal-allocation",
    "high-apr-debt",
    "missing-debt-metadata",
  ];
  const index = ranks.indexOf(type);
  return index === -1 ? 100 : index;
}

function severityRankForCategory(status: OverviewCategorySpending["status"]) {
  if (status === "Over budget") return 0;
  if (status === "Approaching budget") return 1;
  if (status === "No budget") return 2;
  return 3;
}

function isActive(item: { archivedAt?: Date | string | null; status?: string | null }) {
  return !item.archivedAt && item.status !== "ARCHIVED" && item.status !== "INACTIVE";
}

function inferredAsOf(transactions: TransactionInput[]) {
  const latest = transactions
    .map((transaction) =>
      transaction.transactionDate ? new Date(transaction.transactionDate).getTime() : Number.NaN,
    )
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  return Number.isFinite(latest) ? new Date(latest) : new Date();
}

function nextDueDate(asOf: Date, dueDay: number) {
  const safeDay = Math.max(1, Math.min(31, dueDay));
  const current = clampedUtcDate(asOf.getUTCFullYear(), asOf.getUTCMonth(), safeDay);
  if (current >= startOfUtcDay(asOf)) return current;
  return clampedUtcDate(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, safeDay);
}

function clampedUtcDate(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function isWithinNextDays(value: Date, asOf: Date, days: number) {
  const start = startOfUtcDay(asOf);
  const end = addDays(start, days + 1);
  return value >= start && value < end;
}

function daysBetween(start: Date, end: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / msPerDay);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

function hasDuplicateObligation(existing: UpcomingObligation[], candidate: UpcomingObligation) {
  return existing.some(
    (item) =>
      item.amountMinor === candidate.amountMinor &&
      Math.abs(daysBetween(item.dueDate, candidate.dueDate)) <= 3 &&
      (item.displayName.toLowerCase().includes(candidate.displayName.toLowerCase()) ||
        candidate.displayName.toLowerCase().includes(item.displayName.toLowerCase()) ||
        looksLikeCardPayment(candidate.displayName)),
  );
}

function looksLikeCardPayment(value: string) {
  return /\b(card|credit|payment|autopay|transfer)\b/i.test(value);
}

function sourceRank(sourceType: UpcomingObligation["sourceType"]) {
  return sourceType === "account" ? 1 : 2;
}

function byDateDescThenName(a: TransactionInput, b: TransactionInput) {
  return (
    new Date(b.transactionDate ?? 0).getTime() - new Date(a.transactionDate ?? 0).getTime() ||
    (a.normalizedMerchant ?? "").localeCompare(b.normalizedMerchant ?? "")
  );
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
