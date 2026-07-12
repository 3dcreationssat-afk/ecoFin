import { describe, expect, it } from "vitest";
import {
  calculatePayoff,
  compareStrategy,
  monthlyInterestMinor,
  orderDebts,
  weightedAprBasisPoints,
  type DebtInput,
} from "./payoff";

const asOf = new Date("2026-07-12T00:00:00.000Z");

function debt(overrides: Partial<DebtInput> = {}): DebtInput {
  return {
    id: "card-a",
    name: "Card A",
    type: "CREDIT",
    balanceMinor: 100_000,
    aprBasisPoints: 1_200,
    minimumPaymentMinor: 5_000,
    dueDay: 15,
    reconciliationStatus: "RECONCILED",
    balanceConfidence: "HIGH",
    lastReconciledAt: asOf,
    ...overrides,
  };
}

describe("debt payoff engine", () => {
  it("rounds monthly interest to integer cents", () => {
    expect(monthlyInterestMinor(100_000, 1_200)).toBe(1_000);
    expect(monthlyInterestMinor(10_001, 999)).toBe(83);
    expect(monthlyInterestMinor(10_000, 0)).toBe(0);
  });

  it("calculates balance-weighted APR basis points", () => {
    expect(
      weightedAprBasisPoints([
        debt({ balanceMinor: 100_000, aprBasisPoints: 1_000 }),
        debt({ id: "b", balanceMinor: 300_000, aprBasisPoints: 2_000 }),
      ]),
    ).toBe(1_750);
  });

  it("handles zero APR and a smaller final payment without creating cents", () => {
    const result = calculatePayoff({
      debts: [debt({ balanceMinor: 10_001, aprBasisPoints: 0, minimumPaymentMinor: 5_000 })],
      strategy: "MINIMUM_ONLY",
      asOf,
    });
    expect(result.monthsToPayoff).toBe(3);
    expect(result.totalInterestMinor).toBe(0);
    expect(result.schedule[2]?.totalPaymentMinor).toBe(1);
    expect(result.totalPaidMinor).toBe(10_001);
  });

  it("caps a minimum greater than the balance to the first-month amount due", () => {
    const result = calculatePayoff({
      debts: [debt({ balanceMinor: 1_000, aprBasisPoints: 0, minimumPaymentMinor: 5_000 })],
      strategy: "AVALANCHE",
      asOf,
    });
    expect(result.monthsToPayoff).toBe(1);
    expect(result.schedule[0]?.totalPaymentMinor).toBe(1_000);
  });

  it.each([
    ["missing APR", { aprBasisPoints: null }, "MISSING_APR"],
    ["missing minimum", { minimumPaymentMinor: null }, "MISSING_MINIMUM"],
    ["zero minimum", { minimumPaymentMinor: 0 }, "ZERO_MINIMUM"],
    ["missing due day", { dueDay: null }, "MISSING_DUE_DATE"],
  ])("rejects %s", (_label, overrides, code) => {
    const result = calculatePayoff({ debts: [debt(overrides)], strategy: "AVALANCHE", asOf });
    expect(result.available).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain(code);
  });

  it("rejects a minimum that cannot cover monthly interest", () => {
    const result = calculatePayoff({
      debts: [debt({ balanceMinor: 100_000, aprBasisPoints: 2_400, minimumPaymentMinor: 2_000 })],
      strategy: "AVALANCHE",
      asOf,
    });
    expect(result.available).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain("NEGATIVE_AMORTIZATION");
  });

  it("orders avalanche, snowball, custom, and stable tie breakers", () => {
    const debts = [
      debt({ id: "b", balanceMinor: 50_000, aprBasisPoints: 2_000 }),
      debt({ id: "a", balanceMinor: 50_000, aprBasisPoints: 2_000 }),
      debt({ id: "c", balanceMinor: 10_000, aprBasisPoints: 500 }),
    ];
    expect(orderDebts(debts, "AVALANCHE").map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(orderDebts(debts, "SNOWBALL").map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(orderDebts(debts, "CUSTOM", ["b", "c", "a"]).map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("requires a complete, duplicate-free custom order", () => {
    const result = calculatePayoff({
      debts: [debt({ id: "a" }), debt({ id: "b" })],
      strategy: "CUSTOM",
      customOrder: ["a", "a"],
      asOf,
    });
    expect(result.available).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain("CUSTOM_ORDER_INCOMPLETE");
  });

  it("rolls paid debt payments into the next strategy debt", () => {
    const result = calculatePayoff({
      debts: [
        debt({ id: "small", balanceMinor: 1_000, aprBasisPoints: 0, minimumPaymentMinor: 1_000 }),
        debt({ id: "large", balanceMinor: 20_000, aprBasisPoints: 0, minimumPaymentMinor: 1_000 }),
      ],
      strategy: "SNOWBALL",
      asOf,
    });
    expect(
      result.schedule[1]?.debts.find((item) => item.debtId === "large")?.extraPaymentMinor,
    ).toBe(1_000);
  });

  it("zero extra is valid and extra payment saves time and interest", () => {
    const debts = [
      debt({ balanceMinor: 250_000, minimumPaymentMinor: 8_000, aprBasisPoints: 1_800 }),
    ];
    const zero = calculatePayoff({ debts, strategy: "AVALANCHE", extraPaymentMinor: 0, asOf });
    const extra = calculatePayoff({
      debts,
      strategy: "AVALANCHE",
      extraPaymentMinor: 10_000,
      asOf,
    });
    const comparison = compareStrategy(
      extra,
      calculatePayoff({ debts, strategy: "MINIMUM_ONLY", asOf }),
    );
    expect(extra.monthsToPayoff).toBeLessThan(zero.monthsToPayoff ?? Infinity);
    expect(comparison.interestSavedMinor).toBeGreaterThan(0);
    expect(comparison.timeSavedMonths).toBeGreaterThan(0);
  });

  it("supports a very large extra payment and first-month payoff", () => {
    const result = calculatePayoff({
      debts: [debt({ balanceMinor: 10_000, aprBasisPoints: 1_200 })],
      strategy: "AVALANCHE",
      extraPaymentMinor: 1_000_000,
      asOf,
    });
    expect(result.monthsToPayoff).toBe(1);
    expect(result.firstDebtPaidOff?.debtId).toBe("card-a");
    expect(result.schedule[0]?.endingDebtMinor).toBe(0);
  });

  it("returns an explicit horizon issue when payoff exceeds the limit", () => {
    const result = calculatePayoff({
      debts: [debt({ balanceMinor: 10_000_000, aprBasisPoints: 100, minimumPaymentMinor: 20_000 })],
      strategy: "MINIMUM_ONLY",
      asOf,
      maxMonths: 2,
    });
    expect(result.available).toBe(false);
    expect(result.schedule).toHaveLength(2);
    expect(result.issues.map((item) => item.code)).toContain("PAYOFF_HORIZON_EXCEEDED");
  });

  it("crosses leap-year and year boundaries using stable month periods", () => {
    const result = calculatePayoff({
      debts: [debt({ balanceMinor: 2_000, aprBasisPoints: 0, minimumPaymentMinor: 1_000 })],
      strategy: "MINIMUM_ONLY",
      asOf: new Date("2027-12-31T00:00:00.000Z"),
    });
    expect(result.schedule.map((item) => item.period)).toEqual(["2028-01", "2028-02"]);
  });

  it("reconciles every period and total without lost or created cents", () => {
    const result = calculatePayoff({
      debts: [debt(), debt({ id: "loan", type: "LOAN", balanceMinor: 333_333 })],
      strategy: "AVALANCHE",
      extraPaymentMinor: 7_777,
      asOf,
    });
    expect(result.available).toBe(true);
    for (const period of result.schedule) {
      expect(period.startingDebtMinor + period.interestMinor - period.totalPaymentMinor).toBe(
        period.endingDebtMinor,
      );
      expect(period.totalPaymentMinor - period.interestMinor).toBe(period.principalMinor);
    }
    expect(result.totalPaidMinor).toBe(
      (result.totalInterestMinor ?? 0) + result.totalStartingDebtMinor,
    );
  });
});
