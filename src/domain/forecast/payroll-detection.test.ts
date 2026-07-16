import { describe, expect, it } from "vitest";
import {
  detectPayrollCandidates,
  isPayrollEligible,
  type PayrollTransaction,
} from "./payroll-detection";

function deposit(
  id: string,
  date: string,
  amountMinor = 242_500,
  description = "EURONET PAYROLL",
): PayrollTransaction {
  return {
    id,
    householdId: "h1",
    accountId: "checking",
    normalizedMerchant: description,
    originalDescription: description,
    amountMinor,
    transactionDate: new Date(`${date}T00:00:00.000Z`),
    postedDate: new Date(`${date}T00:00:00.000Z`),
    type: "INCOME",
    affectsLedger: true,
    clearingStatus: "CLEARED",
  };
}

describe("payroll pattern detection", () => {
  it("detects stable biweekly payroll with variable deductions and an early deposit", () => {
    const candidate = detectPayrollCandidates(
      [
        deposit("1", "2026-05-22", 241_900),
        deposit("2", "2026-06-05", 242_500),
        deposit("3", "2026-06-19", 244_100),
        deposit("4", "2026-07-02", 243_000),
      ],
      new Date("2026-07-10T00:00:00.000Z"),
    )[0];
    expect(candidate).toMatchObject({
      cadence: "BIWEEKLY",
      confidence: "HIGH",
      accountId: "checking",
    });
    expect(candidate.nextExpectedDate.toISOString().slice(0, 10)).toBe("2026-07-16");
    expect(candidate.amountToleranceBps).toBeGreaterThanOrEqual(1000);
  });

  it.each([
    ["WEEKLY", ["2026-06-12", "2026-06-19", "2026-06-26", "2026-07-03"]],
    ["MONTHLY", ["2026-04-30", "2026-05-29", "2026-06-30", "2026-07-30"]],
  ])("detects %s cadence", (cadence, dates) => {
    const result = detectPayrollCandidates(
      dates.map((date, index) => deposit(String(index), date)),
      new Date(cadence === "WEEKLY" ? "2026-07-06T00:00:00.000Z" : "2026-08-01T00:00:00.000Z"),
    );
    expect(result[0]?.cadence).toBe(cadence);
  });

  it("detects semimonthly payroll using two date clusters", () => {
    const dates = [
      "2026-05-01",
      "2026-05-15",
      "2026-06-01",
      "2026-06-15",
      "2026-07-01",
      "2026-07-15",
    ];
    const candidate = detectPayrollCandidates(
      dates.map((date, index) => deposit(String(index), date)),
      new Date("2026-07-16T00:00:00.000Z"),
    )[0];
    expect(candidate).toMatchObject({
      cadence: "SEMIMONTHLY",
      semimonthlyDay1: 1,
      semimonthlyDay2: 15,
      confidence: "HIGH",
    });
  });

  it("rejects irregular, bonus, reimbursement, transfer, duplicate, and excessive-variance deposits", () => {
    const irregular = ["2026-01-01", "2026-01-12", "2026-02-27", "2026-05-04"].map((date, index) =>
      deposit(String(index), date),
    );
    expect(detectPayrollCandidates(irregular, new Date("2026-05-05T00:00:00.000Z"))).toEqual([]);
    expect(
      isPayrollEligible(deposit("bonus", "2026-07-01", 500_000, "EURONET PERFORMANCE BONUS")),
    ).toBe(false);
    expect(
      isPayrollEligible(deposit("reimburse", "2026-07-01", 12_000, "EURONET REIMBURSEMENT")),
    ).toBe(false);
    expect(isPayrollEligible({ ...deposit("transfer", "2026-07-01"), type: "TRANSFER_IN" })).toBe(
      false,
    );
    expect(
      isPayrollEligible({ ...deposit("duplicate", "2026-07-01"), possibleDuplicate: true }),
    ).toBe(false);
    const variable = [100_000, 250_000, 90_000, 300_000].map((amount, index) =>
      deposit(
        String(index),
        `2026-0${5 + Math.floor(index / 2)}-${index % 2 ? "15" : "01"}`,
        amount,
      ),
    );
    expect(detectPayrollCandidates(variable, new Date("2026-07-20T00:00:00.000Z"))).toEqual([]);
  });

  it("keeps separate household earners and destination accounts", () => {
    const first = ["2026-05-22", "2026-06-05", "2026-06-19", "2026-07-03"].map((date, index) =>
      deposit(`a${index}`, date),
    );
    const second = first.map((item, index) => ({
      ...item,
      id: `b${index}`,
      accountId: "savings",
      normalizedMerchant: "OTHER EMPLOYER PAYROLL",
      originalDescription: "OTHER EMPLOYER PAYROLL",
      amountMinor: 180_000,
    }));
    expect(
      detectPayrollCandidates([...first, ...second], new Date("2026-07-10T00:00:00.000Z")),
    ).toHaveLength(2);
  });
});
