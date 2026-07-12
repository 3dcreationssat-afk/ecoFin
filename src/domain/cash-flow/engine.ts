import { dueDateInPeriod, financialPeriod } from "./period";

export type ConfidenceLevel = "HIGH" | "MODERATE" | "LIMITED";
export type CashFlowEvent = {
  id: string;
  date: Date;
  label: string;
  amountMinor: number;
  kind: "RECORDED" | "SCHEDULED" | "FORECAST" | "ASSUMPTION";
  source: string;
  confidence: ConfidenceLevel;
};
export type ReserveComponent = {
  id: string;
  label: string;
  amountMinor: number;
  explanation: string;
  href: string;
};
export type ConfidenceFactor = {
  positive: boolean;
  label: string;
  explanation: string;
  href?: string;
};
export type CalculationLine = { label: string; amountMinor: number; help: string };
export type CashFlowAccount = {
  id: string;
  name: string;
  type: string;
  archivedAt?: Date | null;
  openingBalanceMinor: number | null;
  ledgerBalanceMinor: number | null;
  ledgerStatus: string;
  reconciliationStatus: string;
  reconciliationDifferenceMinor: number | null;
  reportedAvailableMinor: number | null;
  reportedBalanceAsOf: Date | null;
  minimumPaymentMinor: number | null;
  dueDay: number | null;
};
export type CashFlowTransaction = {
  id: string;
  accountId: string;
  transactionDate: Date;
  amountMinor: number;
  type: string;
  affectsLedger: boolean;
  affectsIncomeSpendingReports: boolean;
  possibleDuplicate: boolean;
  clearingStatus: string;
  excluded: boolean;
  categoryId: string | null;
};
export type CashFlowRecurring = {
  id: string;
  displayName: string;
  typicalAmountMinor: number;
  nextExpectedDate: Date | null;
  status: string;
  userConfirmed: boolean;
  recurringType: string;
  confidence: string;
};
export type CashFlowGoal = {
  id: string;
  name: string;
  plannedMonthlyMinor: number;
  currentMinor: number;
  targetMinor: number;
  linkedAccountId: string | null;
  archivedAt: Date | null;
  contributions: { amountMinor: number; contributionDate: Date }[];
};
export type CashFlowInput = {
  asOf: Date;
  financialMonthStart: number;
  checkingBufferMinor: number;
  emergencyFundTargetMinor: number;
  workspaceMode: string;
  accounts: CashFlowAccount[];
  transactions: CashFlowTransaction[];
  recurring: CashFlowRecurring[];
  goals: CashFlowGoal[];
  importBatches: { status: string; rejectedRowCount: number; duplicateCandidateCount: number }[];
};
export type CashFlowProjection = ReturnType<typeof calculateCashFlow>;

const LIQUID = new Set(["CHECKING", "SAVINGS", "CASH"]);
const LIABILITY = new Set(["CREDIT", "LOAN", "MORTGAGE"]);
const DAY = 86400000;
const inRange = (date: Date, start: Date, end: Date) => date >= start && date < end;

export function calculateCashFlow(input: CashFlowInput) {
  const period = financialPeriod(input.asOf, input.financialMonthStart);
  const factors: ConfidenceFactor[] = [];
  if (input.workspaceMode === "MIXED")
    factors.push({
      positive: false,
      label: "Mixed provenance workspace",
      explanation: "Demo and user records are combined; review source records.",
      href: "/data-quality",
    });
  const reserves: ReserveComponent[] = [];
  const liquidAccounts = input.accounts.filter((a) => !a.archivedAt && LIQUID.has(a.type));
  let startingUsableLiquidCashMinor = 0;
  for (const account of liquidAccounts) {
    const trustworthy =
      account.openingBalanceMinor !== null &&
      account.ledgerBalanceMinor !== null &&
      account.ledgerStatus === "CURRENT";
    if (!trustworthy) {
      factors.push({
        positive: false,
        label: `${account.name} needs an opening anchor`,
        explanation: "Reported snapshots are not substituted for an unanchored ledger.",
        href: "/accounts",
      });
      continue;
    }
    let usable = Math.max(0, account.ledgerBalanceMinor!);
    const availableIsCurrent =
      account.reportedBalanceAsOf &&
      input.asOf.getTime() - account.reportedBalanceAsOf.getTime() <= 7 * DAY;
    if (availableIsCurrent && account.reportedAvailableMinor !== null)
      usable = Math.min(usable, Math.max(0, account.reportedAvailableMinor));
    startingUsableLiquidCashMinor += usable;
    if (account.reconciliationStatus !== "RECONCILED") {
      const amount = Math.abs(account.reconciliationDifferenceMinor ?? 0);
      reserves.push({
        id: `reconcile-${account.id}`,
        label: `${account.name} reconciliation difference`,
        amountMinor: amount,
        explanation: "Known ledger-to-institution difference is reserved.",
        href: "/accounts",
      });
      factors.push({
        positive: false,
        label: `${account.name} is unreconciled`,
        explanation: "Reconcile the ledger to improve confidence.",
        href: "/accounts",
      });
    }
    if (
      !account.reportedBalanceAsOf ||
      input.asOf.getTime() - account.reportedBalanceAsOf.getTime() > 45 * DAY
    )
      factors.push({
        positive: false,
        label: `${account.name} institution snapshot is stale`,
        explanation: "Refresh the reported comparison balance.",
        href: "/accounts",
      });
  }
  if (liquidAccounts.length && !factors.some((f) => f.label.includes("opening anchor")))
    factors.push({
      positive: true,
      label: "Liquid ledgers are anchored",
      explanation: "Cash position comes from transaction-derived ledgers.",
    });

  const recorded = input.transactions.filter(
    (t) =>
      inRange(t.transactionDate, period.start, input.asOf) &&
      t.affectsLedger &&
      !t.possibleDuplicate &&
      t.clearingStatus === "CLEARED" &&
      liquidAccounts.some((a) => a.id === t.accountId),
  );
  const events: CashFlowEvent[] = recorded.map((t) => ({
    id: t.id,
    date: t.transactionDate,
    label: t.type.replaceAll("_", " "),
    amountMinor: t.amountMinor,
    kind: "RECORDED",
    source: "Ledger transaction",
    confidence: "HIGH",
  }));

  let remainingExpectedIncomeMinor = 0;
  let remainingEssentialObligationsMinor = 0;
  let conservativeExtraMinor = 0;
  for (const item of input.recurring) {
    const date = item.nextExpectedDate;
    if (
      !date ||
      !inRange(date, input.asOf, period.end) ||
      item.status === "CANCELED" ||
      item.status === "INACTIVE"
    )
      continue;
    const amount = Math.abs(item.typicalAmountMinor);
    const confirmed = item.userConfirmed && item.status === "CONFIRMED";
    if (!confirmed) {
      if (item.recurringType !== "INCOME") conservativeExtraMinor += amount;
      factors.push({
        positive: false,
        label: `${item.displayName} is unconfirmed`,
        explanation: "It appears only in uncertainty protection, not certain forecasts.",
        href: "/recurring",
      });
      continue;
    }
    const income = item.recurringType === "INCOME";
    if (income) remainingExpectedIncomeMinor += amount;
    else remainingEssentialObligationsMinor += amount;
    events.push({
      id: `recurring-${item.id}`,
      date,
      label: item.displayName,
      amountMinor: income ? amount : -amount,
      kind: "FORECAST",
      source: "Confirmed recurring record",
      confidence: item.confidence === "HIGH" ? "HIGH" : "MODERATE",
    });
  }

  let debtMinimumPaymentsMinor = 0;
  for (const account of input.accounts.filter(
    (a) => !a.archivedAt && LIABILITY.has(a.type) && (a.ledgerBalanceMinor ?? 0) > 0,
  )) {
    if (account.minimumPaymentMinor === null || account.dueDay === null) {
      factors.push({
        positive: false,
        label: `${account.name} is missing debt payment details`,
        explanation: "No amount is fabricated; add a minimum payment and due day.",
        href: "/accounts",
      });
      continue;
    }
    const due = dueDateInPeriod(account.dueDay, period);
    if (due && due >= input.asOf) {
      const amount = Math.min(
        account.minimumPaymentMinor,
        account.ledgerBalanceMinor ?? account.minimumPaymentMinor,
      );
      debtMinimumPaymentsMinor += amount;
      events.push({
        id: `debt-${account.id}`,
        date: due,
        label: `${account.name} minimum payment`,
        amountMinor: -amount,
        kind: "SCHEDULED",
        source: "Account debt terms",
        confidence: "HIGH",
      });
    }
  }

  let committedPlannedSavingsMinor = 0;
  let emergencyProtectedMinor = 0;
  let emergencyMapped = false;
  for (const goal of input.goals.filter((g) => !g.archivedAt)) {
    const contributed = goal.contributions
      .filter((c) => inRange(c.contributionDate, period.start, period.end))
      .reduce((sum, c) => sum + c.amountMinor, 0);
    const remaining = Math.max(0, goal.plannedMonthlyMinor - contributed);
    committedPlannedSavingsMinor += remaining;
    if (remaining)
      events.push({
        id: `goal-${goal.id}`,
        date: period.monthEnd,
        label: `${goal.name} planned contribution`,
        amountMinor: -remaining,
        kind: "ASSUMPTION",
        source: "Goal plan",
        confidence: "HIGH",
      });
    if (/emergency/i.test(goal.name) && goal.linkedAccountId) {
      emergencyMapped = true;
      emergencyProtectedMinor += Math.min(goal.currentMinor, goal.targetMinor);
    }
  }
  const emergencyFundShortfallMinor = emergencyMapped
    ? Math.max(0, input.emergencyFundTargetMinor - emergencyProtectedMinor)
    : input.emergencyFundTargetMinor;
  const emergencyFundProtectionMinor = emergencyMapped ? emergencyProtectedMinor : 0;
  if (!emergencyMapped && input.emergencyFundTargetMinor > 0)
    factors.push({
      positive: false,
      label: "Emergency fund is not mapped",
      explanation: "No savings account is assumed to be emergency protection.",
      href: "/goals",
    });

  const checkingCashMinor = liquidAccounts
    .filter((a) => a.type === "CHECKING" && a.ledgerBalanceMinor !== null)
    .reduce((sum, a) => sum + Math.max(0, a.ledgerBalanceMinor!), 0);
  const checkingBufferReserveMinor = Math.max(0, input.checkingBufferMinor - checkingCashMinor);
  const duplicates = input.transactions.filter((t) => t.possibleDuplicate && t.affectsLedger);
  const duplicateReserve = duplicates.reduce((sum, t) => sum + Math.abs(t.amountMinor), 0);
  if (duplicateReserve)
    reserves.push({
      id: "duplicates",
      label: "Duplicate candidates",
      amountMinor: duplicateReserve,
      explanation: "Known candidate amounts are protected until reviewed.",
      href: "/transactions?duplicate=POSSIBLE",
    });
  if (input.importBatches.some((b) => !["IMPORTED", "UNDONE"].includes(b.status)))
    factors.push({
      positive: false,
      label: "An import is incomplete",
      explanation: "Finish or undo incomplete import batches.",
      href: "/transactions",
    });
  const dataQualityReserveMinor = reserves.reduce((sum, r) => sum + r.amountMinor, 0);
  const maximumAvailableSurplusMinor =
    startingUsableLiquidCashMinor +
    remainingExpectedIncomeMinor -
    remainingEssentialObligationsMinor -
    debtMinimumPaymentsMinor -
    committedPlannedSavingsMinor -
    checkingBufferReserveMinor -
    emergencyFundProtectionMinor -
    dataQualityReserveMinor;
  const recommendedSafeToSaveMinor = Math.max(0, maximumAvailableSurplusMinor);
  const confidence: ConfidenceLevel =
    factors.filter((f) => !f.positive).length === 0
      ? "HIGH"
      : factors.filter((f) => !f.positive).length <= 2
        ? "MODERATE"
        : "LIMITED";
  const conservativeSafeToSaveMinor = Math.max(
    0,
    recommendedSafeToSaveMinor - (confidence === "HIGH" ? 0 : conservativeExtraMinor),
  );
  const safeToSpendMinor = Math.max(0, maximumAvailableSurplusMinor - recommendedSafeToSaveMinor);
  const projectedMonthEndMinor =
    startingUsableLiquidCashMinor +
    remainingExpectedIncomeMinor -
    remainingEssentialObligationsMinor -
    debtMinimumPaymentsMinor -
    committedPlannedSavingsMinor;
  const lines: CalculationLine[] = [
    {
      label: "Starting usable liquid cash",
      amountMinor: startingUsableLiquidCashMinor,
      help: "Anchored liquid ledgers, capped by fresh lower available balances.",
    },
    {
      label: "Remaining expected income",
      amountMinor: remainingExpectedIncomeMinor,
      help: "Confirmed persisted income only.",
    },
    {
      label: "Remaining essential obligations",
      amountMinor: -remainingEssentialObligationsMinor,
      help: "Confirmed unpaid recurring expenses.",
    },
    {
      label: "Debt minimum payments",
      amountMinor: -debtMinimumPaymentsMinor,
      help: "Account minimums due in this financial month.",
    },
    {
      label: "Committed planned savings",
      amountMinor: -committedPlannedSavingsMinor,
      help: "Monthly goal plans less contributions already recorded.",
    },
    {
      label: "Checking-buffer reserve",
      amountMinor: -checkingBufferReserveMinor,
      help: "Shortfall to the household combined checking target.",
    },
    {
      label: "Emergency-fund protection",
      amountMinor: -emergencyFundProtectionMinor,
      help: "Only explicitly linked emergency-fund goals.",
    },
    {
      label: "Data-quality reserve",
      amountMinor: -dataQualityReserveMinor,
      help: "Visible known uncertainty amounts; never a blanket percentage.",
    },
  ];
  events.push({
    id: "current",
    date: input.asOf,
    label: "Current usable cash",
    amountMinor: startingUsableLiquidCashMinor,
    kind: "RECORDED",
    source: "Derived liquid ledgers",
    confidence,
  });
  events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  return {
    period,
    startingUsableLiquidCashMinor,
    remainingExpectedIncomeMinor,
    remainingEssentialObligationsMinor,
    debtMinimumPaymentsMinor,
    committedPlannedSavingsMinor,
    checkingBufferReserveMinor,
    checkingBufferTargetMinor: input.checkingBufferMinor,
    checkingCashMinor,
    emergencyFundProtectionMinor,
    emergencyFundShortfallMinor,
    emergencyFundTargetMinor: input.emergencyFundTargetMinor,
    emergencyProtectedMinor,
    dataQualityReserveMinor,
    maximumAvailableSurplusMinor,
    projectedMonthEndMinor,
    recommendedSafeToSaveMinor,
    conservativeSafeToSaveMinor,
    safeToSpendMinor,
    shortfallMinor: Math.max(0, -maximumAvailableSurplusMinor),
    confidence,
    confidenceFactors: factors,
    reserveComponents: reserves,
    calculationLines: lines,
    events,
    workspaceWarning:
      input.workspaceMode === "MIXED"
        ? "Mixed demo and user provenance lowers confidence; review source records."
        : null,
  };
}
