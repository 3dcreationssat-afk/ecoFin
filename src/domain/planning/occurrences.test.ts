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
      retainedDiscretionaryMinor: 25000,
      recommendedMinor: 50000,
      conservativeMinor: 40000,
      safeToSpendMinor: 50000,
      policyCapMinor: 50000,
    });
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
