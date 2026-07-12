import { describe, expect, it } from "vitest";
import {
  effectiveOccurrenceStatus,
  nextOccurrence,
  occurrenceDates,
  savingsRecommendation,
} from "./occurrences";
describe("planning occurrences", () => {
  it("generates weekly and biweekly dates across years", () => {
    expect(nextOccurrence(new Date("2026-12-29"), "WEEKLY")?.toISOString()).toBe(
      "2027-01-05T00:00:00.000Z",
    );
    expect(nextOccurrence(new Date("2026-12-29"), "BIWEEKLY")?.toISOString()).toBe(
      "2027-01-12T00:00:00.000Z",
    );
  });
  it("generates explicit twice-monthly days", () => {
    expect(
      occurrenceDates(new Date("2026-07-05"), "TWICE_MONTHLY", new Date("2026-08-20"), 5, 20).map(
        (d) => d.getUTCDate(),
      ),
    ).toEqual([5, 20, 5]);
  });
  it("supports monthly leap-year and skipped/overdue status", () => {
    expect(nextOccurrence(new Date("2028-01-29"), "MONTHLY")?.getUTCMonth()).toBe(1);
    expect(
      effectiveOccurrenceStatus("UPCOMING", new Date("2026-07-01"), new Date("2026-07-02")),
    ).toBe("OVERDUE");
    expect(
      effectiveOccurrenceStatus("SKIPPED", new Date("2026-07-01"), new Date("2026-07-02")),
    ).toBe("SKIPPED");
  });
  it("retains discretionary cash and separates maximum from recommendations", () => {
    expect(
      savingsRecommendation({
        maximumSurplusMinor: 100000,
        mode: "BALANCED",
        targetBps: 5000,
        discretionaryReserveMinor: 20000,
        extraSafetyReserveMinor: 5000,
        minimumCashRetainedMinor: 0,
        startingCashMinor: 100000,
        confidence: "MODERATE",
        conservativeAdjustmentBps: 2000,
      }),
    ).toEqual({
      cashAfterObligationsAndProtectionsMinor: 100000,
      retainedSafetyReserveMinor: 25000,
      allocatableSurplusMinor: 75000,
      recommendedMinor: 37500,
      conservativeMinor: 30000,
      safeToSpendMinor: 37500,
      unallocatedSurplusMinor: 0,
      policyCapMinor: 37500,
      effectiveTargetBps: 5000,
      conservativeReductionMinor: 7500,
    });
  });
  const policy = (overrides: Partial<Parameters<typeof savingsRecommendation>[0]> = {}) =>
    savingsRecommendation({
      maximumSurplusMinor: 101,
      mode: "BALANCED",
      targetBps: 5000,
      discretionaryReserveMinor: 1,
      extraSafetyReserveMinor: 0,
      minimumCashRetainedMinor: 0,
      startingCashMinor: 1000,
      confidence: "HIGH",
      conservativeAdjustmentBps: 2000,
      ...overrides,
    });
  it.each([
    ["CONSERVATIVE", 3500],
    ["BALANCED", 5000],
    ["AGGRESSIVE", 7500],
    ["CUSTOM", 4200],
  ])("applies %s policy to allocatable surplus", (mode, expectedBps) => {
    const result = policy({ mode, targetBps: mode === "CUSTOM" ? 4200 : 5000 });
    expect(result.effectiveTargetBps).toBe(expectedBps);
    expect(result.allocatableSurplusMinor).toBe(
      result.recommendedMinor + result.safeToSpendMinor + result.unallocatedSurplusMinor,
    );
    expect(result.cashAfterObligationsAndProtectionsMinor).toBe(
      result.retainedSafetyReserveMinor + result.allocatableSurplusMinor,
    );
  });
  it("handles zero, negative, reserve-over-surplus, and 0/100 percent boundaries", () => {
    expect(policy({ maximumSurplusMinor: 0 }).allocatableSurplusMinor).toBe(0);
    expect(policy({ maximumSurplusMinor: -100 }).recommendedMinor).toBe(0);
    expect(
      policy({ maximumSurplusMinor: 50, discretionaryReserveMinor: 100 })
        .retainedSafetyReserveMinor,
    ).toBe(50);
    expect(policy({ targetBps: 0 }).recommendedMinor).toBe(0);
    expect(policy({ targetBps: 10000 }).safeToSpendMinor).toBe(0);
  });
  it("applies transparent High, Moderate, and Limited conservative reductions", () => {
    const high = policy({
      maximumSurplusMinor: 10000,
      discretionaryReserveMinor: 0,
      confidence: "HIGH",
    });
    const moderate = policy({
      maximumSurplusMinor: 10000,
      discretionaryReserveMinor: 0,
      confidence: "MODERATE",
    });
    const limited = policy({
      maximumSurplusMinor: 10000,
      discretionaryReserveMinor: 0,
      confidence: "LIMITED",
    });
    expect(high.conservativeMinor).toBe(high.recommendedMinor);
    expect(moderate.conservativeReductionMinor).toBe(1000);
    expect(limited.conservativeReductionMinor).toBe(2000);
  });
  it("preserves every integer cent and honors minimum retained cash shortfall", () => {
    const result = policy({
      maximumSurplusMinor: 101,
      minimumCashRetainedMinor: 1100,
      startingCashMinor: 1000,
      discretionaryReserveMinor: 0,
      targetBps: 3333,
    });
    expect(result.retainedSafetyReserveMinor).toBe(100);
    expect(result.recommendedMinor + result.safeToSpendMinor + result.unallocatedSurplusMinor).toBe(
      1,
    );
  });
  it("shows zero recommendations and a shortfall boundary for negative surplus", () => {
    expect(
      savingsRecommendation({
        maximumSurplusMinor: -1,
        mode: "BALANCED",
        targetBps: 5000,
        discretionaryReserveMinor: 0,
        extraSafetyReserveMinor: 0,
        minimumCashRetainedMinor: 0,
        startingCashMinor: 0,
        confidence: "LIMITED",
        conservativeAdjustmentBps: 2000,
      }).recommendedMinor,
    ).toBe(0);
  });
});
