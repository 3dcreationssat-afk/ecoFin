export const TRANSFER_DATE_WINDOW_DAYS = 3;

export type TransferConfidence = "HIGH" | "MEDIUM" | "LOW";
export type TransferStatus = "SUGGESTED" | "CONFIRMED" | "REJECTED" | "BROKEN" | "UNMATCHED";
export type TransferSource = "AUTOMATIC_CANDIDATE" | "USER_CONFIRMED" | "USER_CREATED";

export type TransferTransaction = {
  id: string;
  householdId: string;
  accountId: string;
  amountMinor: number;
  transactionDate: Date | string;
  postedDate?: Date | string | null;
  originalDescription: string;
  normalizedMerchant: string;
  type?: string | null;
  reviewStatus?: string | null;
  excluded?: boolean | null;
  account: { id: string; name: string; type: string };
};

export type TransferScore = {
  valid: boolean;
  score: number;
  confidence: TransferConfidence;
  reasons: string[];
  invalidReasons: string[];
  dateDiffDays: number;
  isCreditCardPayment: boolean;
};

const transferWords = [
  "transfer",
  "xfer",
  "online transfer",
  "payment",
  "pmt",
  "autopay",
  "card payment",
  "credit card payment",
];

const feeWords = [
  "interest",
  "annual fee",
  "late fee",
  "cash advance",
  "foreign transaction fee",
  "fee",
];
const refundWords = ["refund", "statement credit", "credit adjustment", "reversal"];

export function classifyTransferPair(a: TransferTransaction, b: TransferTransaction) {
  return a.amountMinor < 0 ? { outgoing: a, incoming: b } : { outgoing: b, incoming: a };
}

export function scoreTransferCandidate(
  a: TransferTransaction,
  b: TransferTransaction,
): TransferScore {
  const reasons: string[] = [];
  const invalidReasons: string[] = [];
  if (a.id === b.id) invalidReasons.push("Transactions cannot match themselves.");
  if (a.householdId !== b.householdId)
    invalidReasons.push("Transactions belong to different households.");
  if (a.accountId === b.accountId)
    invalidReasons.push("Same-account transactions are not transfer candidates.");
  if (a.amountMinor === 0 || b.amountMinor === 0)
    invalidReasons.push("Zero-value transactions are not supported.");
  if (a.excluded || b.excluded)
    invalidReasons.push("Excluded transactions require explicit handling.");
  if (a.amountMinor + b.amountMinor !== 0) {
    invalidReasons.push("Only exact opposite-sign amount matches are supported.");
  }
  if (!isAllowedType(a) || !isAllowedType(b))
    invalidReasons.push("Fees, interest, and refunds are not automatic transfer candidates.");

  const { outgoing, incoming } = classifyTransferPair(a, b);
  const dateDiffDays = compareDateDiffDays(outgoing, incoming);
  if (dateDiffDays > TRANSFER_DATE_WINDOW_DAYS) {
    invalidReasons.push(`Date difference is beyond ${TRANSFER_DATE_WINDOW_DAYS} days.`);
  }

  if (invalidReasons.length) {
    return {
      valid: false,
      score: 0,
      confidence: "LOW",
      reasons,
      invalidReasons,
      dateDiffDays,
      isCreditCardPayment: false,
    };
  }

  let score = 45;
  reasons.push("Exact opposite-sign amount match.");
  reasons.push("Different household-owned accounts.");
  if (dateDiffDays === 0) {
    score += 25;
    reasons.push("Posted or transaction dates match exactly.");
  } else if (dateDiffDays === 1) {
    score += 18;
    reasons.push("Dates are one day apart.");
  } else {
    score += 10;
    reasons.push("Dates are two to three days apart.");
  }

  const description =
    `${outgoing.originalDescription} ${incoming.originalDescription} ${outgoing.normalizedMerchant} ${incoming.normalizedMerchant}`.toLowerCase();
  if (transferWords.some((word) => description.includes(word))) {
    score += 12;
    reasons.push("Description contains transfer or payment language.");
  }
  if (
    description.includes(outgoing.account.name.toLowerCase()) ||
    description.includes(incoming.account.name.toLowerCase())
  ) {
    score += 8;
    reasons.push("Description references one of the account names.");
  }

  const checkingSavings =
    accountTypes(outgoing, incoming, "CHECKING", "SAVINGS") ||
    accountTypes(outgoing, incoming, "SAVINGS", "CHECKING");
  if (checkingSavings) {
    score += 8;
    reasons.push("Checking-to-savings account pairing.");
  }

  const isCreditCardPayment =
    outgoing.account.type !== "CREDIT" && incoming.account.type === "CREDIT";
  if (isCreditCardPayment) {
    score += 14;
    reasons.push("Checking or cash outflow paired with credit-card account inflow.");
    reasons.push("Credit-card payments do not create new household spending.");
  }

  const confidence: TransferConfidence = score >= 85 ? "HIGH" : score >= 65 ? "MEDIUM" : "LOW";
  return {
    valid: true,
    score,
    confidence,
    reasons,
    invalidReasons,
    dateDiffDays,
    isCreditCardPayment,
  };
}

export function dateForTransferComparison(transaction: TransferTransaction) {
  return dateOnly(transaction.postedDate ?? transaction.transactionDate);
}

export function compareDateDiffDays(a: TransferTransaction, b: TransferTransaction) {
  const left = dateForTransferComparison(a).getTime();
  const right = dateForTransferComparison(b).getTime();
  return Math.abs(Math.round((left - right) / 86_400_000));
}

export function isTransferNeutralType(type?: string | null) {
  return type === "TRANSFER_OUT" || type === "TRANSFER_IN";
}

export function isExpenseType(type?: string | null) {
  return ["DEBIT", "EXPENSE", "FEE", "INTEREST"].includes(type ?? "");
}

export function isIncomeType(type?: string | null) {
  return ["CREDIT", "INCOME"].includes(type ?? "");
}

export function looksLikeFeeOrRefund(transaction: TransferTransaction) {
  const text = `${transaction.originalDescription} ${transaction.normalizedMerchant}`.toLowerCase();
  return (
    feeWords.some((word) => text.includes(word)) || refundWords.some((word) => text.includes(word))
  );
}

function isAllowedType(transaction: TransferTransaction) {
  if (["FEE", "INTEREST", "REFUND"].includes(transaction.type ?? "")) return false;
  return !looksLikeFeeOrRefund(transaction);
}

function accountTypes(a: TransferTransaction, b: TransferTransaction, left: string, right: string) {
  return a.account.type === left && b.account.type === right;
}

function dateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
