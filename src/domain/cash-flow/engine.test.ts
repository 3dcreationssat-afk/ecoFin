import { describe, expect, it } from "vitest";
import { calculateCashFlow, type CashFlowInput } from "./engine";

const base = (): CashFlowInput => ({
  asOf: new Date("2026-07-12T00:00:00Z"),
  financialMonthStart: 1,
  checkingBufferMinor: 10000,
  emergencyFundTargetMinor: 0,
  workspaceMode: "USER_DATA",
  accounts: [
    {
      id: "checking",
      name: "Checking",
      type: "CHECKING",
      openingBalanceMinor: 1,
      ledgerBalanceMinor: 100000,
      ledgerStatus: "CURRENT",
      reconciliationStatus: "RECONCILED",
      reconciliationDifferenceMinor: 0,
      reportedAvailableMinor: 90000,
      reportedBalanceAsOf: new Date("2026-07-11"),
      minimumPaymentMinor: null,
      dueDay: null,
    },
  ],
  transactions: [],
  recurring: [],
  goals: [],
  importBatches: [],
});

describe("cash-flow engine", () => {
  it("uses the lower fresh available balance but excludes liabilities and credit limits", () => {
    const input = base();
    input.accounts.push({
      ...input.accounts[0],
      id: "card",
      name: "Card",
      type: "CREDIT",
      ledgerBalanceMinor: 50000,
      reportedAvailableMinor: 999999,
      minimumPaymentMinor: 5000,
      dueDay: 20,
    });
    const result = calculateCashFlow(input);
    expect(result.startingUsableLiquidCashMinor).toBe(90000);
    expect(result.debtMinimumPaymentsMinor).toBe(5000);
  });
  it("forecasts confirmed income and obligations but reserves unconfirmed expenses conservatively", () => {
    const input = base();
    input.recurring = [
      {
        id: "income",
        displayName: "Pay",
        typicalAmountMinor: 200000,
        nextExpectedDate: new Date("2026-07-15"),
        status: "CONFIRMED",
        userConfirmed: true,
        recurringType: "INCOME",
        confidence: "HIGH",
      },
      {
        id: "bill",
        displayName: "Rent",
        typicalAmountMinor: -50000,
        nextExpectedDate: new Date("2026-07-16"),
        status: "CONFIRMED",
        userConfirmed: true,
        recurringType: "EXPENSE",
        confidence: "HIGH",
      },
      {
        id: "maybe",
        displayName: "Utility",
        typicalAmountMinor: -8000,
        nextExpectedDate: new Date("2026-07-18"),
        status: "CANDIDATE",
        userConfirmed: false,
        recurringType: "EXPENSE",
        confidence: "MEDIUM",
      },
    ];
    const result = calculateCashFlow(input);
    expect(result.remainingExpectedIncomeMinor).toBe(200000);
    expect(result.remainingEssentialObligationsMinor).toBe(50000);
    expect(result.conservativeSafeToSaveMinor).toBe(result.recommendedSafeToSaveMinor - 8000);
  });
  it("deducts only remaining planned savings and protects explicitly mapped emergency funds", () => {
    const input = base();
    input.emergencyFundTargetMinor = 50000;
    input.goals = [
      {
        id: "goal",
        name: "Emergency Fund",
        plannedMonthlyMinor: 10000,
        currentMinor: 30000,
        targetMinor: 50000,
        linkedAccountId: "checking",
        archivedAt: null,
        contributions: [{ amountMinor: 4000, contributionDate: new Date("2026-07-05") }],
      },
    ];
    const result = calculateCashFlow(input);
    expect(result.committedPlannedSavingsMinor).toBe(6000);
    expect(result.emergencyFundProtectionMinor).toBe(30000);
    expect(result.emergencyFundShortfallMinor).toBe(20000);
  });
  it("creates explicit reserves and never presents a negative surplus as safe", () => {
    const input = base();
    input.checkingBufferMinor = 200000;
    input.transactions = [
      {
        id: "dup",
        accountId: "checking",
        transactionDate: new Date("2026-07-10"),
        amountMinor: -2500,
        type: "EXPENSE",
        affectsLedger: true,
        affectsIncomeSpendingReports: true,
        possibleDuplicate: true,
        clearingStatus: "CLEARED",
        excluded: false,
        categoryId: null,
      },
    ];
    const result = calculateCashFlow(input);
    expect(result.dataQualityReserveMinor).toBe(2500);
    expect(result.recommendedSafeToSaveMinor).toBe(0);
    expect(result.safeToSpendMinor).toBe(0);
    expect(result.shortfallMinor).toBeGreaterThan(0);
  });
  it("keeps report exclusions, transfers, card payments, and refunds out of forecast obligations", () => {
    const input = base();
    input.transactions = ["TRANSFER_OUT", "TRANSFER_IN", "REFUND"].map((type, index) => ({
      id: String(index),
      accountId: "checking",
      transactionDate: new Date("2026-07-05"),
      amountMinor: type === "TRANSFER_OUT" ? -1000 : 1000,
      type,
      affectsLedger: true,
      affectsIncomeSpendingReports: false,
      possibleDuplicate: false,
      clearingStatus: "CLEARED",
      excluded: true,
      categoryId: null,
    }));
    const result = calculateCashFlow(input);
    expect(result.remainingEssentialObligationsMinor).toBe(0);
    expect(result.events.filter((event) => event.kind === "RECORDED")).toHaveLength(4);
  });
  it("lowers confidence for unanchored, unreconciled, stale, and mixed inputs", () => {
    const input = base();
    input.workspaceMode = "MIXED";
    input.accounts[0].reconciliationStatus = "UNRECONCILED";
    input.accounts[0].reconciliationDifferenceMinor = 500;
    input.accounts[0].reportedBalanceAsOf = new Date("2026-01-01");
    expect(calculateCashFlow(input).confidence).toBe("LIMITED");
  });
});
