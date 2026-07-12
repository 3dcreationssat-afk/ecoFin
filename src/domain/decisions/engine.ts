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
import type { ScenarioComponentInput } from "./schema";

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
  }[];
  baselineDebt: PayoffResult;
  scenarioDebt: ReturnType<typeof compareStrategy>;
  baselineEmergencyRunwayBps: number | null;
  scenarioEmergencyRunwayBps: number | null;
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
  let scenarioDebtExtraMinor = input.debtExtraPaymentMinor;

  for (const component of input.components) {
    if (!componentIsActive(component, overlay.asOf)) continue;
    const date = component.startDate ?? overlay.asOf;
    const id = `scenario-${component.id}`;
    if (component.type === "CANCEL_RECURRING") {
      const found = overlay.recurring.find((item) => item.id === component.linkedRecurringId);
      if (!found || found.status !== "CONFIRMED")
        validation.push(`${component.name}: linked recurring item is unavailable.`);
      overlay.recurring = overlay.recurring.filter(
        (item) => item.id !== component.linkedRecurringId,
      );
      overlay.scheduledObligations = overlay.scheduledObligations?.filter(
        (item) => item.recurringExpenseId !== component.linkedRecurringId,
      );
      overlay.expectedIncomeSchedules = overlay.expectedIncomeSchedules?.filter(
        (item) => item.recurringExpenseId !== component.linkedRecurringId,
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
      const oneTime = Math.max(
        0,
        (component.secondaryAmountMinor ?? 0) - (component.tradeInMinor ?? 0),
      );
      if (oneTime)
        addObligation(overlay, `${id}-down`, `${component.name} down payment`, oneTime, date);
      continue;
    }
    if (component.type === "RECURRING_EXPENSE" || component.type === "ONE_TIME_EXPENSE") {
      addObligation(overlay, id, component.name, Math.abs(component.amountMinor ?? 0), date);
      continue;
    }
    if (component.type === "ONE_TIME_INCOME" || component.type === "RECURRING_INCOME_CHANGE") {
      const amount = component.amountMinor ?? 0;
      if (amount >= 0) addIncome(overlay, id, component.name, amount, date);
      else addObligation(overlay, id, `${component.name} reduction`, Math.abs(amount), date);
    }
  }

  const baseline = calculateCashFlow(baselineInput);
  const scenario = calculateCashFlow(overlay);
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
  const goalImpacts = baselineInput.goals
    .filter((goal) => !goal.archivedAt)
    .map((goal) => {
      const changed = overlay.goals.find((item) => item.id === goal.id) ?? goal;
      const currentDate = projectGoalCompletion(goal, overlay.asOf);
      const scenarioDate = projectGoalCompletion(changed, overlay.asOf);
      return {
        id: goal.id,
        name: goal.name,
        currentDate,
        scenarioDate,
        differenceMonths: monthDifference(currentDate, scenarioDate),
        currentMonthlyMinor: goal.plannedMonthlyMinor,
        scenarioMonthlyMinor: changed.plannedMonthlyMinor,
      };
    });
  const baselineRunway = emergencyRunwayBps(baseline);
  const scenarioRunway = emergencyRunwayBps(scenario);
  const metrics = buildMetrics(baseline, scenario);
  const risks = buildRisks({
    baseline,
    scenario,
    baselineRunway,
    scenarioRunway,
    goalImpacts,
    scenarioDebt,
    validation,
  });
  const confidence =
    validation.length || scenario.confidence === "LIMITED"
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

function buildMetrics(current: CashFlowProjection, scenario: CashFlowProjection): ScenarioMetric[] {
  return [
    metric(
      "monthlyNet",
      "Monthly net cash flow",
      current.projectedMonthEndMinor - current.startingUsableLiquidCashMinor,
      scenario.projectedMonthEndMinor - scenario.startingUsableLiquidCashMinor,
      "Expected income less obligations, debt minimums, and planned savings.",
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

function emergencyRunwayBps(projection: CashFlowProjection): number | null {
  const essential =
    projection.remainingEssentialObligationsMinor + projection.debtMinimumPaymentsMinor;
  return essential > 0
    ? Math.round((projection.emergencyProtectedMinor * 10_000) / essential)
    : null;
}

function buildRisks(input: {
  baseline: CashFlowProjection;
  scenario: CashFlowProjection;
  baselineRunway: number | null;
  scenarioRunway: number | null;
  goalImpacts: ScenarioEvaluation["goalImpacts"];
  scenarioDebt: ScenarioEvaluation["scenarioDebt"];
  validation: string[];
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
      explanation: `Scenario reduces Safe to Spend by ${input.baseline.safeToSpendMinor - input.scenario.safeToSpendMinor} minor units.`,
    });
  if (input.scenarioRunway != null && input.scenarioRunway < 30_000)
    risks.push({
      level: "WARNING",
      code: "RUNWAY_LOW",
      title: "Emergency runway is below three months",
      explanation: `Linked emergency funds cover ${input.scenarioRunway} basis points of one month of essential obligations.`,
    });
  if (input.goalImpacts.some((goal) => (goal.differenceMonths ?? 0) > 0))
    risks.push({
      level: "WARNING",
      code: "GOAL_DELAY",
      title: "A goal is delayed",
      explanation:
        "At least one goal completion estimate moves later under the scenario contribution plan.",
    });
  if ((input.scenarioDebt.interestSavedMinor ?? 0) > 0)
    risks.push({
      level: "POSITIVE",
      code: "DEBT_IMPROVES",
      title: "Debt cost improves",
      explanation: `The existing payoff engine estimates ${input.scenarioDebt.interestSavedMinor} minor units less interest.`,
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
