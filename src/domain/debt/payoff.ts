export const MAX_PAYOFF_MONTHS = 600;

export type DebtStrategy = "MINIMUM_ONLY" | "AVALANCHE" | "SNOWBALL" | "CUSTOM";
export type DebtConfidence = "HIGH" | "MODERATE" | "LIMITED";

export type DebtInput = {
  id: string;
  name: string;
  type: string;
  balanceMinor: number;
  aprBasisPoints: number | null;
  minimumPaymentMinor: number | null;
  dueDay: number | null;
  archivedAt?: Date | null;
  reconciliationStatus?: string | null;
  balanceConfidence?: string | null;
  lastReconciledAt?: Date | null;
};

export type DebtIssueCode =
  | "NOT_ACTIVE_DEBT"
  | "ZERO_BALANCE"
  | "MISSING_APR"
  | "MISSING_MINIMUM"
  | "ZERO_MINIMUM"
  | "MISSING_DUE_DATE"
  | "NEGATIVE_AMORTIZATION"
  | "CUSTOM_ORDER_INCOMPLETE"
  | "PAYOFF_HORIZON_EXCEEDED";

export type DebtIssue = {
  debtId: string;
  code: DebtIssueCode;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
};

export type DebtPeriodDetail = {
  debtId: string;
  name: string;
  startingBalanceMinor: number;
  interestMinor: number;
  minimumPaymentMinor: number;
  extraPaymentMinor: number;
  totalPaymentMinor: number;
  principalMinor: number;
  endingBalanceMinor: number;
};

export type DebtSchedulePeriod = {
  period: string;
  startingDebtMinor: number;
  interestMinor: number;
  requiredMinimumsMinor: number;
  extraPaymentMinor: number;
  totalPaymentMinor: number;
  principalMinor: number;
  endingDebtMinor: number;
  paidOffDebtIds: string[];
  remainingActiveDebts: number;
  debts: DebtPeriodDetail[];
};

export type DebtMilestone = { debtId: string; name: string; period: string; month: number };

export type PayoffResult = {
  available: boolean;
  strategy: DebtStrategy;
  issues: DebtIssue[];
  orderedDebtIds: string[];
  monthsToPayoff: number | null;
  debtFreeDate: Date | null;
  totalInterestMinor: number | null;
  totalPaidMinor: number | null;
  totalStartingDebtMinor: number;
  initialMonthlyPaymentMinor: number;
  firstDebtPaidOff: DebtMilestone | null;
  milestones: DebtMilestone[];
  schedule: DebtSchedulePeriod[];
  confidence: DebtConfidence;
};

export type StrategyComparison = PayoffResult & {
  interestSavedMinor: number | null;
  timeSavedMonths: number | null;
};

const LIABILITY_TYPES = new Set(["CREDIT", "LOAN", "MORTGAGE"]);

export function monthlyInterestMinor(balanceMinor: number, aprBasisPoints: number): number {
  if (balanceMinor <= 0 || aprBasisPoints <= 0) return 0;
  const numerator = BigInt(balanceMinor) * BigInt(aprBasisPoints);
  return Number((numerator + BigInt(60_000)) / BigInt(120_000));
}

export function weightedAprBasisPoints(debts: DebtInput[]): number {
  const total = debts.reduce((sum, debt) => sum + Math.max(0, debt.balanceMinor), 0);
  if (!total) return 0;
  return Math.round(
    debts.reduce(
      (sum, debt) => sum + Math.max(0, debt.balanceMinor) * (debt.aprBasisPoints ?? 0),
      0,
    ) / total,
  );
}

export function orderDebts(
  debts: DebtInput[],
  strategy: Exclude<DebtStrategy, "MINIMUM_ONLY">,
  customOrder: string[] = [],
): DebtInput[] {
  if (strategy === "CUSTOM") {
    const rank = new Map(customOrder.map((id, index) => [id, index]));
    return [...debts].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    );
  }
  return [...debts].sort((a, b) =>
    strategy === "AVALANCHE"
      ? (b.aprBasisPoints ?? 0) - (a.aprBasisPoints ?? 0) ||
        a.balanceMinor - b.balanceMinor ||
        a.id.localeCompare(b.id)
      : a.balanceMinor - b.balanceMinor ||
        (b.aprBasisPoints ?? 0) - (a.aprBasisPoints ?? 0) ||
        a.id.localeCompare(b.id),
  );
}

export function validateDebtInputs(
  debts: DebtInput[],
  strategy: DebtStrategy,
  customOrder: string[] = [],
): { eligible: DebtInput[]; issues: DebtIssue[] } {
  const eligible: DebtInput[] = [];
  const issues: DebtIssue[] = [];
  for (const debt of debts) {
    if (debt.archivedAt || !LIABILITY_TYPES.has(debt.type)) {
      issues.push(
        issue(debt, "NOT_ACTIVE_DEBT", "INFO", "Account is not an active supported debt."),
      );
      continue;
    }
    if (debt.balanceMinor <= 0) {
      issues.push(issue(debt, "ZERO_BALANCE", "INFO", "Debt has no amount currently owed."));
      continue;
    }
    let valid = true;
    if (debt.aprBasisPoints == null) {
      issues.push(issue(debt, "MISSING_APR", "CRITICAL", "Add an APR before calculating payoff."));
      valid = false;
    }
    if (debt.minimumPaymentMinor == null) {
      issues.push(
        issue(
          debt,
          "MISSING_MINIMUM",
          "CRITICAL",
          "Add a minimum payment before calculating payoff.",
        ),
      );
      valid = false;
    } else if (debt.minimumPaymentMinor === 0) {
      issues.push(
        issue(debt, "ZERO_MINIMUM", "CRITICAL", "Minimum payment must be greater than zero."),
      );
      valid = false;
    }
    if (debt.dueDay == null) {
      issues.push(issue(debt, "MISSING_DUE_DATE", "WARNING", "Add a monthly due day."));
      valid = false;
    }
    if (
      debt.aprBasisPoints != null &&
      debt.minimumPaymentMinor != null &&
      debt.minimumPaymentMinor <= monthlyInterestMinor(debt.balanceMinor, debt.aprBasisPoints)
    ) {
      issues.push(
        issue(
          debt,
          "NEGATIVE_AMORTIZATION",
          "CRITICAL",
          "Minimum payment does not exceed estimated monthly interest.",
        ),
      );
      valid = false;
    }
    if (valid) eligible.push(debt);
  }
  if (strategy === "CUSTOM" && eligible.length) {
    const eligibleIds = new Set(eligible.map((debt) => debt.id));
    const supplied = customOrder.filter(
      (id, index) => eligibleIds.has(id) && customOrder.indexOf(id) === index,
    );
    if (supplied.length !== eligible.length) {
      issues.push({
        debtId: "plan",
        code: "CUSTOM_ORDER_INCOMPLETE",
        severity: "CRITICAL",
        message: "Custom order must include every eligible debt exactly once.",
      });
    }
  }
  return { eligible, issues };
}

export function calculatePayoff(input: {
  debts: DebtInput[];
  strategy: DebtStrategy;
  extraPaymentMinor?: number;
  customOrder?: string[];
  asOf: Date;
  maxMonths?: number;
}): PayoffResult {
  const extraPaymentMinor = Math.max(0, Math.trunc(input.extraPaymentMinor ?? 0));
  const customOrder = input.customOrder ?? [];
  const validation = validateDebtInputs(input.debts, input.strategy, customOrder);
  const blocking = validation.issues.some((item) => item.severity === "CRITICAL");
  const totalStartingDebtMinor = validation.eligible.reduce(
    (sum, debt) => sum + debt.balanceMinor,
    0,
  );
  const initialMonthlyPaymentMinor =
    validation.eligible.reduce((sum, debt) => sum + (debt.minimumPaymentMinor ?? 0), 0) +
    extraPaymentMinor;
  if (blocking || validation.eligible.length === 0) {
    return unavailable(
      input.strategy,
      validation.issues,
      totalStartingDebtMinor,
      initialMonthlyPaymentMinor,
    );
  }

  const ordered =
    input.strategy === "MINIMUM_ONLY"
      ? [...validation.eligible].sort((a, b) => a.id.localeCompare(b.id))
      : orderDebts(validation.eligible, input.strategy, customOrder);
  const balances = new Map(ordered.map((debt) => [debt.id, debt.balanceMinor]));
  const schedule: DebtSchedulePeriod[] = [];
  const milestones: DebtMilestone[] = [];
  const maxMonths = input.maxMonths ?? MAX_PAYOFF_MONTHS;
  const strategyBudgetMinor = initialMonthlyPaymentMinor;

  for (let month = 1; month <= maxMonths; month += 1) {
    const active = ordered.filter((debt) => (balances.get(debt.id) ?? 0) > 0);
    if (!active.length) break;
    const startingDebtMinor = active.reduce((sum, debt) => sum + (balances.get(debt.id) ?? 0), 0);
    const details = new Map<string, DebtPeriodDetail>();
    let requiredMinimumsMinor = 0;
    let totalInterestMinor = 0;
    let paidSoFarMinor = 0;

    for (const debt of active) {
      const startingBalanceMinor = balances.get(debt.id) ?? 0;
      const interestMinor = monthlyInterestMinor(startingBalanceMinor, debt.aprBasisPoints ?? 0);
      const amountDueMinor = startingBalanceMinor + interestMinor;
      const minimumPaymentMinor = Math.min(debt.minimumPaymentMinor ?? 0, amountDueMinor);
      requiredMinimumsMinor += minimumPaymentMinor;
      totalInterestMinor += interestMinor;
      paidSoFarMinor += minimumPaymentMinor;
      details.set(debt.id, {
        debtId: debt.id,
        name: debt.name,
        startingBalanceMinor,
        interestMinor,
        minimumPaymentMinor,
        extraPaymentMinor: 0,
        totalPaymentMinor: minimumPaymentMinor,
        principalMinor: minimumPaymentMinor - interestMinor,
        endingBalanceMinor: amountDueMinor - minimumPaymentMinor,
      });
    }

    let surplusMinor =
      input.strategy === "MINIMUM_ONLY" ? 0 : Math.max(0, strategyBudgetMinor - paidSoFarMinor);
    for (const debt of active) {
      if (surplusMinor <= 0) break;
      const detail = details.get(debt.id)!;
      const applied = Math.min(surplusMinor, detail.endingBalanceMinor);
      detail.extraPaymentMinor += applied;
      detail.totalPaymentMinor += applied;
      detail.principalMinor += applied;
      detail.endingBalanceMinor -= applied;
      paidSoFarMinor += applied;
      surplusMinor -= applied;
    }

    const periodDate = addUtcMonths(input.asOf, month);
    const paidOffDebtIds: string[] = [];
    for (const debt of active) {
      const detail = details.get(debt.id)!;
      balances.set(debt.id, detail.endingBalanceMinor);
      if (detail.endingBalanceMinor === 0) {
        paidOffDebtIds.push(debt.id);
        milestones.push({ debtId: debt.id, name: debt.name, period: isoMonth(periodDate), month });
      }
    }
    const endingDebtMinor = [...details.values()].reduce(
      (sum, detail) => sum + detail.endingBalanceMinor,
      0,
    );
    schedule.push({
      period: isoMonth(periodDate),
      startingDebtMinor,
      interestMinor: totalInterestMinor,
      requiredMinimumsMinor,
      extraPaymentMinor: [...details.values()].reduce(
        (sum, detail) => sum + detail.extraPaymentMinor,
        0,
      ),
      totalPaymentMinor: paidSoFarMinor,
      principalMinor: paidSoFarMinor - totalInterestMinor,
      endingDebtMinor,
      paidOffDebtIds,
      remainingActiveDebts: [...balances.values()].filter((balance) => balance > 0).length,
      debts: active.map((debt) => details.get(debt.id)!),
    });
  }

  if ([...balances.values()].some((balance) => balance > 0)) {
    const issues = [
      ...validation.issues,
      {
        debtId: "plan",
        code: "PAYOFF_HORIZON_EXCEEDED" as const,
        severity: "CRITICAL" as const,
        message: `Debt was not repaid within ${maxMonths} months.`,
      },
    ];
    return {
      ...unavailable(input.strategy, issues, totalStartingDebtMinor, initialMonthlyPaymentMinor),
      schedule,
    };
  }

  const totalInterestMinor = schedule.reduce((sum, period) => sum + period.interestMinor, 0);
  const monthsToPayoff = schedule.length;
  return {
    available: true,
    strategy: input.strategy,
    issues: validation.issues,
    orderedDebtIds: ordered.map((debt) => debt.id),
    monthsToPayoff,
    debtFreeDate: addUtcMonths(input.asOf, monthsToPayoff),
    totalInterestMinor,
    totalPaidMinor: totalStartingDebtMinor + totalInterestMinor,
    totalStartingDebtMinor,
    initialMonthlyPaymentMinor,
    firstDebtPaidOff: milestones[0] ?? null,
    milestones,
    schedule,
    confidence: confidenceFor(ordered, input.asOf),
  };
}

export function compareStrategy(result: PayoffResult, baseline: PayoffResult): StrategyComparison {
  return {
    ...result,
    interestSavedMinor:
      result.totalInterestMinor == null || baseline.totalInterestMinor == null
        ? null
        : baseline.totalInterestMinor - result.totalInterestMinor,
    timeSavedMonths:
      result.monthsToPayoff == null || baseline.monthsToPayoff == null
        ? null
        : baseline.monthsToPayoff - result.monthsToPayoff,
  };
}

function unavailable(
  strategy: DebtStrategy,
  issues: DebtIssue[],
  totalStartingDebtMinor: number,
  initialMonthlyPaymentMinor: number,
): PayoffResult {
  return {
    available: false,
    strategy,
    issues,
    orderedDebtIds: [],
    monthsToPayoff: null,
    debtFreeDate: null,
    totalInterestMinor: null,
    totalPaidMinor: null,
    totalStartingDebtMinor,
    initialMonthlyPaymentMinor,
    firstDebtPaidOff: null,
    milestones: [],
    schedule: [],
    confidence: "LIMITED",
  };
}

function issue(
  debt: DebtInput,
  code: DebtIssueCode,
  severity: DebtIssue["severity"],
  message: string,
): DebtIssue {
  return { debtId: debt.id, code, severity, message };
}

function confidenceFor(debts: DebtInput[], asOf: Date): DebtConfidence {
  if (
    debts.some(
      (debt) =>
        debt.balanceConfidence === "LIMITED" ||
        debt.reconciliationStatus === "NEEDS_SETUP" ||
        !debt.lastReconciledAt,
    )
  )
    return "LIMITED";
  const stale = debts.some(
    (debt) => asOf.getTime() - (debt.lastReconciledAt?.getTime() ?? 0) > 45 * 86_400_000,
  );
  return stale || debts.some((debt) => debt.balanceConfidence === "MODERATE") ? "MODERATE" : "HIGH";
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function isoMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
