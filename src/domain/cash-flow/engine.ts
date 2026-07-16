import { dueDateInPeriod, financialPeriod } from "./period";
import { savingsRecommendation } from "@/domain/planning/occurrences";
import { calculateEmergencyRunway } from "@/domain/planning/emergency-runway";
import { generateForecastOccurrences } from "@/domain/forecast/occurrences";

export type ConfidenceLevel = "HIGH" | "MODERATE" | "LIMITED";
export type CashFlowEvent = {
  id: string;
  date: Date;
  label: string;
  amountMinor: number;
  kind: "RECORDED" | "SCHEDULED" | "FORECAST" | "INFERRED" | "ASSUMPTION";
  source: string;
  confidence: ConfidenceLevel;
  status?: string;
  ruleId?: string;
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
  classification?: string | null;
  monthlyEquivalentMinor?: number;
};
export type CashFlowGoal = {
  id: string;
  name: string;
  purpose?: string;
  plannedMonthlyMinor: number;
  currentMinor: number;
  targetMinor: number;
  linkedAccountId: string | null;
  archivedAt: Date | null;
  contributions: { amountMinor: number; contributionDate: Date }[];
};
export type CashFlowInput = {
  asOf: Date;
  timezone?: string;
  financialMonthStart: number;
  checkingBufferMinor: number;
  emergencyFundTargetMinor: number;
  emergencyFundConfiguration?: {
    enabled: boolean;
    targetAmountMinor: number | null;
    targetRunwayMonths: number | null;
    accounts: {
      accountId: string;
      includedAmountMode: string;
      fixedProtectedAmountMinor: number | null;
      sortOrder: number;
    }[];
  } | null;
  workspaceMode: string;
  accounts: CashFlowAccount[];
  transactions: CashFlowTransaction[];
  recurring: CashFlowRecurring[];
  goals: CashFlowGoal[];
  importBatches: { status: string; rejectedRowCount: number; duplicateCandidateCount: number }[];
  expectedIncomeSchedules?: {
    id: string;
    name: string;
    confidence: string;
    active: boolean;
    archivedAt: Date | null;
    recurringExpenseId?: string | null;
    occurrences: { id: string; expectedDate: Date; expectedAmountMinor: number; status: string }[];
  }[];
  scheduledObligations?: {
    id: string;
    name: string;
    confidence: string;
    active: boolean;
    archivedAt: Date | null;
    recurringExpenseId: string | null;
    debtAccountId: string | null;
    goalId: string | null;
    amountMinor?: number;
    frequency?: string;
    essentiality?: string;
    occurrences: {
      id: string;
      expectedDate: Date;
      expectedAmountMinor: number;
      status: string;
      amountDifferenceMinor?: number;
    }[];
  }[];
  forecastRules?: {
    id: string;
    accountId: string | null;
    recurringExpenseId: string | null;
    name: string;
    merchantKey: string;
    direction: string;
    cadence: string;
    nextExpectedDate: Date;
    typicalAmountMinor: number;
    confidence: string;
    confidenceScore: number;
    state: string;
    sourceRecordType: string | null;
    sourceRecordId: string | null;
    semimonthlyDay1: number | null;
    semimonthlyDay2: number | null;
    endDate: Date | null;
    occurrences: {
      id: string;
      expectedDate: Date;
      expectedAmountMinor: number;
      status: string;
      overrideDate: Date | null;
      overrideAmountMinor: number | null;
      matchedTransactionId: string | null;
    }[];
  }[];
  savingsPolicy?: {
    mode: string;
    targetBps: number;
    minimumDiscretionaryReserveMinor: number;
    extraSafetyReserveMinor: number;
    minimumCashRetainedMinor: number;
    includeGoalContributions: boolean;
    emergencyShortfallIncreasesRecommendation: boolean;
    conservativeAdjustmentBps: number;
  };
};
export type CashFlowProjection = ReturnType<typeof calculateCashFlow>;

const LIQUID = new Set(["CHECKING", "SAVINGS", "CASH"]);
const LIABILITY = new Set(["CREDIT", "LOAN", "MORTGAGE"]);
const DAY = 86400000;
const inRange = (date: Date, start: Date, end: Date) => date >= start && date < end;

export function calculateCashFlow(input: CashFlowInput) {
  const period = financialPeriod(input.asOf, input.financialMonthStart);
  const policy = input.savingsPolicy ?? {
    mode: "BALANCED",
    targetBps: 5000,
    minimumDiscretionaryReserveMinor: 100000,
    extraSafetyReserveMinor: 0,
    minimumCashRetainedMinor: 0,
    includeGoalContributions: true,
    emergencyShortfallIncreasesRecommendation: false,
    conservativeAdjustmentBps: 2000,
  };
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
  let inferredIncomeMinor = 0;
  let inferredExpenseMinor = 0;
  const inferredEvents: CashFlowEvent[] = [];
  const canonicalIncomeSources = new Set(
    (input.forecastRules ?? [])
      .filter((rule) => rule.sourceRecordType === "ExpectedIncomeSchedule")
      .map((rule) => rule.sourceRecordId),
  );
  const canonicalObligationSources = new Set(
    (input.forecastRules ?? [])
      .filter((rule) => rule.sourceRecordType === "ScheduledObligation")
      .map((rule) => rule.sourceRecordId),
  );
  for (const schedule of input.expectedIncomeSchedules ?? []) {
    if (!schedule.active || schedule.archivedAt || canonicalIncomeSources.has(schedule.id))
      continue;
    for (const occurrence of schedule.occurrences.filter(
      (o) =>
        ["UPCOMING", "OVERDUE"].includes(o.status) &&
        o.expectedDate >= input.asOf &&
        o.expectedDate < period.end,
    )) {
      remainingExpectedIncomeMinor += occurrence.expectedAmountMinor;
      events.push({
        id: `income-${occurrence.id}`,
        date: occurrence.expectedDate,
        label: schedule.name,
        amountMinor: occurrence.expectedAmountMinor,
        kind: "SCHEDULED",
        source: "Expected income schedule",
        confidence: schedule.confidence as ConfidenceLevel,
      });
    }
  }
  const linkedRecurringIds = new Set([
    ...(input.scheduledObligations ?? []).map((o) => o.recurringExpenseId).filter(Boolean),
    ...(input.expectedIncomeSchedules ?? []).map((o) => o.recurringExpenseId).filter(Boolean),
  ]);
  const linkedDebtIds = new Set(
    (input.scheduledObligations ?? []).map((o) => o.debtAccountId).filter(Boolean),
  );
  const linkedGoalIds = new Set(
    (input.scheduledObligations ?? []).map((o) => o.goalId).filter(Boolean),
  );
  for (const schedule of input.scheduledObligations ?? []) {
    if (!schedule.active || schedule.archivedAt || canonicalObligationSources.has(schedule.id))
      continue;
    for (const occurrence of schedule.occurrences.filter(
      (o) =>
        ["UPCOMING", "OVERDUE", "PARTIALLY_PAID"].includes(o.status) && o.expectedDate < period.end,
    )) {
      const amount =
        occurrence.status === "PARTIALLY_PAID"
          ? Math.max(0, -(occurrence.amountDifferenceMinor ?? -occurrence.expectedAmountMinor))
          : occurrence.expectedAmountMinor;
      remainingEssentialObligationsMinor += amount;
      events.push({
        id: `obligation-${occurrence.id}`,
        date: occurrence.expectedDate,
        label: schedule.name,
        amountMinor: -amount,
        kind: "SCHEDULED",
        source: "Scheduled obligation",
        confidence: schedule.confidence as ConfidenceLevel,
      });
    }
  }
  const forecastRecurringIds = new Set(
    (input.forecastRules ?? []).map((rule) => rule.recurringExpenseId).filter(Boolean),
  );
  let detectedIncomeCount = 0;
  let detectedExpenseCount = 0;
  for (const rule of input.forecastRules ?? []) {
    if (["IGNORED", "PAUSED", "ENDED", "ARCHIVED"].includes(rule.state)) continue;
    const occurrences = generateForecastOccurrences(
      rule,
      input.asOf,
      period.end,
      rule.occurrences,
    ).filter(
      (occurrence) =>
        !["MATCHED", "POSTED", "SKIPPED", "CANCELLED", "SUPERSEDED"].includes(occurrence.status),
    );
    const confirmed = rule.state === "CONFIRMED";
    const inferred = rule.state === "DETECTED" && rule.confidence === "HIGH";
    if (!confirmed && !inferred) {
      if (rule.direction === "INCOME") detectedIncomeCount += 1;
      else detectedExpenseCount += 1;
      continue;
    }
    for (const occurrence of occurrences) {
      const amount = Math.abs(occurrence.effectiveAmountMinor);
      const income = rule.direction === "INCOME";
      const event: CashFlowEvent = {
        id: occurrence.id,
        date: occurrence.effectiveDate,
        label: rule.name,
        amountMinor: income ? amount : -amount,
        kind: confirmed ? "FORECAST" : "INFERRED",
        source: confirmed ? "Confirmed forecast rule" : "High-confidence detected pattern",
        confidence:
          rule.confidence === "HIGH"
            ? "HIGH"
            : rule.confidence === "MEDIUM"
              ? "MODERATE"
              : "LIMITED",
        status: occurrence.status === "CHANGED" ? "CHANGED" : confirmed ? "CONFIRMED" : "INFERRED",
        ruleId: rule.id,
      };
      if (confirmed) {
        if (income) remainingExpectedIncomeMinor += amount;
        else remainingEssentialObligationsMinor += amount;
        events.push(event);
      } else {
        if (income) inferredIncomeMinor += amount;
        else inferredExpenseMinor += amount;
        inferredEvents.push(event);
      }
    }
  }
  if (detectedIncomeCount || detectedExpenseCount || inferredEvents.length) {
    factors.push({
      positive: false,
      label: "Forecast patterns need confirmation",
      explanation: `${detectedIncomeCount + inferredEvents.filter((event) => event.amountMinor > 0).length} income and ${detectedExpenseCount + inferredEvents.filter((event) => event.amountMinor < 0).length} expense pattern(s) remain inferred or unconfirmed.`,
      href: "/cash-flow#needs-attention",
    });
  }
  conservativeExtraMinor += inferredExpenseMinor;
  let unconfirmedRecurringCount = 0;
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
    if (linkedRecurringIds.has(item.id) || forecastRecurringIds.has(item.id)) continue;
    if (!confirmed) {
      if (item.recurringType !== "INCOME") conservativeExtraMinor += amount;
      unconfirmedRecurringCount += 1;
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
  if (unconfirmedRecurringCount)
    factors.push({
      positive: false,
      label: `${unconfirmedRecurringCount} recurring candidate${unconfirmedRecurringCount === 1 ? "" : "s"} need review`,
      explanation:
        "Unconfirmed recurring evidence is summarized here and reviewed in Forecast Setup.",
      href: "/recurring",
    });

  let debtMinimumPaymentsMinor = 0;
  for (const account of input.accounts.filter(
    (a) => !a.archivedAt && LIABILITY.has(a.type) && (a.ledgerBalanceMinor ?? 0) > 0,
  )) {
    if (linkedDebtIds.has(account.id)) continue;
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
  const emergencyRunway = calculateEmergencyRunway(input);
  for (const goal of input.goals.filter((g) => !g.archivedAt)) {
    const contributed = goal.contributions
      .filter((c) => inRange(c.contributionDate, period.start, period.end))
      .reduce((sum, c) => sum + c.amountMinor, 0);
    const remaining =
      !policy.includeGoalContributions || linkedGoalIds.has(goal.id)
        ? 0
        : Math.max(0, goal.plannedMonthlyMinor - contributed);
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
  }
  const emergencyProtectedMinor = emergencyRunway.eligibleBalanceMinor;
  const emergencyFundTargetMinor = input.emergencyFundConfiguration?.targetAmountMinor ?? 0;
  const emergencyFundShortfallMinor = Math.max(
    0,
    emergencyFundTargetMinor - emergencyProtectedMinor,
  );
  const emergencyFundProtectionMinor = emergencyProtectedMinor;
  if (emergencyRunway.confidence === "LIMITED")
    factors.push({
      positive: false,
      label: "Emergency fund configuration needs review",
      explanation: emergencyRunway.issues.join(" "),
      href: "/settings#emergency-fund",
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
  const confidence: ConfidenceLevel =
    factors.filter((f) => !f.positive).length === 0
      ? "HIGH"
      : factors.filter((f) => !f.positive).length <= 2
        ? "MODERATE"
        : "LIMITED";
  const recommendation = savingsRecommendation({
    maximumSurplusMinor: maximumAvailableSurplusMinor,
    mode: policy.mode,
    targetBps: policy.targetBps,
    discretionaryReserveMinor: policy.minimumDiscretionaryReserveMinor,
    extraSafetyReserveMinor: policy.extraSafetyReserveMinor,
    minimumCashRetainedMinor: policy.minimumCashRetainedMinor,
    startingCashMinor: startingUsableLiquidCashMinor,
    confidence,
    conservativeAdjustmentBps: policy.conservativeAdjustmentBps,
  });
  const recommendedSafeToSaveMinor = recommendation.recommendedMinor;
  const conservativeSafeToSaveMinor = Math.max(
    0,
    recommendation.conservativeMinor - conservativeExtraMinor,
  );
  const safeToSpendMinor = recommendation.safeToSpendMinor;
  const projectedMonthEndMinor =
    startingUsableLiquidCashMinor +
    remainingExpectedIncomeMinor -
    remainingEssentialObligationsMinor -
    debtMinimumPaymentsMinor -
    committedPlannedSavingsMinor;
  const likelyProjectedMonthEndMinor =
    projectedMonthEndMinor + inferredIncomeMinor - inferredExpenseMinor;
  const conservativeProjectedMonthEndMinor = projectedMonthEndMinor - inferredExpenseMinor;
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
  const confirmedFutureEvents = events.filter(
    (event) => event.date >= input.asOf && event.id !== "current" && event.kind !== "RECORDED",
  );
  const confirmedLow = lowestBalance(
    startingUsableLiquidCashMinor,
    confirmedFutureEvents,
    input.asOf,
  );
  const likelyLow = lowestBalance(
    startingUsableLiquidCashMinor,
    [...confirmedFutureEvents, ...inferredEvents],
    input.asOf,
  );
  const conservativeLow = lowestBalance(
    startingUsableLiquidCashMinor,
    [...confirmedFutureEvents, ...inferredEvents.filter((event) => event.amountMinor < 0)],
    input.asOf,
  );
  const dailyTimeline = buildDailyTimeline(
    input.asOf,
    period.end,
    startingUsableLiquidCashMinor,
    confirmedFutureEvents,
    inferredEvents,
  );
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
    emergencyFundTargetMinor,
    emergencyProtectedMinor,
    emergencyRunway,
    dataQualityReserveMinor,
    cashAfterObligationsAndProtectionsMinor: maximumAvailableSurplusMinor,
    maximumAvailableSurplusMinor: recommendation.allocatableSurplusMinor,
    allocatableSurplusMinor: recommendation.allocatableSurplusMinor,
    projectedMonthEndMinor,
    likelyProjectedMonthEndMinor,
    conservativeProjectedMonthEndMinor,
    lowestProjectedBalanceMinor: confirmedLow.amountMinor,
    lowestProjectedBalanceDate: confirmedLow.date,
    inferredIncomeMinor,
    inferredExpenseMinor,
    scenarios: {
      confirmed: {
        projectedMonthEndMinor,
        lowestBalanceMinor: confirmedLow.amountMinor,
        lowestBalanceDate: confirmedLow.date,
      },
      likely: {
        projectedMonthEndMinor: likelyProjectedMonthEndMinor,
        lowestBalanceMinor: likelyLow.amountMinor,
        lowestBalanceDate: likelyLow.date,
      },
      conservative: {
        projectedMonthEndMinor: conservativeProjectedMonthEndMinor,
        lowestBalanceMinor: conservativeLow.amountMinor,
        lowestBalanceDate: conservativeLow.date,
      },
    },
    recommendedSafeToSaveMinor,
    conservativeSafeToSaveMinor,
    safeToSpendMinor,
    retainedDiscretionaryMinor: recommendation.retainedSafetyReserveMinor,
    retainedSafetyReserveMinor: recommendation.retainedSafetyReserveMinor,
    unallocatedSurplusMinor: recommendation.unallocatedSurplusMinor,
    conservativeReductionMinor: recommendation.conservativeReductionMinor,
    effectiveSavingsTargetBps: recommendation.effectiveTargetBps,
    savingsPolicyMode: policy.mode,
    savingsPolicyCapMinor: recommendation.policyCapMinor,
    shortfallMinor: Math.max(0, -maximumAvailableSurplusMinor),
    confidence,
    confidenceFactors: factors,
    reserveComponents: reserves,
    calculationLines: lines,
    events,
    inferredEvents,
    dailyTimeline,
    headlineExplanations: {
      projectedMonthEnd: confirmedFutureEvents.map(eventComponent),
      lowestBalance: confirmedFutureEvents
        .filter((event) => event.date <= confirmedLow.date)
        .map(eventComponent),
      safeToSpend: lines,
      expectedIncome: confirmedFutureEvents
        .filter((event) => event.amountMinor > 0)
        .map(eventComponent),
      upcomingCommitments: confirmedFutureEvents
        .filter((event) => event.amountMinor < 0)
        .map(eventComponent),
    },
    workspaceWarning:
      input.workspaceMode === "MIXED"
        ? "Mixed demo and user provenance lowers confidence; review source records."
        : null,
  };
}

function eventComponent(event: CashFlowEvent) {
  return {
    id: event.id,
    label: event.label,
    date: event.date,
    amountMinor: event.amountMinor,
    source: event.source,
    status: event.status ?? event.kind,
  };
}

function lowestBalance(startingMinor: number, events: CashFlowEvent[], asOf: Date) {
  let balance = startingMinor;
  let lowest = startingMinor;
  let date = asOf;
  for (const event of [...events].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
  )) {
    balance += event.amountMinor;
    if (balance < lowest) {
      lowest = balance;
      date = event.date;
    }
  }
  return { amountMinor: lowest, date };
}

function buildDailyTimeline(
  start: Date,
  end: Date,
  startingMinor: number,
  confirmed: CashFlowEvent[],
  inferred: CashFlowEvent[],
) {
  const rows: {
    date: Date;
    confirmedBalanceMinor: number;
    likelyBalanceMinor: number;
    conservativeBalanceMinor: number;
  }[] = [];
  let confirmedBalance = startingMinor;
  let likelyBalance = startingMinor;
  let conservativeBalance = startingMinor;
  for (
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    cursor < end;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const key = cursor.toISOString().slice(0, 10);
    const confirmedToday = confirmed
      .filter((event) => event.date.toISOString().slice(0, 10) === key)
      .reduce((sum, event) => sum + event.amountMinor, 0);
    const inferredToday = inferred
      .filter((event) => event.date.toISOString().slice(0, 10) === key)
      .reduce((sum, event) => sum + event.amountMinor, 0);
    const inferredExpenseToday = inferred
      .filter((event) => event.date.toISOString().slice(0, 10) === key && event.amountMinor < 0)
      .reduce((sum, event) => sum + event.amountMinor, 0);
    confirmedBalance += confirmedToday;
    likelyBalance += confirmedToday + inferredToday;
    conservativeBalance += confirmedToday + inferredExpenseToday;
    rows.push({
      date: new Date(cursor),
      confirmedBalanceMinor: confirmedBalance,
      likelyBalanceMinor: likelyBalance,
      conservativeBalanceMinor: conservativeBalance,
    });
  }
  return rows;
}
