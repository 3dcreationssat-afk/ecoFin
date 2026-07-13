import { createHash } from "node:crypto";

export type Frequency =
  | "WEEKLY"
  | "BI_WEEKLY"
  | "MONTHLY"
  | "EVERY_TWO_MONTHS"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "IRREGULAR_RECURRING"
  | "UNKNOWN";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type RecurringTransactionInput = {
  id: string;
  householdId: string;
  categoryId?: string | null;
  normalizedMerchant?: string | null;
  originalDescription: string;
  amountMinor: number;
  transactionDate: Date | string;
  postedDate?: Date | string | null;
  type?: string | null;
  excluded?: boolean | null;
  account?: { type?: string | null } | null;
  outgoingTransferMatches?: { status: string }[];
  incomingTransferMatches?: { status: string }[];
};

export type RecurringCandidate = {
  merchantKey: string;
  displayName: string;
  categoryId: string | null;
  frequency: Frequency;
  typicalAmountMinor: number;
  minAmountMinor: number;
  maxAmountMinor: number;
  averageAmountMinor: number;
  medianAmountMinor: number;
  monthlyEquivalentMinor: number;
  annualEquivalentMinor: number;
  amountVariabilityBps: number;
  confidence: Confidence;
  confidenceScore: number;
  classification: string;
  recommendation: string;
  recurringType: string;
  firstObservedDate: Date;
  lastObservedDate: Date;
  nextExpectedDate: Date | null;
  priceChangeAmountMinor: number;
  priceChangeBps: number;
  priceChangeEffectiveDate: Date | null;
  reasons: string[];
  detectionHash: string;
  transactionIds: string[];
};

type FrequencyRule = {
  frequency: Frequency;
  label: string;
  expectedDays: number;
  toleranceDays: number;
  minOccurrences: number;
};

const frequencyRules: FrequencyRule[] = [
  { frequency: "WEEKLY", label: "Weekly", expectedDays: 7, toleranceDays: 2, minOccurrences: 4 },
  {
    frequency: "BI_WEEKLY",
    label: "Bi-weekly",
    expectedDays: 14,
    toleranceDays: 3,
    minOccurrences: 3,
  },
  {
    frequency: "MONTHLY",
    label: "Monthly",
    expectedDays: 30,
    toleranceDays: 4,
    minOccurrences: 3,
  },
  {
    frequency: "EVERY_TWO_MONTHS",
    label: "Every two months",
    expectedDays: 61,
    toleranceDays: 7,
    minOccurrences: 3,
  },
  {
    frequency: "QUARTERLY",
    label: "Quarterly",
    expectedDays: 91,
    toleranceDays: 7,
    minOccurrences: 3,
  },
  {
    frequency: "SEMIANNUAL",
    label: "Semiannual",
    expectedDays: 183,
    toleranceDays: 14,
    minOccurrences: 3,
  },
  {
    frequency: "ANNUAL",
    label: "Annual",
    expectedDays: 365,
    toleranceDays: 15,
    minOccurrences: 3,
  },
];

const subscriptionTerms = [
  "subscription",
  "netflix",
  "spotify",
  "hulu",
  "apple.com/bill",
  "google",
  "adobe",
  "dropbox",
  "membership",
  "patreon",
  "gym",
];

const utilityTerms = ["electric", "water", "gas", "utility", "internet", "phone", "wireless"];
const insuranceTerms = ["insurance", "ins"];
const loanTerms = ["mortgage", "loan", "autopay"];

export function normalizeRecurringMerchant(input: string) {
  return input
    .toLowerCase()
    .replace(/https?:\/\//g, " ")
    .replace(/\b(www\.|com|net|org)\b/g, " ")
    .replace(
      /\b(store|terminal|term|auth|authorization|card|pos|purchase|authorized|monthly|annual|yearly|on)\b/g,
      " ",
    )
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[*#_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function isRecurringEligible(transaction: RecurringTransactionInput) {
  if (transaction.excluded) return false;
  if (transaction.amountMinor >= 0) return false;
  if (transaction.amountMinor === 0) return false;
  if (
    ["INCOME", "CREDIT", "REFUND", "TRANSFER_IN", "TRANSFER_OUT"].includes(transaction.type ?? "")
  )
    return false;
  if (transaction.type === "INTEREST" || transaction.type === "FEE") return false;
  if (
    transaction.outgoingTransferMatches?.some((match) => match.status === "CONFIRMED") ||
    transaction.incomingTransferMatches?.some((match) => match.status === "CONFIRMED")
  ) {
    return false;
  }
  const text =
    `${transaction.normalizedMerchant ?? ""} ${transaction.originalDescription}`.toLowerCase();
  if (
    transaction.account?.type === "CREDIT" &&
    /payment received|thank you|autopay|payment/.test(text)
  ) {
    return false;
  }
  if (/refund|statement credit|payment received|autopay|transfer from|transfer to/.test(text))
    return false;
  return true;
}

export function detectRecurringCandidates(
  transactions: RecurringTransactionInput[],
  asOf = new Date(),
) {
  const groups = new Map<string, RecurringTransactionInput[]>();
  for (const transaction of transactions.filter(isRecurringEligible)) {
    const merchantKey = normalizeRecurringMerchant(
      transaction.normalizedMerchant || transaction.originalDescription,
    );
    if (!merchantKey) continue;
    groups.set(merchantKey, [...(groups.get(merchantKey) ?? []), transaction]);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [merchantKey, group] of groups) {
    const sorted = [...group].sort((a, b) => observedDate(a).getTime() - observedDate(b).getTime());
    const candidate = buildCandidate(merchantKey, sorted, asOf);
    if (candidate) candidates.push(candidate);
  }
  return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function buildCandidate(
  merchantKey: string,
  transactions: RecurringTransactionInput[],
  asOf: Date,
) {
  if (transactions.length < 2) return null;
  const intervals = transactions
    .slice(1)
    .map((transaction, index) =>
      daysBetween(observedDate(transactions[index]), observedDate(transaction)),
    );
  const frequency = chooseFrequency(intervals, transactions.length);
  if (frequency.frequency === "UNKNOWN") return null;

  const amounts = transactions
    .map((transaction) => Math.abs(transaction.amountMinor))
    .sort((a, b) => a - b);
  const minAmountMinor = amounts[0];
  const maxAmountMinor = amounts[amounts.length - 1];
  const averageAmountMinor = roundDiv(
    amounts.reduce((total, amount) => total + amount, 0),
    amounts.length,
  );
  const medianAmountMinor =
    amounts.length % 2
      ? amounts[Math.floor(amounts.length / 2)]
      : roundDiv(amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2], 2);
  const typicalAmountMinor = medianAmountMinor;
  const amountVariabilityBps =
    typicalAmountMinor === 0
      ? 0
      : roundDiv((maxAmountMinor - minAmountMinor) * 10_000, typicalAmountMinor);
  const equivalents = normalizeRecurringAmount(typicalAmountMinor, frequency.frequency);
  const price = detectPriceChange(transactions);
  const categoryId =
    mostCommon(transactions.map((transaction) => transaction.categoryId ?? "").filter(Boolean)) ??
    null;
  const reasons = buildReasons(transactions, frequency, amountVariabilityBps, price);
  const score = confidenceScore(
    transactions.length,
    frequency.matchRatio,
    amountVariabilityBps,
    price,
  );
  const confidence: Confidence = score >= 85 ? "HIGH" : score >= 60 ? "MEDIUM" : "LOW";
  const classification = initialClassification(merchantKey, categoryId);
  const recommendation = initialRecommendation(
    classification,
    confidence,
    price.priceChangeAmountMinor,
  );
  const firstObservedDate = observedDate(transactions[0]);
  const lastObservedDate = observedDate(transactions[transactions.length - 1]);
  const nextExpectedDate = nextFutureOccurrence(
    lastObservedDate,
    frequency.frequency,
    frequency.expectedDays,
    asOf,
  );
  const transactionIds = transactions.map((transaction) => transaction.id);

  return {
    merchantKey,
    displayName: titleCase(merchantKey),
    categoryId,
    frequency: frequency.frequency,
    typicalAmountMinor,
    minAmountMinor,
    maxAmountMinor,
    averageAmountMinor,
    medianAmountMinor,
    monthlyEquivalentMinor: equivalents.monthlyEquivalentMinor,
    annualEquivalentMinor: equivalents.annualEquivalentMinor,
    amountVariabilityBps,
    confidence,
    confidenceScore: score,
    classification,
    recommendation,
    recurringType: initialRecurringType(merchantKey),
    firstObservedDate,
    lastObservedDate,
    nextExpectedDate,
    priceChangeAmountMinor: price.priceChangeAmountMinor,
    priceChangeBps: price.priceChangeBps,
    priceChangeEffectiveDate: price.priceChangeEffectiveDate,
    reasons,
    detectionHash: candidateHash(merchantKey, frequency.frequency, transactionIds),
    transactionIds,
  } satisfies RecurringCandidate;
}

function chooseFrequency(intervals: number[], occurrences: number) {
  let best = {
    frequency: "UNKNOWN" as Frequency,
    expectedDays: 0,
    matchRatio: 0,
    label: "Unknown",
  };
  for (const rule of frequencyRules) {
    if (occurrences < rule.minOccurrences) continue;
    const matches = intervals.filter(
      (interval) => Math.abs(interval - rule.expectedDays) <= rule.toleranceDays,
    );
    const matchRatio = intervals.length ? matches.length / intervals.length : 0;
    if (matchRatio > best.matchRatio) {
      best = {
        frequency: rule.frequency,
        expectedDays: rule.expectedDays,
        matchRatio,
        label: rule.label,
      };
    }
  }
  if (best.matchRatio >= 0.7) return best;
  if (occurrences >= 4 && intervals.every((interval) => interval >= 14)) {
    return {
      frequency: "IRREGULAR_RECURRING" as Frequency,
      expectedDays: 0,
      matchRatio: 0.5,
      label: "Irregular recurring",
    };
  }
  return best;
}

export function nextFutureOccurrence(
  lastObservedDate: Date,
  frequency: Frequency,
  expectedDays: number,
  asOf: Date,
) {
  if (frequency === "IRREGULAR_RECURRING" || frequency === "UNKNOWN") return null;
  let next = new Date(lastObservedDate);
  let guard = 0;
  while (next <= asOf && guard < 1_000) {
    next = addCadence(next, frequency, expectedDays);
    guard += 1;
  }
  return next > asOf ? next : null;
}

function addCadence(value: Date, frequency: Frequency, expectedDays: number) {
  const months =
    frequency === "MONTHLY"
      ? 1
      : frequency === "EVERY_TWO_MONTHS"
        ? 2
        : frequency === "QUARTERLY"
          ? 3
          : frequency === "SEMIANNUAL"
            ? 6
            : frequency === "ANNUAL"
              ? 12
              : 0;
  if (!months) return addDays(value, expectedDays);
  const day = value.getUTCDate();
  const result = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function normalizeRecurringAmount(amountMinor: number, frequency: Frequency) {
  switch (frequency) {
    case "WEEKLY":
      return {
        monthlyEquivalentMinor: roundDiv(amountMinor * 52, 12),
        annualEquivalentMinor: amountMinor * 52,
      };
    case "BI_WEEKLY":
      return {
        monthlyEquivalentMinor: roundDiv(amountMinor * 26, 12),
        annualEquivalentMinor: amountMinor * 26,
      };
    case "MONTHLY":
      return { monthlyEquivalentMinor: amountMinor, annualEquivalentMinor: amountMinor * 12 };
    case "EVERY_TWO_MONTHS":
      return {
        monthlyEquivalentMinor: roundDiv(amountMinor, 2),
        annualEquivalentMinor: amountMinor * 6,
      };
    case "QUARTERLY":
      return {
        monthlyEquivalentMinor: roundDiv(amountMinor, 3),
        annualEquivalentMinor: amountMinor * 4,
      };
    case "SEMIANNUAL":
      return {
        monthlyEquivalentMinor: roundDiv(amountMinor, 6),
        annualEquivalentMinor: amountMinor * 2,
      };
    case "ANNUAL":
      return {
        monthlyEquivalentMinor: roundDiv(amountMinor, 12),
        annualEquivalentMinor: amountMinor,
      };
    default:
      return { monthlyEquivalentMinor: amountMinor, annualEquivalentMinor: amountMinor * 12 };
  }
}

export function detectPriceChange(transactions: RecurringTransactionInput[]) {
  const sorted = [...transactions].sort(
    (a, b) => observedDate(a).getTime() - observedDate(b).getTime(),
  );
  if (sorted.length < 2) {
    return {
      priceChangeAmountMinor: 0,
      priceChangeBps: 0,
      priceChangeEffectiveDate: null as Date | null,
    };
  }
  const previous = Math.abs(sorted[sorted.length - 2].amountMinor);
  const current = Math.abs(sorted[sorted.length - 1].amountMinor);
  const delta = current - previous;
  const bps = previous === 0 ? 0 : roundDiv(delta * 10_000, previous);
  const historical = sorted.slice(0, -1).map((transaction) => Math.abs(transaction.amountMinor));
  const historicalMin = Math.min(...historical);
  const historicalMax = Math.max(...historical);
  const historicalVariability =
    previous === 0 ? 0 : roundDiv((historicalMax - historicalMin) * 10_000, previous);
  if (Math.abs(delta) >= 100 && Math.abs(bps) >= 300 && historicalVariability <= 1000) {
    return {
      priceChangeAmountMinor: delta,
      priceChangeBps: bps,
      priceChangeEffectiveDate: observedDate(sorted[sorted.length - 1]),
    };
  }
  return {
    priceChangeAmountMinor: 0,
    priceChangeBps: 0,
    priceChangeEffectiveDate: null as Date | null,
  };
}

function buildReasons(
  transactions: RecurringTransactionInput[],
  frequency: { frequency: Frequency; matchRatio: number; label: string },
  amountVariabilityBps: number,
  price: ReturnType<typeof detectPriceChange>,
) {
  const reasons = [
    `${transactions.length} matching expense transactions share a normalized merchant.`,
    `${frequency.label} interval pattern matched ${Math.round(frequency.matchRatio * 100)}% of gaps.`,
  ];
  if (amountVariabilityBps <= 500) reasons.push("Amounts are highly consistent.");
  else if (amountVariabilityBps <= 2500) reasons.push("Amounts vary within a moderate range.");
  else reasons.push("Amounts vary significantly, so review as a variable recurring bill.");
  if (price.priceChangeAmountMinor)
    reasons.push("Most recent charge changed materially from the previous charge.");
  if (transactions.some((transaction) => transaction.categoryId))
    reasons.push("Supporting transactions share category context.");
  return reasons;
}

function confidenceScore(
  occurrences: number,
  intervalRatio: number,
  amountVariabilityBps: number,
  price: ReturnType<typeof detectPriceChange>,
) {
  let score = 25;
  score += Math.min(25, occurrences * 6);
  score += Math.round(intervalRatio * 25);
  if (amountVariabilityBps <= 500) score += 20;
  else if (amountVariabilityBps <= 2500) score += 10;
  else score -= 10;
  if (price.priceChangeAmountMinor) score -= 5;
  return Math.max(0, Math.min(100, score));
}

function initialClassification(merchantKey: string, categoryId: string | null) {
  if (loanTerms.some((term) => merchantKey.includes(term))) return "ESSENTIAL";
  if (utilityTerms.some((term) => merchantKey.includes(term))) return "ESSENTIAL";
  if (insuranceTerms.some((term) => merchantKey.includes(term))) return "ESSENTIAL";
  if (subscriptionTerms.some((term) => merchantKey.includes(term))) return "OPTIONAL";
  return categoryId ? "USEFUL" : "UNKNOWN";
}

function initialRecommendation(
  classification: string,
  confidence: Confidence,
  priceChangeAmountMinor: number,
) {
  if (classification === "ESSENTIAL" && priceChangeAmountMinor > 0) return "RENEGOTIATE";
  if (classification === "ESSENTIAL") return "KEEP";
  if (classification === "OPTIONAL" && priceChangeAmountMinor > 0) return "CONSIDER_CANCELING";
  if (classification === "OPTIONAL") return "REVIEW";
  if (confidence === "LOW") return "REVIEW";
  return "UNKNOWN";
}

function initialRecurringType(merchantKey: string) {
  if (subscriptionTerms.some((term) => merchantKey.includes(term))) return "SUBSCRIPTION";
  if (insuranceTerms.some((term) => merchantKey.includes(term))) return "INSURANCE";
  if (loanTerms.some((term) => merchantKey.includes(term))) return "LOAN_PAYMENT";
  if (utilityTerms.some((term) => merchantKey.includes(term))) return "UTILITY";
  return "OTHER_RECURRING_EXPENSE";
}

function observedDate(transaction: RecurringTransactionInput) {
  return new Date(transaction.postedDate ?? transaction.transactionDate);
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function roundDiv(numerator: number, denominator: number) {
  return Math.trunc((numerator + Math.trunc(denominator / 2)) / denominator);
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function candidateHash(merchantKey: string, frequency: Frequency, transactionIds: string[]) {
  return createHash("sha256")
    .update([merchantKey, frequency, ...transactionIds.sort()].join("|"))
    .digest("hex");
}
