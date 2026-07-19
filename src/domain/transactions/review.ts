export type TransactionReviewRecommendation = {
  kind: "CREDIT_CARD_PAYMENT" | "REFUND" | "FEE";
  type: "CREDIT_CARD_PAYMENT" | "REFUND" | "FEE";
  affectsIncomeSpendingReports: boolean;
  title: string;
  reason: string;
  effect: string;
};

type ReviewableTransaction = {
  account: { type: string };
  amountMinor: number;
  originalDescription: string;
  normalizedMerchant: string;
};

function searchableDescription(transaction: ReviewableTransaction) {
  return `${transaction.originalDescription} ${transaction.normalizedMerchant}`
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function recommendTransactionReview(
  transaction: ReviewableTransaction,
): TransactionReviewRecommendation | null {
  const description = searchableDescription(transaction);

  const looksLikeCardPayment =
    transaction.account.type === "CREDIT" &&
    transaction.amountMinor > 0 &&
    (/payment thank you/.test(description) ||
      /ach deposit.*transfer from account/.test(description));
  if (looksLikeCardPayment)
    return {
      kind: "CREDIT_CARD_PAYMENT",
      type: "CREDIT_CARD_PAYMENT",
      affectsIncomeSpendingReports: false,
      title: "Likely credit-card payment",
      reason: "This is money applied to a credit-card balance, not household income.",
      effect: "Keep it in the card ledger and exclude it from income and spending totals.",
    };

  if (
    transaction.account.type === "CREDIT" &&
    transaction.amountMinor > 0 &&
    /(refund|cash reward|reward credit)/.test(description)
  )
    return {
      kind: "REFUND",
      type: "REFUND",
      affectsIncomeSpendingReports: true,
      title: "Likely refund or reward credit",
      reason: "This credit appears to reverse or offset prior card spending.",
      effect: "Keep it in reports as a spending offset, not as income.",
    };

  if (transaction.amountMinor < 0 && /\bfee\b/.test(description))
    return {
      kind: "FEE",
      type: "FEE",
      affectsIncomeSpendingReports: true,
      title: "Likely fee",
      reason: "The description identifies a charge imposed by the card issuer.",
      effect: "Keep it in reports as an expense.",
    };

  return null;
}
