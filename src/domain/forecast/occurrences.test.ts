import { describe, expect, it } from "vitest";
import { generateForecastOccurrences, nextForecastDate } from "./occurrences";

const rule = {
  id: "payroll",
  name: "Payroll",
  direction: "INCOME",
  cadence: "BIWEEKLY",
  nextExpectedDate: new Date("2026-01-02T00:00:00.000Z"),
  typicalAmountMinor: 200_000,
  endDate: null,
};

describe("forecast occurrence generation", () => {
  it("generates 26 or 27 biweekly checks according to calendar alignment", () => {
    const rows = generateForecastOccurrences(
      rule,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2027-01-01T00:00:00.000Z"),
    );
    expect([26, 27]).toContain(rows.length);
    expect(new Set(rows.map((row) => row.expectedDate.toISOString().slice(0, 10))).size).toBe(
      rows.length,
    );
  });

  it("clamps monthly and semimonthly rules at month end across leap years", () => {
    expect(
      nextForecastDate(new Date("2028-01-31T00:00:00.000Z"), { cadence: "MONTHLY" })
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2028-02-29");
    expect(
      nextForecastDate(new Date("2026-02-15T00:00:00.000Z"), {
        cadence: "SEMIMONTHLY",
        semimonthlyDay1: 1,
        semimonthlyDay2: 31,
      })
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-02-28");
  });

  it("applies sparse changed, skipped, and matched lifecycle records", () => {
    const rows = generateForecastOccurrences(
      rule,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-02-15T00:00:00.000Z"),
      [
        {
          id: "changed",
          expectedDate: new Date("2026-01-02T00:00:00.000Z"),
          expectedAmountMinor: 200_000,
          status: "CHANGED",
          overrideDate: new Date("2026-01-01T00:00:00.000Z"),
          overrideAmountMinor: 210_000,
        },
        {
          id: "skipped",
          expectedDate: new Date("2026-01-16T00:00:00.000Z"),
          expectedAmountMinor: 200_000,
          status: "SKIPPED",
        },
        {
          id: "matched",
          expectedDate: new Date("2026-01-30T00:00:00.000Z"),
          expectedAmountMinor: 200_000,
          status: "MATCHED",
          matchedTransactionId: "tx",
        },
      ],
    );
    expect(rows[0]).toMatchObject({ status: "CHANGED", effectiveAmountMinor: 210_000 });
    expect(rows[1].status).toBe("SKIPPED");
    expect(rows[2].matchedTransactionId).toBe("tx");
  });
});
