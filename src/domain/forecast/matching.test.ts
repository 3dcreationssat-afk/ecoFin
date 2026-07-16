import { describe, expect, it } from "vitest";
import {
  matchForecastTransactions,
  type MatchableRule,
  type MatchableTransaction,
} from "./matching";

const rule: MatchableRule = {
  id: "r1",
  name: "Euronet payroll",
  direction: "INCOME",
  cadence: "BIWEEKLY",
  nextExpectedDate: new Date("2026-07-17T00:00:00.000Z"),
  typicalAmountMinor: 242_500,
  accountId: "checking",
  merchantKey: "euronet",
  dateToleranceDays: 3,
  amountToleranceBps: 1500,
  state: "CONFIRMED",
  occurrences: [],
};
const transaction: MatchableTransaction = {
  id: "tx1",
  accountId: "checking",
  transactionDate: new Date("2026-07-16T00:00:00.000Z"),
  amountMinor: 244_000,
  normalizedMerchant: "Euronet Payroll",
  originalDescription: "EURONET PAYROLL",
  type: "INCOME",
  excluded: false,
  affectsLedger: true,
  possibleDuplicate: false,
  clearingStatus: "CLEARED",
};

describe("forecast matching", () => {
  it("matches account, direction, date, amount, and merchant deterministically", () => {
    expect(
      matchForecastTransactions([rule], [transaction], new Date("2026-07-16T00:00:00.000Z"))[0],
    ).toMatchObject({ ruleId: "r1", transactionId: "tx1", dateDifferenceDays: -1 });
  });
  it("refuses ambiguous matches and ineligible ledger rows", () => {
    expect(
      matchForecastTransactions(
        [rule, { ...rule, id: "r2" }],
        [transaction],
        new Date("2026-07-16T00:00:00.000Z"),
      ),
    ).toEqual([]);
    for (const changed of [
      { possibleDuplicate: true },
      { excluded: true },
      { affectsLedger: false },
      { clearingStatus: "VOID" },
    ])
      expect(
        matchForecastTransactions(
          [rule],
          [{ ...transaction, ...changed }],
          new Date("2026-07-16T00:00:00.000Z"),
        ),
      ).toEqual([]);
  });
  it("refuses wrong account, direction, amount, date, or merchant", () => {
    const changes = [
      { accountId: "other" },
      { amountMinor: -242_500 },
      { amountMinor: 400_000 },
      { transactionDate: new Date("2026-07-01T00:00:00.000Z") },
      { normalizedMerchant: "Unrelated source", originalDescription: "Unrelated source" },
    ];
    changes.forEach((changed) =>
      expect(
        matchForecastTransactions(
          [rule],
          [{ ...transaction, ...changed }],
          new Date("2026-07-16T00:00:00.000Z"),
        ),
      ).toEqual([]),
    );
  });
});
