import { describe, expect, it } from "vitest";
import type { CashFlowInput } from "@/domain/cash-flow/engine";
import { calculateEmergencyRunway, normalizeMonthly } from "./emergency-runway";

function input(): CashFlowInput {
  return {
    asOf: new Date("2026-07-12T00:00:00Z"),
    financialMonthStart: 1,
    checkingBufferMinor: 100_000,
    emergencyFundTargetMinor: 600_000,
    workspaceMode: "USER_DATA",
    accounts: [
      account("checking", "Checking", "CHECKING", 900_000),
      account("savings", "Savings", "SAVINGS", 500_000),
      { ...account("card", "Card", "CREDIT", 100_000), minimumPaymentMinor: 5_000 },
    ],
    transactions: [],
    recurring: [],
    goals: [
      {
        id: "emergency",
        name: "Emergency Fund",
        plannedMonthlyMinor: 20_000,
        currentMinor: 300_000,
        targetMinor: 600_000,
        linkedAccountId: "savings",
        archivedAt: null,
        contributions: [],
      },
      {
        id: "travel",
        name: "Travel",
        plannedMonthlyMinor: 10_000,
        currentMinor: 200_000,
        targetMinor: 400_000,
        linkedAccountId: "savings",
        archivedAt: null,
        contributions: [],
      },
    ],
    importBatches: [],
    scheduledObligations: [
      obligation("rent", "Rent", 100_000, "ESSENTIAL"),
      obligation("optional", "Dining", 25_000, "DISCRETIONARY"),
      obligation("one-time", "Deposit", 50_000, "ESSENTIAL", "ONE_TIME"),
    ],
  };
}

function account(id: string, name: string, type: string, balance: number) {
  return {
    id,
    name,
    type,
    openingBalanceMinor: balance,
    ledgerBalanceMinor: balance,
    ledgerStatus: "CURRENT",
    reconciliationStatus: "RECONCILED",
    reconciliationDifferenceMinor: 0,
    reportedAvailableMinor: balance,
    reportedBalanceAsOf: new Date("2026-07-12T00:00:00Z"),
    minimumPaymentMinor: null,
    dueDay: null,
  };
}

function obligation(
  id: string,
  name: string,
  amountMinor: number,
  essentiality: string,
  frequency = "MONTHLY",
) {
  return {
    id,
    name,
    amountMinor,
    frequency,
    confidence: "HIGH",
    active: true,
    archivedAt: null,
    recurringExpenseId: null,
    debtAccountId: null,
    goalId: null,
    essentiality,
    occurrences: [],
  };
}

describe("emergency runway", () => {
  it("uses only the protected amount of an explicitly mapped active asset", () => {
    const result = calculateEmergencyRunway(input());
    expect(result.eligibleBalanceMinor).toBe(300_000);
    expect(result.sources[0]).toMatchObject({
      accountId: "savings",
      ledgerBalanceMinor: 500_000,
      protectedMinor: 300_000,
    });
  });

  it("does not count an account twice through duplicate emergency goals", () => {
    const data = input();
    data.goals.push({ ...data.goals[0], id: "emergency-2" });
    const result = calculateEmergencyRunway(data);
    expect(result.eligibleBalanceMinor).toBe(300_000);
    expect(result.issues.join(" ")).toContain("more than one emergency-fund goal");
  });

  it("includes essentials and debt minimums but excludes optional and one-time costs", () => {
    const result = calculateEmergencyRunway(input());
    expect(result.essentialMonthlyMinor).toBe(105_000);
    expect(result.obligations.map((item) => item.label)).toEqual(["Rent", "Card minimum payment"]);
  });

  it("excludes goal plans, planned savings, and extra debt payments", () => {
    const result = calculateEmergencyRunway(input(), {
      monthlyChanges: [
        { id: "goal", label: "Goal increase", amountMinor: 10_000, essential: false },
        { id: "extra", label: "Debt extra", amountMinor: 20_000, essential: false },
      ],
    });
    expect(result.essentialMonthlyMinor).toBe(105_000);
  });

  it("reduces only the numerator for an emergency-funded one-time cost", () => {
    const result = calculateEmergencyRunway(input(), {
      withdrawals: [
        { id: "purchase", label: "Purchase", accountId: "savings", amountMinor: 75_000 },
      ],
    });
    expect(result.eligibleBalanceMinor).toBe(225_000);
    expect(result.essentialMonthlyMinor).toBe(105_000);
  });

  it("deduplicates linked scheduled, debt, and recurring obligations", () => {
    const data = input();
    data.scheduledObligations![0].debtAccountId = "card";
    data.scheduledObligations![0].recurringExpenseId = "rent-recurring";
    data.recurring.push({
      id: "rent-recurring",
      displayName: "Rent recurring",
      typicalAmountMinor: 100_000,
      monthlyEquivalentMinor: 100_000,
      nextExpectedDate: data.asOf,
      status: "CONFIRMED",
      userConfirmed: true,
      recurringType: "EXPENSE",
      classification: "ESSENTIAL",
      confidence: "HIGH",
    });
    expect(calculateEmergencyRunway(data).essentialMonthlyMinor).toBe(100_000);
  });

  it("never treats recurring income as an essential obligation", () => {
    const data = input();
    data.recurring.push({
      id: "payroll",
      displayName: "Payroll",
      typicalAmountMinor: 500_000,
      monthlyEquivalentMinor: 500_000,
      nextExpectedDate: data.asOf,
      status: "CONFIRMED",
      userConfirmed: true,
      recurringType: "INCOME",
      classification: "ESSENTIAL",
      confidence: "HIGH",
    });
    expect(calculateEmergencyRunway(data).essentialMonthlyMinor).toBe(105_000);
  });

  it("returns unavailable and Limited with a zero denominator", () => {
    const data = input();
    data.scheduledObligations = [];
    data.accounts = data.accounts.filter((item) => item.id !== "card");
    const result = calculateEmergencyRunway(data);
    expect(result.runwayBasisPoints).toBeNull();
    expect(result.confidence).toBe("LIMITED");
  });

  it("returns zero runway for a configured zero emergency balance", () => {
    const data = input();
    data.goals[0].currentMinor = 0;
    expect(calculateEmergencyRunway(data).runwayBasisPoints).toBe(0);
  });

  it("rounds the runway ratio to the nearest basis point using integer math", () => {
    const data = input();
    data.goals[0].currentMinor = 100_001;
    data.scheduledObligations = [obligation("rent", "Rent", 30_000, "ESSENTIAL")];
    data.accounts = data.accounts.filter((item) => item.id !== "card");
    expect(calculateEmergencyRunway(data).runwayBasisPoints).toBe(33_334);
  });
});

describe("runway frequency normalization", () => {
  it.each([
    ["WEEKLY", 1_000, 4_333],
    ["BIWEEKLY", 1_000, 2_167],
    ["TWICE_MONTHLY", 1_000, 2_000],
    ["MONTHLY", 1_000, 1_000],
    ["QUARTERLY", 1_000, 333],
    ["SEMIANNUAL", 1_000, 167],
    ["ANNUAL", 1_000, 83],
  ])("normalizes %s with half-up minor-unit rounding", (frequency, amount, expected) => {
    expect(normalizeMonthly(amount, frequency)).toBe(expected);
  });
});
