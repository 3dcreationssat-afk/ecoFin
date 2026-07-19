export const HIGH_CONFIDENCE_THRESHOLD = 85;
export const MEDIUM_CONFIDENCE_THRESHOLD = 65;

export type InterpretationType =
  | "PAYROLL_INCOME"
  | "OTHER_INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "CREDIT_CARD_PAYMENT"
  | "REFUND"
  | "REIMBURSEMENT"
  | "CASH_WITHDRAWAL"
  | "INTEREST"
  | "FEE"
  | "DEBT_PAYMENT"
  | "SAVINGS_CONTRIBUTION"
  | "BALANCE_ADJUSTMENT"
  | "UNKNOWN";

export type Interpretation = {
  classification: InterpretationType;
  transactionType: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  reason: string;
  evidence: string[];
  automaticallyApplied: boolean;
  reviewRequired: boolean;
  affectsIncomeSpendingReports: boolean;
};

type InterpretInput = {
  amountMinor: number;
  accountType: string;
  name: string;
  merchantName?: string | null;
  providerCategoryPrimary?: string | null;
  providerCategoryDetailed?: string | null;
  providerTransactionCode?: string | null;
};

export function interpretProviderTransaction(input: InterpretInput): Interpretation {
  const text = `${input.name} ${input.merchantName ?? ""}`.toLowerCase();
  const primary = input.providerCategoryPrimary ?? "";
  const detailed = input.providerCategoryDetailed ?? "";
  const evidence: string[] = [];
  const result = (
    classification: InterpretationType,
    transactionType: string,
    score: number,
    reason: string,
    affects = true,
  ) =>
    policy({
      classification,
      transactionType,
      score,
      reason,
      evidence,
      affectsIncomeSpendingReports: affects,
    });

  if (primary === "TRANSFER_IN" || primary === "TRANSFER_OUT") {
    evidence.push(
      `Provider category ${primary}.`,
      "Transfer meaning still requires cross-account reconciliation.",
    );
    return result(
      "TRANSFER",
      input.amountMinor < 0 ? "TRANSFER_OUT" : "TRANSFER_IN",
      72,
      "Provider evidence indicates a transfer, pending local pairing.",
      false,
    );
  }
  if (
    primary === "INCOME" &&
    /(payroll|direct dep|salary|paycheck|employer)/.test(`${text} ${detailed.toLowerCase()}`)
  ) {
    evidence.push("Income category and payroll language agree.", "Amount is an account inflow.");
    return result(
      "PAYROLL_INCOME",
      "INCOME",
      input.amountMinor > 0 ? 92 : 45,
      "Strong provider and description evidence identifies payroll.",
    );
  }
  if (primary === "INCOME" && input.amountMinor > 0) {
    evidence.push("Provider category is income.", "Amount is an account inflow.");
    return result("OTHER_INCOME", "INCOME", 78, "Provider evidence identifies non-payroll income.");
  }
  if (primary === "LOAN_PAYMENTS" || detailed.includes("LOAN_PAYMENTS")) {
    evidence.push("Provider category identifies a loan payment.");
    return result("DEBT_PAYMENT", "EXPENSE", 82, "The transaction appears to be a debt payment.");
  }
  if (primary === "BANK_FEES" || /\bfee\b/.test(text)) {
    evidence.push(
      primary === "BANK_FEES"
        ? "Provider category identifies a bank fee."
        : "Description contains fee language.",
    );
    return result("FEE", "FEE", primary === "BANK_FEES" ? 93 : 72, "The transaction is a fee.");
  }
  if (/\b(atm|cash withdrawal)\b/.test(text) || detailed.includes("CASH_WITHDRAWAL")) {
    evidence.push("Description or provider detail identifies a cash withdrawal.");
    return result("CASH_WITHDRAWAL", "EXPENSE", 88, "The transaction is a cash withdrawal.");
  }
  if (
    input.amountMinor > 0 &&
    input.accountType === "CREDIT" &&
    /(payment|autopay|pmt|thank you)/.test(text)
  ) {
    evidence.push("Credit-account inflow and payment language agree.");
    return result(
      "CREDIT_CARD_PAYMENT",
      "CREDIT_CARD_PAYMENT",
      91,
      "The credit is a likely card payment, not income.",
      false,
    );
  }
  if (input.amountMinor > 0 && input.accountType === "CREDIT") {
    evidence.push("Credit-account inflow is consistent with a refund or statement credit.");
    return result("REFUND", "REFUND", 68, "The credit provisionally offsets card spending.");
  }
  if (input.amountMinor < 0) {
    evidence.push("Amount is an account outflow.");
    if (primary) evidence.push(`Provider category ${primary}.`);
    return result("EXPENSE", "EXPENSE", primary ? 82 : 70, "The transaction is an expense.");
  }
  evidence.push("Amount is an account inflow without enough evidence to identify its meaning.");
  return result(
    "UNKNOWN",
    "UNKNOWN",
    40,
    "Income, refund, reimbursement, and transfer remain plausible.",
  );
}

function policy(
  input: Omit<Interpretation, "confidence" | "automaticallyApplied" | "reviewRequired">,
): Interpretation {
  const confidence =
    input.score >= HIGH_CONFIDENCE_THRESHOLD
      ? "HIGH"
      : input.score >= MEDIUM_CONFIDENCE_THRESHOLD
        ? "MEDIUM"
        : "LOW";
  return {
    ...input,
    confidence,
    automaticallyApplied: confidence === "HIGH",
    reviewRequired: confidence === "LOW" && input.affectsIncomeSpendingReports,
  };
}
