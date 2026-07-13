import { describe, expect, it } from "vitest";
import {
  balanceConfidence,
  calculateLedgerBalance,
  ledgerTransactionEffect,
  netWorthContribution,
} from "./ledger";

describe("account ledger", () => {
  const date = new Date("2026-07-01T00:00:00Z");
  it("derives asset balances from a trusted opening anchor", () => {
    const result = calculateLedgerBalance(
      "CHECKING",
      10000,
      date,
      [
        {
          amountMinor: -2500,
          transactionDate: new Date("2026-07-02"),
          affectsLedger: true,
          possibleDuplicate: false,
          clearingStatus: "CLEARED",
        },
      ],
      [],
    );
    expect(result.ledgerBalanceMinor).toBe(7500);
  });
  it("uses positive amounts owed for liabilities", () => {
    expect(ledgerTransactionEffect("CREDIT", -2500)).toBe(2500);
    expect(ledgerTransactionEffect("CREDIT", 1000)).toBe(-1000);
    expect(netWorthContribution("CREDIT", 5000)).toBe(-5000);
  });
  it("honors the explicit ledger decision even when a row remains duplicate-flagged", () => {
    const result = calculateLedgerBalance(
      "CHECKING",
      10000,
      date,
      [
        {
          amountMinor: -1000,
          transactionDate: new Date("2026-07-02"),
          affectsLedger: true,
          possibleDuplicate: true,
          clearingStatus: "CLEARED",
        },
        {
          amountMinor: -1000,
          transactionDate: new Date("2026-07-02"),
          affectsLedger: true,
          possibleDuplicate: false,
          clearingStatus: "PENDING",
        },
        {
          amountMinor: -1000,
          transactionDate: new Date("2026-07-02"),
          affectsLedger: false,
          possibleDuplicate: false,
          clearingStatus: "CLEARED",
        },
      ],
      [],
    );
    expect(result.ledgerBalanceMinor).toBe(9000);
  });
  it("keeps reporting exclusion independent from ledger inclusion", () => {
    const transfer = { affectsLedger: true, affectsIncomeSpendingReports: false };
    expect(transfer).toEqual({ affectsLedger: true, affectsIncomeSpendingReports: false });
  });
  it("applies refunds and card payments to asset and liability ledgers", () => {
    expect(ledgerTransactionEffect("CHECKING", 2500)).toBe(2500);
    expect(ledgerTransactionEffect("CREDIT", 2500)).toBe(-2500);
  });
  it("calculates explicit adjustments and confidence", () => {
    const result = calculateLedgerBalance(
      "CHECKING",
      10000,
      date,
      [],
      [{ amountMinor: 250, effectiveDate: new Date("2026-07-02") }],
    );
    expect(result.ledgerBalanceMinor).toBe(10250);
    expect(
      balanceConfidence(
        {
          hasOpening: true,
          differenceMinor: 0,
          lastReportedAt: new Date("2026-07-10"),
          duplicates: 0,
          unreviewed: 0,
        },
        new Date("2026-07-12"),
      ),
    ).toBe("HIGH");
    expect(
      balanceConfidence({
        hasOpening: false,
        differenceMinor: null,
        lastReportedAt: null,
        duplicates: 0,
        unreviewed: 0,
      }),
    ).toBe("LIMITED");
  });
});
