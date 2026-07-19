import { describe, expect, it } from "vitest";
import {
  detectRecurringCandidates,
  detectPriceChange,
  isRecurringEligible,
  normalizeRecurringAmount,
  normalizeRecurringMerchant,
  nextFutureOccurrence,
} from "./detection";

function tx(input: {
  id: string;
  date: string;
  amount: number;
  merchant?: string;
  type?: string;
  categoryId?: string | null;
  excluded?: boolean;
  sourceType?: string;
  accountId?: string;
}) {
  return {
    id: input.id,
    householdId: "household",
    normalizedMerchant: input.merchant ?? "Netflix.com Monthly 1234",
    originalDescription: input.merchant ?? "Netflix.com Monthly 1234",
    amountMinor: input.amount,
    transactionDate: new Date(input.date),
    type: input.type ?? "DEBIT",
    categoryId: input.categoryId ?? "category",
    excluded: input.excluded ?? false,
    sourceType: input.sourceType,
    account: { id: input.accountId ?? "checking", type: "CHECKING" },
    outgoingTransferMatches: [],
    incomingTransferMatches: [],
  };
}

describe("recurring detection", () => {
  it("normalizes volatile merchant text deterministically", () => {
    expect(normalizeRecurringMerchant("WWW.NETFLIX.COM 07/08/2026 STORE #9931")).toBe("netflix");
  });

  it("detects monthly, variable, and annual recurring candidates with equivalents", () => {
    const candidates = detectRecurringCandidates(
      [
        tx({ id: "n1", date: "2027-05-08", amount: -1599 }),
        tx({ id: "n2", date: "2027-06-08", amount: -1599 }),
        tx({ id: "n3", date: "2027-07-08", amount: -1799 }),
        tx({ id: "u1", date: "2027-05-01", amount: -5840, merchant: "City Water Utility" }),
        tx({ id: "u2", date: "2027-06-01", amount: -6218, merchant: "City Water Utility" }),
        tx({ id: "u3", date: "2027-07-01", amount: -6405, merchant: "City Water Utility" }),
        tx({ id: "a1", date: "2025-07-01", amount: -12000, merchant: "Annual Cloud Backup" }),
        tx({ id: "a2", date: "2026-07-01", amount: -12000, merchant: "Annual Cloud Backup" }),
        tx({ id: "a3", date: "2027-07-01", amount: -12000, merchant: "Annual Cloud Backup" }),
      ],
      new Date("2027-07-12"),
    );
    expect(candidates.map((candidate) => candidate.displayName)).toEqual(
      expect.arrayContaining(["Netflix", "City Water Utility", "Cloud Backup"]),
    );
    const netflix = candidates.find((candidate) => candidate.displayName === "Netflix")!;
    expect(netflix.frequency).toBe("MONTHLY");
    expect(netflix.priceChangeAmountMinor).toBe(200);
    expect(netflix.monthlyEquivalentMinor).toBe(1599);
    const annual = candidates.find((candidate) => candidate.displayName === "Cloud Backup")!;
    expect(annual.monthlyEquivalentMinor).toBe(1000);
  });

  it("returns the first strictly future occurrence and no precise date for irregular patterns", () => {
    expect(
      nextFutureOccurrence(
        new Date("2026-01-31T00:00:00Z"),
        "MONTHLY",
        30,
        new Date("2026-07-13T00:00:00Z"),
      )
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-07-28");
    expect(
      nextFutureOccurrence(
        new Date("2026-07-01T00:00:00Z"),
        "IRREGULAR_RECURRING",
        30,
        new Date("2026-07-13T00:00:00Z"),
      ),
    ).toBeNull();
  });

  it("excludes income, refunds, transfers, card payments, and excluded rows", () => {
    expect(isRecurringEligible(tx({ id: "i", date: "2026-07-01", amount: 1200 }))).toBe(false);
    expect(
      isRecurringEligible(tx({ id: "r", date: "2026-07-01", amount: -1200, type: "REFUND" })),
    ).toBe(false);
    expect(
      isRecurringEligible(
        tx({ id: "p", date: "2026-07-01", amount: -1200, merchant: "Autopay Chase Sapphire" }),
      ),
    ).toBe(false);
    expect(
      isRecurringEligible(tx({ id: "x", date: "2026-07-01", amount: -1200, excluded: true })),
    ).toBe(false);
    expect(
      isRecurringEligible(
        tx({ id: "p2p", date: "2026-07-01", amount: -1200, merchant: "PAYPAL INST XFER" }),
      ),
    ).toBe(false);
    expect(
      isRecurringEligible(
        tx({ id: "zelle", date: "2026-07-01", amount: -1200, merchant: "Zelle payment" }),
      ),
    ).toBe(false);
  });

  it("requires recent evidence and ignores future-dated rows", () => {
    expect(
      detectRecurringCandidates(
        [
          tx({ id: "s1", date: "2024-05-01", amount: -999, merchant: "Stale Service" }),
          tx({ id: "s2", date: "2024-06-01", amount: -999, merchant: "Stale Service" }),
          tx({ id: "s3", date: "2024-07-01", amount: -999, merchant: "Stale Service" }),
        ],
        new Date("2026-07-15"),
      ),
    ).toHaveLength(0);
    expect(
      detectRecurringCandidates(
        [
          tx({ id: "f1", date: "2026-05-01", amount: -999, merchant: "Future Service" }),
          tx({ id: "f2", date: "2026-06-01", amount: -999, merchant: "Future Service" }),
          tx({ id: "f3", date: "2026-08-01", amount: -999, merchant: "Future Service" }),
        ],
        new Date("2026-07-15"),
      ),
    ).toHaveLength(0);
  });

  it("does not promote irregular spending without a defensible cadence", () => {
    const candidates = detectRecurringCandidates(
      [
        tx({ id: "r1", date: "2026-01-01", amount: -2400, merchant: "Local Market" }),
        tx({ id: "r2", date: "2026-01-20", amount: -2400, merchant: "Local Market" }),
        tx({ id: "r3", date: "2026-03-05", amount: -2400, merchant: "Local Market" }),
        tx({ id: "r4", date: "2026-05-20", amount: -2400, merchant: "Local Market" }),
        tx({ id: "r5", date: "2026-07-10", amount: -2400, merchant: "Local Market" }),
      ],
      new Date("2026-07-15"),
    );
    expect(candidates).toHaveLength(0);
  });

  it("reconciles cross-source evidence and labels repeatable irregular activity without a date", () => {
    const candidates = detectRecurringCandidates(
      [
        tx({
          id: "c1",
          date: "2026-04-01",
          amount: -2400,
          merchant: "Seasonal Service",
          sourceType: "CSV_IMPORT",
        }),
        tx({
          id: "p1",
          date: "2026-04-01",
          amount: -2400,
          merchant: "Seasonal Service",
          sourceType: "BANK_CONNECTION",
        }),
        tx({
          id: "c2",
          date: "2026-04-21",
          amount: -2400,
          merchant: "Seasonal Service",
          sourceType: "CSV_IMPORT",
        }),
        tx({
          id: "p2",
          date: "2026-05-18",
          amount: -2400,
          merchant: "Seasonal Service",
          sourceType: "BANK_CONNECTION",
        }),
        tx({
          id: "p3",
          date: "2026-06-10",
          amount: -2400,
          merchant: "Seasonal Service",
          sourceType: "BANK_CONNECTION",
        }),
      ],
      new Date("2026-06-15"),
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      frequency: "IRREGULAR_RECURRING",
      nextExpectedDate: null,
    });
    expect(candidates[0].transactionIds).toHaveLength(4);
    expect(candidates[0].reasons.join(" ")).toMatch(/CSV and bank-connection/);
  });

  it("counts identical same-day rows once and rejects ambiguous same-day charges", () => {
    const exactDuplicate = detectRecurringCandidates(
      [
        tx({ id: "d1", date: "2026-04-01", amount: -1200, merchant: "Duplicate Service" }),
        tx({ id: "d2", date: "2026-04-01", amount: -1200, merchant: "Duplicate Service" }),
        tx({ id: "d3", date: "2026-05-01", amount: -1200, merchant: "Duplicate Service" }),
        tx({ id: "d4", date: "2026-06-01", amount: -1200, merchant: "Duplicate Service" }),
      ],
      new Date("2026-06-15"),
    );
    expect(exactDuplicate).toHaveLength(1);
    expect(exactDuplicate[0].transactionIds).toHaveLength(3);

    expect(
      detectRecurringCandidates(
        [
          tx({ id: "a1", date: "2026-03-01", amount: -1200, merchant: "Ambiguous Shop" }),
          tx({ id: "a2", date: "2026-03-01", amount: -1800, merchant: "Ambiguous Shop" }),
          tx({ id: "a3", date: "2026-04-01", amount: -1200, merchant: "Ambiguous Shop" }),
          tx({ id: "a4", date: "2026-05-01", amount: -1200, merchant: "Ambiguous Shop" }),
          tx({ id: "a5", date: "2026-06-01", amount: -1200, merchant: "Ambiguous Shop" }),
        ],
        new Date("2026-06-15"),
      ),
    ).toHaveLength(0);
  });

  it("normalizes weekly and biweekly amounts", () => {
    expect(normalizeRecurringAmount(1000, "WEEKLY")).toEqual({
      monthlyEquivalentMinor: 4333,
      annualEquivalentMinor: 52000,
    });
    expect(normalizeRecurringAmount(1000, "BI_WEEKLY")).toEqual({
      monthlyEquivalentMinor: 2167,
      annualEquivalentMinor: 26000,
    });
  });

  it("requires material changes before flagging a price increase", () => {
    expect(
      detectPriceChange([
        tx({ id: "a", date: "2026-05-01", amount: -1000 }),
        tx({ id: "b", date: "2026-06-01", amount: -1000 }),
        tx({ id: "c", date: "2026-07-01", amount: -1001 }),
      ]).priceChangeAmountMinor,
    ).toBe(0);
    expect(
      detectPriceChange([
        tx({ id: "a", date: "2026-05-01", amount: -1000 }),
        tx({ id: "b", date: "2026-06-01", amount: -1000 }),
        tx({ id: "c", date: "2026-07-01", amount: -1200 }),
      ]).priceChangeAmountMinor,
    ).toBe(200);
  });
});
