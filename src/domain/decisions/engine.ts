import {
  calculateCashFlow,
  type CashFlowInput,
  type CashFlowProjection,
} from "@/domain/cash-flow/engine";
import {
  calculatePayoff,
  compareStrategy,
  type DebtInput,
  type PayoffResult,
} from "@/domain/debt/payoff";
import { monthDifference, projectGoalCompletion } from "@/domain/goals/projection";
import { financialPeriod } from "@/domain/cash-flow/period";
import {
  calculateEmergencyRunway,
  type EmergencyRunwayResult,
} from "@/domain/planning/emergency-runway";
import type { ScenarioComponentInput } from "./schema";
import { formatMoney } from "@/domain/money/money";

export type ScenarioComponent = ScenarioComponentInput & { id: string };
export type ScenarioRisk = {
  level: "POSITIVE" | "WARNING" | "CRITICAL" | "INFO";
  code: string;
  title: string;
  explanation: string;
};

export type ScenarioMetric = {
  key: string;
  label: string;
  currentMinor: number;
  scenarioMinor: number;
  differenceMinor: number;
  explanation: string;
};

export type ScenarioComponentImpact = {
  componentId: string;
  name: string;
  type: ScenarioComponent["type"];
  oneTimeMinor: number;
  ongoingMonthlyMinor: number;
  currentPeriodMinor: number;
  firstYearMinor: number;
  boundedLongTermMinor: number | null;
  currentPeriodOccurrences: number;
  firstYearOccurrences: number;
  boundedOccurrences: number | null;
  explanation: string;
};

export type ScenarioImpactHorizons = {
  oneTimeMinor: number;
  ongoingMonthlyMinor: number;
  currentPeriodMinor: number;
  firstYearMinor: number;
  boundedLongTermMinor: number | null;
  currentPeriodOneTimeMinor: number;
  currentPeriodRecurringMinor: number;
  currentPeriodInteractionMinor: number;
  components: ScenarioComponentImpact[];
};

export type ScenarioEvaluation = {
  baseline: CashFlowProjection;
  scenario: CashFlowProjection;
  metrics: ScenarioMetric[];
  risks: ScenarioRisk[];
  confidence: "HIGH" | "MODERATE" | "LIMITED";
  timeline: CashFlowProjection["events"];
  goalImpacts: {
    id: string;
    name: string;
    currentDate: Date | null;
    scenarioDate: Date | null;
    differenceMonths: number | null;
    currentMonthlyMinor: number;
    scenarioMonthlyMinor: number;
    mode: "FIXED" | "SCENARIO_ADJUSTED";
    affordable: boolean;
    explanation: string;
  }[];
  baselineDebt: PayoffResult;
  scenarioDebt: ReturnType<typeof compareStrategy>;
  baselineEmergencyRunwayBps: number | null;
  scenarioEmergencyRunwayBps: number | null;
  baselineEmergencyBalanceMinor: number;
  scenarioEmergencyBalanceMinor: number;
  baselineEssentialMonthlyMinor: number;
  scenarioEssentialMonthlyMinor: number;
  baselineEmergencyRunway: EmergencyRunwayResult;
  scenarioEmergencyRunway: EmergencyRunwayResult;
  impacts: ScenarioImpactHorizons;
  interpretations: string[];
  validation: string[];
};

export function evaluateScenario(input: {
  cashFlowInput: CashFlowInput;
  debtInputs: DebtInput[];
  debtStrategy: "AVALANCHE" | "SNOWBALL" | "CUSTOM";
  debtExtraPaymentMinor: number;
  debtCustomOrder: string[];
  components: ScenarioComponent[];
}): ScenarioEvaluation {
  const baselineInput = cloneCashFlowInput(input.cashFlowInput);
  const overlay = cloneCashFlowInput(input.cashFlowInput);
  const validation: string[] = [];
  if (new Set(input.components.map((component) => component.id)).size !== input.components.length)
    validation.push("A scenario component appears more than once.");
  let scenarioDebtExtraMinor = input.debtExtraPaymentMinor;
  const modeledImpacts = buildImpactHorizons(input.cashFlowInput, input.components);
  const currentPeriod = financialPeriod(overlay.asOf, overlay.financialMonthStart);

  for (const component of input.components) {
    if (!componentIsActive(component, overlay.asOf)) continue;
    const start = component.startDate ?? overlay.asOf;
    if (start >= currentPeriod.end) continue;
    const recurring = !["ONE_TIME_EXPENSE", "ONE_TIME_INCOME"].includes(component.type);
    const date = recurring ? firstMonthlyOccurrence(start, overlay.asOf) : start;
    const id = `scenario-${component.id}`;
    if (component.type === "CANCEL_RECURRING") {
      const found = overlay.recurring.find((item) => item.id === component.linkedRecurringId);
      if (!found || found.status !== "CONFIRMED")
        validation.push(`${component.name}: linked recurring item is unavailable.`);
      const effective = component.startDate ?? overlay.asOf;
      overlay.recurring = overlay.recurring.filter(
        (item) =>
          item.id !== component.linkedRecurringId ||
          !item.nextExpectedDate ||
          item.nextExpectedDate < effective,
      );
      overlay.scheduledObligations = overlay.scheduledObligations?.map((item) =>
        item.recurringExpenseId === component.linkedRecurringId
          ? {
              ...item,
              occurrences: item.occurrences.filter(
                (occurrence) => occurrence.expectedDate < effective,
              ),
            }
          : item,
      );
      overlay.expectedIncomeSchedules = overlay.expectedIncomeSchedules?.map((item) =>
        item.recurringExpenseId === component.linkedRecurringId
          ? {
              ...item,
              occurrences: item.occurrences.filter(
                (occurrence) => occurrence.expectedDate < effective,
              ),
            }
          : item,
      );
      continue;
    }
    if (component.type === "SAVINGS_POLICY_OVERRIDE") {
      overlay.savingsPolicy = {
        ...overlay.savingsPolicy!,
        mode: component.policyMode ?? overlay.savingsPolicy!.mode,
        targetBps: component.targetBasisPoints ?? overlay.savingsPolicy!.targetBps,
        minimumDiscretionaryReserveMinor:
          component.minimumDiscretionaryReserveMinor ??
          overlay.savingsPolicy!.minimumDiscretionaryReserveMinor,
        extraSafetyReserveMinor:
          component.extraSafetyReserveMinor ?? overlay.savingsPolicy!.extraSafetyReserveMinor,
        minimumCashRetainedMinor:
          component.minimumCashRetainedMinor ?? overlay.savingsPolicy!.minimumCashRetainedMinor,
      };
      continue;
    }
    if (component.type === "CHECKING_BUFFER_OVERRIDE") {
      overlay.checkingBufferMinor = component.amountMinor ?? overlay.checkingBufferMinor;
      continue;
    }
    if (component.type === "SAVINGS_CHANGE") {
      if (component.linkedGoalId) {
        const goal = overlay.goals.find((item) => item.id === component.linkedGoalId);
        if (!goal) validation.push(`${component.name}: linked goal is unavailable.`);
        else
          goal.plannedMonthlyMinor = Math.max(
            0,
            goal.plannedMonthlyMinor + (component.amountMinor ?? 0),
          );
      } else {
        const active = overlay.goals.filter((goal) => !goal.archivedAt);
        if (!active.length) validation.push(`${component.name}: no active goal is available.`);
        else
          active[0]!.plannedMonthlyMinor = Math.max(
            0,
            active[0]!.plannedMonthlyMinor + (component.amountMinor ?? 0),
          );
      }
      continue;
    }
    if (component.type === "DEBT_EXTRA_PAYMENT") {
      if (
        !input.debtInputs.some(
          (debt) => debt.id === component.linkedDebtAccountId && !debt.archivedAt,
        )
      )
        validation.push(`${component.name}: linked debt is unavailable.`);
      scenarioDebtExtraMinor += component.amountMinor ?? 0;
      addObligation(overlay, id, component.name, component.amountMinor ?? 0, date);
      continue;
    }
    if (component.type === "VEHICLE_PAYMENT") {
      const monthly =
        (component.amountMinor ?? 0) +
        (component.insuranceIncreaseMinor ?? 0) +
        (component.operatingIncreaseMinor ?? 0);
      addObligation(overlay, id, component.name, monthly, date);
      const upfront = (component.tradeInMinor ?? 0) - (component.secondaryAmountMinor ?? 0);
      if (upfront < 0 && start >= overlay.asOf)
        addObligation(
          overlay,
          `${id}-down`,
          `${component.name} net upfront cost`,
          Math.abs(upfront),
          start,
        );
      if (upfront > 0 && start >= overlay.asOf)
        addIncome(
          overlay,
          `${id}-trade`,
          `${component.name} net trade-in proceeds`,
          upfront,
          start,
        );
      continue;
    }
    if (component.type === "RECURRING_EXPENSE" || component.type === "ONE_TIME_EXPENSE") {
      if (component.type === "ONE_TIME_EXPENSE" && start < overlay.asOf) continue;
      addObligation(overlay, id, component.name, Math.abs(component.amountMinor ?? 0), date);
      continue;
    }
    if (component.type === "ONE_TIME_INCOME" || component.type === "RECURRING_INCOME_CHANGE") {
      if (component.type === "ONE_TIME_INCOME" && start < overlay.asOf) continue;
      const amount = component.amountMinor ?? 0;
      if (amount >= 0) addIncome(overlay, id, component.name, amount, date);
      else addObligation(overlay, id, `${component.name} reduction`, Math.abs(amount), date);
    }
  }

  const baseline = calculateCashFlow(baselineInput);
  const scenario = calculateCashFlow(overlay);
  const currentPeriodMinor = scenario.projectedMonthEndMinor - baseline.projectedMonthEndMinor;
  const impacts: ScenarioImpactHorizons = {
    ...modeledImpacts,
    currentPeriodMinor,
    currentPeriodInteractionMinor:
      currentPeriodMinor -
      modeledImpacts.currentPeriodOneTimeMinor -
      modeledImpacts.currentPeriodRecurringMinor,
  };
  const baselineDebt = calculatePayoff({
    debts: input.debtInputs,
    strategy: input.debtStrategy,
    extraPaymentMinor: input.debtExtraPaymentMinor,
    customOrder: input.debtCustomOrder,
    asOf: overlay.asOf,
  });
  const scenarioDebtRaw = calculatePayoff({
    debts: input.debtInputs,
    strategy: input.debtStrategy,
    extraPaymentMinor: scenarioDebtExtraMinor,
    customOrder: input.debtCustomOrder,
    asOf: overlay.asOf,
  });
  const scenarioDebt = compareStrategy(scenarioDebtRaw, baselineDebt);
  const fixedCapacityMinor = Math.max(
    0,
    scenario.cashAfterObligationsAndProtectionsMinor + scenario.committedPlannedSavingsMinor,
  );
  const allFixedAffordable = scenario.committedPlannedSavingsMinor <= fixedCapacityMinor;
  const goalImpacts = baselineInput.goals
    .filter((goal) => !goal.archivedAt)
    .map((goal) => {
      const changed = overlay.goals.find((item) => item.id === goal.id) ?? goal;
      const currentDate = projectGoalCompletion(goal, overlay.asOf);
      const scenarioDate = projectGoalCompletion(changed, overlay.asOf);
      const adjusted = changed.plannedMonthlyMinor !== goal.plannedMonthlyMinor;
      return {
        id: goal.id,
        name: goal.name,
        currentDate,
        scenarioDate,
        differenceMonths: monthDifference(currentDate, scenarioDate),
        currentMonthlyMinor: goal.plannedMonthlyMinor,
        scenarioMonthlyMinor: changed.plannedMonthlyMinor,
        mode: adjusted ? ("SCENARIO_ADJUSTED" as const) : ("FIXED" as const),
        affordable: adjusted || allFixedAffordable,
        explanation: adjusted
          ? "This scenario explicitly changes the goal contribution, so its projected date is recalculated."
          : allFixedAffordable
            ? "This scenario does not change the goal date because its planned contribution is fixed."
            : "The contribution remains fixed, but it exceeds available planning capacity; the goal plan is at risk.",
      };
    });
  const baselineEmergencyRunway = calculateEmergencyRunway(baselineInput);
  const emergencyAccountIds = new Set(
    baselineInput.emergencyFundConfiguration?.enabled
      ? baselineInput.emergencyFundConfiguration.accounts.map((account) => account.accountId)
      : [],
  );
  const emergencyWithdrawals = impacts.components
    .filter(
      (impact) =>
        impact.oneTimeMinor < 0 &&
        emergencyAccountIds.has(
          input.components.find((component) => component.id === impact.componentId)
            ?.linkedAccountId ?? "",
        ),
    )
    .map((impact) => {
      const component = input.components.find((item) => item.id === impact.componentId)!;
      return {
        id: impact.componentId,
        label: component.name,
        accountId: component.linkedAccountId!,
        amountMinor: Math.abs(impact.oneTimeMinor),
      };
    });
  const scenarioMonthlyChanges = input.components.flatMap((component) => {
    const monthly = componentCashAmounts(input.cashFlowInput, component).monthlyMinor;
    if (!monthly) return [];
    if (component.type === "CANCEL_RECURRING") {
      const recurring = input.cashFlowInput.recurring.find(
        (item) => item.id === component.linkedRecurringId,
      );
      return recurring?.classification === "ESSENTIAL" && recurring.recurringType === "EXPENSE"
        ? [{ id: component.id, label: component.name, amountMinor: monthly, essential: true }]
        : [];
    }
    if (!["RECURRING_EXPENSE", "VEHICLE_PAYMENT"].includes(component.type)) return [];
    return [
      {
        id: component.id,
        label: component.name,
        amountMinor: Math.abs(monthly),
        essential: component.essentiality === "ESSENTIAL",
      },
    ];
  });
  const scenarioEmergencyRunway = calculateEmergencyRunway(baselineInput, {
    withdrawals: emergencyWithdrawals,
    monthlyChanges: scenarioMonthlyChanges,
  });
  const baselineEmergencyBalanceMinor = baselineEmergencyRunway.eligibleBalanceMinor;
  const scenarioEmergencyBalanceMinor = scenarioEmergencyRunway.eligibleBalanceMinor;
  const baselineEssentialMonthlyMinor = baselineEmergencyRunway.essentialMonthlyMinor;
  const scenarioEssentialMonthlyMinor = scenarioEmergencyRunway.essentialMonthlyMinor;
  const baselineRunway = baselineEmergencyRunway.runwayBasisPoints;
  const scenarioRunway = scenarioEmergencyRunway.runwayBasisPoints;
  const metrics = buildMetrics(baseline, scenario);
  const risks = buildRisks({
    baseline,
    scenario,
    baselineRunway,
    scenarioRunway,
    goalImpacts,
    scenarioDebt,
    validation,
    impacts,
    targetRunwayBasisPoints: scenarioEmergencyRunway.targetRunwayBasisPoints,
  });
  const confidence =
    validation.length ||
    scenario.confidence === "LIMITED" ||
    baselineEmergencyRunway.confidence === "LIMITED" ||
    scenarioEmergencyRunway.confidence === "LIMITED"
      ? "LIMITED"
      : scenario.confidence === "MODERATE" || input.components.some((item) => !item.startDate)
        ? "MODERATE"
        : "HIGH";
  return {
    baseline,
    scenario,
    metrics,
    risks,
    confidence,
    timeline: scenario.events.filter(
      (event) =>
        event.id.startsWith("obligation-scenario-") ||
        event.id.startsWith("income-scenario-") ||
        event.id === "current",
    ),
    goalImpacts,
    baselineDebt,
    scenarioDebt,
    baselineEmergencyRunwayBps: baselineRunway,
    scenarioEmergencyRunwayBps: scenarioRunway,
    baselineEmergencyBalanceMinor,
    scenarioEmergencyBalanceMinor,
    baselineEssentialMonthlyMinor,
    scenarioEssentialMonthlyMinor,
    baselineEmergencyRunway,
    scenarioEmergencyRunway,
    impacts,
    interpretations: buildInterpretations({
      impacts,
      goalImpacts,
      scenarioDebt,
      baselineRunway,
      scenarioRunway,
    }),
    validation,
  };
}

function cloneCashFlowInput(input: CashFlowInput): CashFlowInput {
  return {
    ...input,
    accounts: input.accounts.map((item) => ({ ...item })),
    transactions: input.transactions.map((item) => ({ ...item })),
    recurring: input.recurring.map((item) => ({ ...item })),
    goals: input.goals.map((item) => ({
      ...item,
      contributions: item.contributions.map((value) => ({ ...value })),
    })),
    importBatches: input.importBatches.map((item) => ({ ...item })),
    expectedIncomeSchedules: input.expectedIncomeSchedules?.map((item) => ({
      ...item,
      occurrences: item.occurrences.map((value) => ({ ...value })),
    })),
    scheduledObligations: input.scheduledObligations?.map((item) => ({
      ...item,
      occurrences: item.occurrences.map((value) => ({ ...value })),
    })),
    savingsPolicy: input.savingsPolicy ? { ...input.savingsPolicy } : undefined,
    emergencyFundConfiguration: input.emergencyFundConfiguration
      ? {
          ...input.emergencyFundConfiguration,
          accounts: input.emergencyFundConfiguration.accounts.map((account) => ({ ...account })),
        }
      : input.emergencyFundConfiguration,
  };
}

function componentIsActive(component: ScenarioComponent, asOf: Date) {
  if (component.endDate && component.endDate < asOf) return false;
  if (component.durationMonths && component.startDate) {
    const end = new Date(
      Date.UTC(
        component.startDate.getUTCFullYear(),
        component.startDate.getUTCMonth() + component.durationMonths,
        1,
      ),
    );
    if (end < asOf) return false;
  }
  return true;
}

function addObligation(
  input: CashFlowInput,
  id: string,
  name: string,
  amountMinor: number,
  date: Date,
) {
  input.scheduledObligations ??= [];
  input.scheduledObligations.push({
    id,
    name,
    confidence: "HIGH",
    active: true,
    archivedAt: null,
    recurringExpenseId: null,
    debtAccountId: null,
    goalId: null,
    occurrences: [{ id, expectedDate: date, expectedAmountMinor: amountMinor, status: "UPCOMING" }],
  });
}

function addIncome(
  input: CashFlowInput,
  id: string,
  name: string,
  amountMinor: number,
  date: Date,
) {
  input.expectedIncomeSchedules ??= [];
  input.expectedIncomeSchedules.push({
    id,
    name,
    confidence: "HIGH",
    active: true,
    archivedAt: null,
    occurrences: [{ id, expectedDate: date, expectedAmountMinor: amountMinor, status: "UPCOMING" }],
  });
}

function buildImpactHorizons(
  input: CashFlowInput,
  components: ScenarioComponent[],
): Omit<ScenarioImpactHorizons, "currentPeriodMinor" | "currentPeriodInteractionMinor"> {
  const period = financialPeriod(input.asOf, input.financialMonthStart);
  const yearEnd = addUtcMonths(input.asOf, 12);
  const impacts = components.map((component) => {
    const { oneTimeMinor, monthlyMinor, explanation } = componentCashAmounts(input, component);
    const start = componentImpactStart(input, component);
    const componentEnd = componentEndDate(component);
    const oneTimeInPeriod =
      oneTimeMinor !== 0 && start >= input.asOf && start < period.end ? oneTimeMinor : 0;
    const oneTimeInYear =
      oneTimeMinor !== 0 && start >= input.asOf && start < yearEnd ? oneTimeMinor : 0;
    const currentPeriodOccurrences =
      monthlyMinor === 0 ? 0 : countMonthlyOccurrences(start, input.asOf, period.end, componentEnd);
    const firstYearOccurrences =
      monthlyMinor === 0 ? 0 : countMonthlyOccurrences(start, input.asOf, yearEnd, componentEnd);
    const bounded = boundedOccurrenceCount(component, input.asOf);
    return {
      componentId: component.id,
      name: component.name,
      type: component.type,
      oneTimeMinor,
      ongoingMonthlyMinor: monthlyMinor,
      currentPeriodMinor: oneTimeInPeriod + monthlyMinor * currentPeriodOccurrences,
      firstYearMinor: oneTimeInYear + monthlyMinor * firstYearOccurrences,
      boundedLongTermMinor:
        bounded == null
          ? oneTimeMinor !== 0 && monthlyMinor === 0
            ? oneTimeMinor
            : null
          : (start >= input.asOf ? oneTimeMinor : 0) + monthlyMinor * bounded,
      currentPeriodOccurrences,
      firstYearOccurrences,
      boundedOccurrences: bounded,
      explanation,
    };
  });
  const oneTimeMinor = impacts.reduce((sum, impact) => sum + impact.oneTimeMinor, 0);
  const ongoingMonthlyMinor = impacts.reduce((sum, impact) => sum + impact.ongoingMonthlyMinor, 0);
  const currentPeriodOneTimeMinor = impacts.reduce(
    (sum, impact) =>
      sum +
      (impact.currentPeriodMinor - impact.ongoingMonthlyMinor * impact.currentPeriodOccurrences),
    0,
  );
  const currentPeriodRecurringMinor = impacts.reduce(
    (sum, impact) => sum + impact.ongoingMonthlyMinor * impact.currentPeriodOccurrences,
    0,
  );
  const boundedValues = impacts.map((impact) => impact.boundedLongTermMinor);
  return {
    oneTimeMinor,
    ongoingMonthlyMinor,
    currentPeriodOneTimeMinor,
    currentPeriodRecurringMinor,
    firstYearMinor: impacts.reduce((sum, impact) => sum + impact.firstYearMinor, 0),
    boundedLongTermMinor: boundedValues.every((value) => value != null)
      ? boundedValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null,
    components: impacts,
  };
}

function componentImpactStart(input: CashFlowInput, component: ScenarioComponent) {
  const effective = component.startDate ?? input.asOf;
  if (component.type !== "CANCEL_RECURRING") return effective;
  const recurring = input.recurring.find((item) => item.id === component.linkedRecurringId);
  if (!recurring?.nextExpectedDate) return effective;
  return firstMonthlyOccurrence(recurring.nextExpectedDate, effective);
}

function componentCashAmounts(input: CashFlowInput, component: ScenarioComponent) {
  switch (component.type) {
    case "ONE_TIME_EXPENSE":
      return {
        oneTimeMinor: -Math.abs(component.amountMinor ?? 0),
        monthlyMinor: 0,
        explanation: "One-time purchase or obligation.",
      };
    case "ONE_TIME_INCOME":
      return {
        oneTimeMinor: Math.abs(component.amountMinor ?? 0),
        monthlyMinor: 0,
        explanation: "One-time net income assumption.",
      };
    case "RECURRING_EXPENSE":
      return {
        oneTimeMinor: 0,
        monthlyMinor: -Math.abs(component.amountMinor ?? 0),
        explanation: "Ongoing monthly expense.",
      };
    case "RECURRING_INCOME_CHANGE":
      return {
        oneTimeMinor: 0,
        monthlyMinor: component.amountMinor ?? 0,
        explanation: "Ongoing net monthly income change; no gross-to-net conversion.",
      };
    case "DEBT_EXTRA_PAYMENT":
      return {
        oneTimeMinor: 0,
        monthlyMinor: -Math.abs(component.amountMinor ?? 0),
        explanation:
          "Additional monthly debt payment; interest savings remain a separate long-term debt result.",
      };
    case "SAVINGS_CHANGE":
      return {
        oneTimeMinor: 0,
        monthlyMinor: -(component.amountMinor ?? 0),
        explanation: "Change to a fixed monthly goal contribution.",
      };
    case "VEHICLE_PAYMENT": {
      const down = Math.abs(component.secondaryAmountMinor ?? 0);
      const trade = Math.abs(component.tradeInMinor ?? 0);
      const monthly =
        Math.abs(component.amountMinor ?? 0) +
        Math.abs(component.insuranceIncreaseMinor ?? 0) +
        Math.abs(component.operatingIncreaseMinor ?? 0);
      return {
        oneTimeMinor: trade - down,
        monthlyMinor: -monthly,
        explanation: `Vehicle: ${formatMoney(Math.abs(component.amountMinor ?? 0))} loan payment, ${formatMoney(Math.abs(component.insuranceIncreaseMinor ?? 0))} added insurance, and ${formatMoney(Math.abs(component.operatingIncreaseMinor ?? 0))} added operating costs per month; ${formatMoney(down)} down payment and ${formatMoney(trade)} trade-in credit upfront.`,
      };
    }
    case "CANCEL_RECURRING": {
      const recurring = input.recurring.find((item) => item.id === component.linkedRecurringId);
      const monthly =
        recurring?.monthlyEquivalentMinor ?? Math.abs(recurring?.typicalAmountMinor ?? 0);
      return {
        oneTimeMinor: 0,
        monthlyMinor: monthly,
        explanation: "Monthly savings after the effective date; historical charges are unchanged.",
      };
    }
    default:
      return {
        oneTimeMinor: 0,
        monthlyMinor: 0,
        explanation:
          "Policy or reserve override; effects appear through the shared Cash Flow allocation.",
      };
  }
}

function componentEndDate(component: ScenarioComponent): Date | null {
  const durationEnd =
    component.durationMonths && component.startDate
      ? addUtcMonths(component.startDate, component.durationMonths)
      : null;
  if (component.endDate && durationEnd)
    return component.endDate < durationEnd ? component.endDate : durationEnd;
  return component.endDate ?? durationEnd;
}

function countMonthlyOccurrences(start: Date, rangeStart: Date, rangeEnd: Date, end: Date | null) {
  let occurrence = firstMonthlyOccurrence(start, rangeStart);
  let count = 0;
  while (occurrence < rangeEnd && (!end || occurrence < end)) {
    count += 1;
    occurrence = addUtcMonths(occurrence, 1);
  }
  return count;
}

function boundedOccurrenceCount(component: ScenarioComponent, asOf: Date): number | null {
  const end = componentEndDate(component);
  if (!end || !component.startDate) return null;
  return countMonthlyOccurrences(component.startDate, asOf, end, end);
}

function firstMonthlyOccurrence(start: Date, rangeStart: Date) {
  if (start >= rangeStart) return start;
  const months =
    (rangeStart.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    rangeStart.getUTCMonth() -
    start.getUTCMonth();
  let candidate = addUtcMonths(start, Math.max(0, months));
  if (candidate < rangeStart) candidate = addUtcMonths(candidate, 1);
  return candidate;
}

function addUtcMonths(date: Date, months: number) {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function buildMetrics(current: CashFlowProjection, scenario: CashFlowProjection): ScenarioMetric[] {
  return [
    metric(
      "periodNet",
      "Current-period net cash flow",
      current.projectedMonthEndMinor - current.startingUsableLiquidCashMinor,
      scenario.projectedMonthEndMinor - scenario.startingUsableLiquidCashMinor,
      "Expected income less obligations, debt minimums, and planned savings in the selected financial period.",
    ),
    metric(
      "cashAfter",
      "Cash after obligations and protections",
      current.cashAfterObligationsAndProtectionsMinor,
      scenario.cashAfterObligationsAndProtectionsMinor,
      "Cash remaining after known obligations and protection reserves.",
    ),
    metric(
      "allocatable",
      "Allocatable surplus",
      current.allocatableSurplusMinor,
      scenario.allocatableSurplusMinor,
      "Cash available after the retained safety reserve.",
    ),
    metric(
      "recommended",
      "Recommended Safe to Save",
      current.recommendedSafeToSaveMinor,
      scenario.recommendedSafeToSaveMinor,
      "Savings-policy recommendation from the validated Cash Flow engine.",
    ),
    metric(
      "conservative",
      "Conservative Safe to Save",
      current.conservativeSafeToSaveMinor,
      scenario.conservativeSafeToSaveMinor,
      "Confidence-adjusted recommendation.",
    ),
    metric(
      "spend",
      "Safe to Spend",
      current.safeToSpendMinor,
      scenario.safeToSpendMinor,
      "Allocatable cash remaining after recommended saving.",
    ),
    metric(
      "monthEnd",
      "Projected month-end",
      current.projectedMonthEndMinor,
      scenario.projectedMonthEndMinor,
      "Current liquid cash plus remaining planned monthly movement.",
    ),
    metric(
      "commitments",
      "Required monthly commitments",
      current.remainingEssentialObligationsMinor +
        current.debtMinimumPaymentsMinor +
        current.committedPlannedSavingsMinor,
      scenario.remainingEssentialObligationsMinor +
        scenario.debtMinimumPaymentsMinor +
        scenario.committedPlannedSavingsMinor,
      "Obligations, debt minimums, and planned savings in the active period.",
    ),
  ];
}

function metric(
  key: string,
  label: string,
  currentMinor: number,
  scenarioMinor: number,
  explanation: string,
): ScenarioMetric {
  return {
    key,
    label,
    currentMinor,
    scenarioMinor,
    differenceMinor: scenarioMinor - currentMinor,
    explanation,
  };
}

function buildRisks(input: {
  baseline: CashFlowProjection;
  scenario: CashFlowProjection;
  baselineRunway: number | null;
  scenarioRunway: number | null;
  goalImpacts: ScenarioEvaluation["goalImpacts"];
  scenarioDebt: ScenarioEvaluation["scenarioDebt"];
  validation: string[];
  impacts: ScenarioImpactHorizons;
  targetRunwayBasisPoints: number | null;
}): ScenarioRisk[] {
  const risks: ScenarioRisk[] = input.validation.map((explanation) => ({
    level: "CRITICAL",
    code: "INVALID_LINK",
    title: "Scenario input needs review",
    explanation,
  }));
  if (input.scenario.projectedMonthEndMinor < 0)
    risks.push({
      level: "CRITICAL",
      code: "NEGATIVE_CASH_FLOW",
      title: "Scenario creates negative projected cash",
      explanation: `Projected month-end is below zero after scenario obligations.`,
    });
  if (input.scenario.safeToSpendMinor < input.baseline.safeToSpendMinor)
    risks.push({
      level: "WARNING",
      code: "SAFE_TO_SPEND_DOWN",
      title: "Safe to Spend decreases",
      explanation: `Scenario reduces Safe to Spend by ${formatMoney(input.baseline.safeToSpendMinor - input.scenario.safeToSpendMinor)}.`,
    });
  if (
    input.scenarioRunway != null &&
    input.targetRunwayBasisPoints != null &&
    input.scenarioRunway < input.targetRunwayBasisPoints
  )
    risks.push({
      level: "WARNING",
      code: "RUNWAY_LOW",
      title: "Emergency runway is below the configured target",
      explanation: `Emergency runway is ${(input.scenarioRunway / 10_000).toFixed(1)} months versus the configured ${(input.targetRunwayBasisPoints / 10_000).toFixed(1)}-month target.`,
    });
  if (input.goalImpacts.some((goal) => (goal.differenceMonths ?? 0) > 0))
    risks.push({
      level: "WARNING",
      code: "GOAL_DELAY",
      title: "A goal is delayed",
      explanation:
        "At least one goal completion estimate moves later under the scenario contribution plan.",
    });
  if (input.goalImpacts.some((goal) => !goal.affordable))
    risks.push({
      level: "CRITICAL",
      code: "FIXED_GOAL_UNAFFORDABLE",
      title: "A fixed goal contribution exceeds available planning capacity",
      explanation:
        "The goal is not automatically changed, but its current contribution plan is at risk.",
    });
  if ((input.scenarioDebt.interestSavedMinor ?? 0) > 0)
    risks.push({
      level: "POSITIVE",
      code: "DEBT_IMPROVES",
      title: "Debt cost improves",
      explanation: `The existing payoff engine estimates ${formatMoney(input.scenarioDebt.interestSavedMinor ?? 0)} less interest.`,
    });
  if (!risks.length)
    risks.push({
      level: "INFO",
      code: "NO_MATERIAL_RISK",
      title: "No deterministic threshold triggered",
      explanation: "Review the before-and-after metrics and assumptions before deciding.",
    });
  return risks;
}

function buildInterpretations(input: {
  impacts: ScenarioImpactHorizons;
  goalImpacts: ScenarioEvaluation["goalImpacts"];
  scenarioDebt: ScenarioEvaluation["scenarioDebt"];
  baselineRunway: number | null;
  scenarioRunway: number | null;
}) {
  const items: string[] = [];
  if (input.impacts.oneTimeMinor)
    items.push(
      `This scenario has ${cashDirection(input.impacts.oneTimeMinor)} upfront impact of ${formatMinor(Math.abs(input.impacts.oneTimeMinor))}.`,
    );
  if (input.impacts.ongoingMonthlyMinor)
    items.push(
      `It ${input.impacts.ongoingMonthlyMinor < 0 ? "adds" : "removes"} ${formatMinor(Math.abs(input.impacts.ongoingMonthlyMinor))} per month.`,
    );
  if (input.impacts.currentPeriodOneTimeMinor && input.impacts.currentPeriodRecurringMinor)
    items.push("The current financial period includes both an upfront event and recurring impact.");
  const fixed = input.goalImpacts.find((goal) => goal.mode === "FIXED");
  if (fixed) items.push(fixed.explanation);
  if (
    input.baselineRunway != null &&
    input.scenarioRunway != null &&
    input.scenarioRunway < input.baselineRunway
  )
    items.push(
      "Emergency runway falls because emergency cash or ongoing essential obligations worsen.",
    );
  if ((input.scenarioDebt.interestSavedMinor ?? 0) > 0)
    items.push(
      "Debt payoff improves, but interest savings are long-term savings—not current cash.",
    );
  return items;
}

function cashDirection(value: number) {
  return value < 0 ? "a cash reduction" : "a cash increase";
}

function formatMinor(value: number) {
  const dollars = Math.floor(value / 100);
  const cents = String(value % 100).padStart(2, "0");
  return `$${dollars.toLocaleString("en-US")}.${cents}`;
}
