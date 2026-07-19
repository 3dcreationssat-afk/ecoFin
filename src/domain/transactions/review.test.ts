import { describe, expect, it } from "vitest";
import { recommendTransactionReview } from "./review";

const base = {
  account: { type: "CREDIT" },
  amountMinor: 10000,
  originalDescription: "Payment Thank You-Mobile",
  normalizedMerchant: "Payment Thank You-Mobile",
};

describe("transaction review recommendations", () => {
  it("recognizes a credit-card payment and removes it from income/spending reports", () => {
    expect(recommendTransactionReview(base)).toMatchObject({
      kind: "CREDIT_CARD_PAYMENT",
      type: "CREDIT_CARD_PAYMENT",
      affectsIncomeSpendingReports: false,
    });
  });

  it("keeps refunds as spending offsets and fees as expenses", () => {
    expect(
      recommendTransactionReview({
        ...base,
        originalDescription: "YOUR CASH REWARD/REFUND IS",
        normalizedMerchant: "Cash reward",
      }),
    ).toMatchObject({ kind: "REFUND", affectsIncomeSpendingReports: true });
    expect(
      recommendTransactionReview({
        ...base,
        amountMinor: -34,
        originalDescription: "FOREIGN TRANSACTION FEE",
        normalizedMerchant: "Foreign transaction fee",
      }),
    ).toMatchObject({ kind: "FEE", affectsIncomeSpendingReports: true });
  });

  it("does not guess when evidence is insufficient", () => {
    expect(
      recommendTransactionReview({
        ...base,
        originalDescription: "MYSTERY CREDIT",
        normalizedMerchant: "Mystery credit",
      }),
    ).toBeNull();
  });
});
