import { describe, expect, it } from "vitest";
import type { CashFlowInput } from "@/domain/cash-flow/engine";
import type { DebtInput } from "@/domain/debt/payoff";
import { evaluateScenario, type ScenarioComponent } from "./engine";

const asOf = new Date("2026-07-12T00:00:00.000Z");

function cashInput(): CashFlowInput {
  return {
    asOf,
    financialMonthStart: 1,
    checkingBufferMinor: 100_000,
    emergencyFundTargetMinor: 600_000,
    workspaceMode: "USER_DATA",
    accounts: [
      {
        id: "checking",
        name: "Checking",
        type: "CHECKING",
        openingBalanceMinor: 1_000_000,
        ledgerBalanceMinor: 1_000_000,
        ledgerStatus: "CURRENT",
        reconciliationStatus: "RECONCILED",
        reconciliationDifferenceMinor: 0,
        reportedAvailableMinor: 1_000_000,
        reportedBalanceAsOf: asOf,
        minimumPaymentMinor: null,
        dueDay: null,
      },
      {
        id: "card",
        name: "Card",
        type: "CREDIT",
        openingBalanceMinor: 100_000,
        ledgerBalanceMinor: 100_000,
        ledgerStatus: "CURRENT",
        reconciliationStatus: "RECONCILED",
        reconciliationDifferenceMinor: 0,
        reportedAvailableMinor: null,
        reportedBalanceAsOf: asOf,
        minimumPaymentMinor: 5_000,
        dueDay: 20,
      },
    ],
    transactions: [],
    recurring: [
      {
        id: "subscription",
        displayName: "Subscription",
        typicalAmountMinor: 2_000,
        nextExpectedDate: new Date("2026-07-20T00:00:00.000Z"),
        status: "CONFIRMED",
        userConfirmed: true,
        recurringType: "SUBSCRIPTION",
        confidence: "HIGH",
      },
    ],
    goals: [
      {
        id: "emergency",
        name: "Emergency Fund",
        plannedMonthlyMinor: 20_000,
        currentMinor: 300_000,
        targetMinor: 600_000,
        linkedAccountId: "checking",
        archivedAt: null,
        contributions: [],
      },
      {
        id: "travel",
        name: "Travel",
        plannedMonthlyMinor: 10_000,
        currentMinor: 0,
        targetMinor: 120_000,
        linkedAccountId: "checking",
        archivedAt: null,
        contributions: [],
      },
    ],
    importBatches: [],
    expectedIncomeSchedules: [
      {
        id: "income",
        name: "Paycheck",
        confidence: "HIGH",
        active: true,
        archivedAt: null,
        occurrences: [
          {
            id: "income-1",
            expectedDate: new Date("2026-07-25T00:00:00.000Z"),
            expectedAmountMinor: 300_000,
            status: "UPCOMING",
          },
        ],
      },
    ],
    scheduledObligations: [],
    savingsPolicy: {
      mode: "BALANCED",
      targetBps: 5_000,
      minimumDiscretionaryReserveMinor: 50_000,
      extraSafetyReserveMinor: 0,
      minimumCashRetainedMinor: 100_000,
      includeGoalContributions: true,
      emergencyShortfallIncreasesRecommendation: false,
      conservativeAdjustmentBps: 2_000,
    },
  };
}

function debtInputs(): DebtInput[] {
  return [
    {
      id: "card",
      name: "Card",
      type: "CREDIT",
      balanceMinor: 100_000,
      aprBasisPoints: 1_800,
      minimumPaymentMinor: 5_000,
      dueDay: 20,
      reconciliationStatus: "RECONCILED",
      balanceConfidence: "HIGH",
      lastReconciledAt: asOf,
    },
  ];
}

function component(
  type: ScenarioComponent["type"],
  overrides: Partial<ScenarioComponent> = {},
): ScenarioComponent {
  return {
    id: `component-${type}`,
    type,
    name: type,
    amountMinor: 10_000,
    startDate: new Date("2026-07-15T00:00:00.000Z"),
    ...overrides,
  };
}

function evaluate(components: ScenarioComponent[]) {
  return evaluateScenario({
    cashFlowInput: cashInput(),
    debtInputs: debtInputs(),
    debtStrategy: "AVALANCHE",
    debtExtraPaymentMinor: 0,
    debtCustomOrder: [],
    components,
  });
}

describe("decision scenario engine", () => {
  it("applies recurring and one-time expenses in the financial period", () => {
    const result = evaluate([
      component("RECURRING_EXPENSE"),
      component("ONE_TIME_EXPENSE", { id: "purchase", amountMinor: 25_000 }),
    ]);
    expect(result.scenario.projectedMonthEndMinor - result.baseline.projectedMonthEndMinor).toBe(
      -35_000,
    );
  });

  it("applies recurring income increases, reductions, and one-time income", () => {
    const result = evaluate([
      component("RECURRING_INCOME_CHANGE", { amountMinor: 20_000 }),
      component("RECURRING_INCOME_CHANGE", { id: "reduction", amountMinor: -5_000 }),
      component("ONE_TIME_INCOME", { amountMinor: 7_500 }),
    ]);
    expect(result.scenario.projectedMonthEndMinor - result.baseline.projectedMonthEndMinor).toBe(
      22_500,
    );
  });

  it("removes a confirmed subscription without mutating the source input", () => {
    const source = cashInput();
    const result = evaluateScenario({
      cashFlowInput: source,
      debtInputs: debtInputs(),
      debtStrategy: "AVALANCHE",
      debtExtraPaymentMinor: 0,
      debtCustomOrder: [],
      components: [
        component("CANCEL_RECURRING", { amountMinor: null, linkedRecurringId: "subscription" }),
      ],
    });
    expect(result.scenario.projectedMonthEndMinor - result.baseline.projectedMonthEndMinor).toBe(
      2_000,
    );
    expect(source.recurring).toHaveLength(1);
  });

  it("models vehicle payment and net down payment", () => {
    const result = evaluate([
      component("VEHICLE_PAYMENT", {
        amountMinor: 40_000,
        secondaryAmountMinor: 200_000,
        insuranceIncreaseMinor: 5_000,
        operatingIncreaseMinor: 3_000,
        tradeInMinor: 50_000,
      }),
    ]);
    expect(result.scenario.projectedMonthEndMinor - result.baseline.projectedMonthEndMinor).toBe(
      -198_000,
    );
  });

  it("reuses debt payoff for extra-payment improvement", () => {
    const result = evaluate([
      component("DEBT_EXTRA_PAYMENT", { amountMinor: 20_000, linkedDebtAccountId: "card" }),
    ]);
    expect(result.scenarioDebt.monthsToPayoff).toBeLessThan(
      result.baselineDebt.monthsToPayoff ?? Infinity,
    );
    expect(result.scenarioDebt.interestSavedMinor).toBeGreaterThan(0);
  });

  it("applies savings change and projects goal improvement", () => {
    const result = evaluate([
      component("SAVINGS_CHANGE", { amountMinor: 10_000, linkedGoalId: "travel" }),
    ]);
    const goal = result.goalImpacts.find((item) => item.id === "travel");
    expect(goal?.scenarioMonthlyMinor).toBe(20_000);
    expect(goal?.differenceMonths).toBeLessThan(0);
  });

  it("supports savings-policy and checking-buffer overrides", () => {
    const result = evaluate([
      component("SAVINGS_POLICY_OVERRIDE", {
        amountMinor: null,
        policyMode: "CUSTOM",
        targetBasisPoints: 8_000,
        minimumDiscretionaryReserveMinor: 75_000,
      }),
      component("CHECKING_BUFFER_OVERRIDE", { amountMinor: 1_200_000 }),
    ]);
    expect(result.scenario.effectiveSavingsTargetBps).toBe(8_000);
    expect(result.scenario.checkingBufferReserveMinor).toBe(200_000);
  });

  it("honors end dates and duration", () => {
    const ended = evaluate([
      component("RECURRING_EXPENSE", { endDate: new Date("2026-06-01T00:00:00.000Z") }),
      component("RECURRING_EXPENSE", {
        id: "duration-ended",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        durationMonths: 2,
      }),
    ]);
    expect(ended.scenario.projectedMonthEndMinor).toBe(ended.baseline.projectedMonthEndMinor);
  });

  it("respects financial-month boundaries for future events", () => {
    const result = evaluate([
      component("ONE_TIME_EXPENSE", { startDate: new Date("2026-08-02T00:00:00.000Z") }),
    ]);
    expect(result.scenario.projectedMonthEndMinor).toBe(result.baseline.projectedMonthEndMinor);
  });

  it("calculates emergency runway and negative-cash risks deterministically", () => {
    const result = evaluate([component("ONE_TIME_EXPENSE", { amountMinor: 2_000_000 })]);
    expect(result.baselineEmergencyRunwayBps).not.toBeNull();
    expect(result.risks.map((item) => item.code)).toContain("NEGATIVE_CASH_FLOW");
  });

  it("lowers confidence for missing links and dates", () => {
    const result = evaluate([
      component("DEBT_EXTRA_PAYMENT", {
        linkedDebtAccountId: "missing",
        startDate: null,
      }),
    ]);
    expect(result.confidence).toBe("LIMITED");
    expect(result.validation).toHaveLength(1);
  });

  it("reconciles all comparison differences in integer cents", () => {
    const result = evaluate([component("RECURRING_EXPENSE", { amountMinor: 12_345 })]);
    for (const metric of result.metrics) {
      expect(metric.scenarioMinor - metric.currentMinor).toBe(metric.differenceMinor);
      expect(Number.isInteger(metric.differenceMinor)).toBe(true);
    }
  });
});
