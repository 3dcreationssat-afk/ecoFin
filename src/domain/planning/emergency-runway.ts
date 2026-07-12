import type { CashFlowInput } from "@/domain/cash-flow/engine";

export type EmergencyRunwayAdjustment = {
  withdrawals?: { id: string; label: string; accountId: string; amountMinor: number }[];
  monthlyChanges?: { id: string; label: string; amountMinor: number; essential: boolean }[];
};

export type EmergencyRunwayResult = {
  eligibleBalanceMinor: number;
  essentialMonthlyMinor: number;
  runwayBasisPoints: number | null;
  confidence: "HIGH" | "LIMITED";
  sources: {
    goalId: string;
    goalName: string;
    accountId: string;
    accountName: string;
    ledgerBalanceMinor: number;
    protectedMinor: number;
    withdrawalMinor: number;
    resultingEligibleMinor: number;
  }[];
  obligations: {
    id: string;
    label: string;
    source: "SCHEDULED" | "DEBT_MINIMUM" | "RECURRING" | "SCENARIO";
    monthlyMinor: number;
  }[];
  exclusions: string[];
  issues: string[];
};

const LIABILITY = new Set(["CREDIT", "LOAN", "MORTGAGE"]);

export function calculateEmergencyRunway(
  input: CashFlowInput,
  adjustment: EmergencyRunwayAdjustment = {},
): EmergencyRunwayResult {
  const issues: string[] = [];
  const exclusions: string[] = [];
  const withdrawals = adjustment.withdrawals ?? [];
  const emergencyGoals = input.goals
    .filter((goal) => !goal.archivedAt && /emergency/i.test(goal.name) && goal.linkedAccountId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const mappedAccounts = new Set<string>();
  const sources: EmergencyRunwayResult["sources"] = [];

  for (const goal of emergencyGoals) {
    const account = input.accounts.find((item) => item.id === goal.linkedAccountId);
    if (!account || account.archivedAt) {
      issues.push(`${goal.name} is mapped to a missing or archived account.`);
      continue;
    }
    if (mappedAccounts.has(account.id)) {
      issues.push(`${account.name} is mapped to more than one emergency-fund goal.`);
      continue;
    }
    mappedAccounts.add(account.id);
    const ledgerBalanceMinor = Math.max(0, account.ledgerBalanceMinor ?? 0);
    const protectedMinor = Math.min(ledgerBalanceMinor, goal.currentMinor, goal.targetMinor);
    const withdrawalMinor = withdrawals
      .filter((item) => item.accountId === account.id)
      .reduce((sum, item) => sum + Math.max(0, item.amountMinor), 0);
    sources.push({
      goalId: goal.id,
      goalName: goal.name,
      accountId: account.id,
      accountName: account.name,
      ledgerBalanceMinor,
      protectedMinor,
      withdrawalMinor,
      resultingEligibleMinor: Math.max(0, protectedMinor - withdrawalMinor),
    });
  }
  if (!sources.length) issues.push("No eligible emergency fund is configured.");

  const obligations: EmergencyRunwayResult["obligations"] = [];
  const linkedRecurring = new Set<string>();
  const linkedDebt = new Set<string>();
  const fingerprints = new Set<string>();
  for (const obligation of input.scheduledObligations ?? []) {
    if (!obligation.active || obligation.archivedAt || obligation.essentiality !== "ESSENTIAL") {
      exclusions.push(`${obligation.name}: not an active essential scheduled obligation.`);
      continue;
    }
    if (!obligation.frequency || obligation.amountMinor == null) {
      issues.push(`${obligation.name} lacks an amount or frequency.`);
      continue;
    }
    const monthlyMinor = normalizeMonthly(obligation.amountMinor, obligation.frequency);
    if (monthlyMinor <= 0) {
      exclusions.push(
        `${obligation.name}: one-time costs are excluded from the monthly denominator.`,
      );
      continue;
    }
    const fingerprint = `${obligation.name.trim().toLowerCase()}|${monthlyMinor}`;
    if (fingerprints.has(fingerprint)) {
      issues.push(`${obligation.name} appears to duplicate another scheduled obligation.`);
      continue;
    }
    fingerprints.add(fingerprint);
    obligations.push({
      id: obligation.id,
      label: obligation.name,
      source: "SCHEDULED",
      monthlyMinor,
    });
    if (obligation.recurringExpenseId) linkedRecurring.add(obligation.recurringExpenseId);
    if (obligation.debtAccountId) linkedDebt.add(obligation.debtAccountId);
  }

  for (const account of input.accounts) {
    if (
      account.archivedAt ||
      !LIABILITY.has(account.type) ||
      (account.ledgerBalanceMinor ?? 0) <= 0 ||
      linkedDebt.has(account.id)
    )
      continue;
    const monthlyMinor = Math.min(
      Math.max(0, account.minimumPaymentMinor ?? 0),
      account.ledgerBalanceMinor ?? 0,
    );
    if (!monthlyMinor) {
      issues.push(`${account.name} lacks a usable debt minimum.`);
      continue;
    }
    obligations.push({
      id: `debt-${account.id}`,
      label: `${account.name} minimum payment`,
      source: "DEBT_MINIMUM",
      monthlyMinor,
    });
  }

  for (const recurring of input.recurring) {
    if (
      recurring.status !== "CONFIRMED" ||
      recurring.classification !== "ESSENTIAL" ||
      recurring.recurringType !== "EXPENSE" ||
      linkedRecurring.has(recurring.id)
    )
      continue;
    const monthlyMinor = recurring.monthlyEquivalentMinor ?? Math.abs(recurring.typicalAmountMinor);
    obligations.push({
      id: `recurring-${recurring.id}`,
      label: recurring.displayName,
      source: "RECURRING",
      monthlyMinor,
    });
  }

  for (const change of adjustment.monthlyChanges ?? []) {
    if (!change.essential) {
      exclusions.push(`${change.label}: optional scenario costs are excluded.`);
      continue;
    }
    obligations.push({
      id: `scenario-${change.id}`,
      label: change.label,
      source: "SCENARIO",
      monthlyMinor: change.amountMinor,
    });
  }

  const eligibleBalanceMinor = sources.reduce(
    (sum, source) => sum + source.resultingEligibleMinor,
    0,
  );
  const essentialMonthlyMinor = Math.max(
    0,
    obligations.reduce((sum, obligation) => sum + obligation.monthlyMinor, 0),
  );
  if (!essentialMonthlyMinor)
    issues.push("No complete essential monthly obligations are configured.");
  return {
    eligibleBalanceMinor,
    essentialMonthlyMinor,
    runwayBasisPoints:
      essentialMonthlyMinor > 0
        ? roundDiv(eligibleBalanceMinor * 10_000, essentialMonthlyMinor)
        : null,
    confidence: issues.length ? "LIMITED" : "HIGH",
    sources,
    obligations,
    exclusions,
    issues,
  };
}

export function normalizeMonthly(amountMinor: number, frequency: string) {
  switch (frequency) {
    case "ONE_TIME":
      return 0;
    case "WEEKLY":
      return roundDiv(amountMinor * 52, 12);
    case "BIWEEKLY":
    case "BI_WEEKLY":
      return roundDiv(amountMinor * 26, 12);
    case "TWICE_MONTHLY":
      return amountMinor * 2;
    case "MONTHLY":
      return amountMinor;
    case "QUARTERLY":
      return roundDiv(amountMinor, 3);
    case "SEMIANNUAL":
      return roundDiv(amountMinor, 6);
    case "ANNUAL":
      return roundDiv(amountMinor, 12);
    default:
      return 0;
  }
}

function roundDiv(numerator: number, denominator: number) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}
