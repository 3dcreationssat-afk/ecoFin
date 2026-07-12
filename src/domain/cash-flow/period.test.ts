import { describe, expect, it } from "vitest";
import { financialPeriod } from "./period";

describe("financial periods", () => {
  it("supports configured month starts and year transitions", () => {
    const period = financialPeriod(new Date("2026-01-03T12:00:00Z"), 15);
    expect(period.start.toISOString()).toBe("2025-12-15T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
  it("clamps month starts across leap-year month ends", () => {
    const leap = financialPeriod(new Date("2028-02-29T12:00:00Z"), 31);
    expect(leap.start.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(leap.end.toISOString()).toBe("2028-03-31T00:00:00.000Z");
  });
});
