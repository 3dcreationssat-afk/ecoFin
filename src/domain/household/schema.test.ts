import { describe, expect, it } from "vitest";
import { householdSettingsSchema } from "./schema";

describe("householdSettingsSchema", () => {
  it("accepts valid local household settings", () => {
    expect(
      householdSettingsSchema.parse({
        name: "Our Household",
        currency: "USD",
        financialMonthStart: 1,
        incomeSchedule: "BI_WEEKLY",
        checkingBufferMinor: 150000,
        emergencyFundTargetMinor: 1500000,
        debtStrategy: "AVALANCHE",
      }),
    ).toMatchObject({ currency: "USD" });
  });

  it("rejects invalid financial month starts", () => {
    expect(() =>
      householdSettingsSchema.parse({
        name: "Our Household",
        currency: "USD",
        financialMonthStart: 31,
        incomeSchedule: "BI_WEEKLY",
        checkingBufferMinor: 0,
        emergencyFundTargetMinor: 0,
        debtStrategy: "AVALANCHE",
      }),
    ).toThrow();
  });
});
