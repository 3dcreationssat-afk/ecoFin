import {
  dateKey,
  generateForecastOccurrences,
  type ForecastRuleDefinition,
  type PersistedForecastOccurrence,
} from "./occurrences";
import { normalizeRecurringMerchant } from "@/domain/recurring/detection";

export type MatchableRule = ForecastRuleDefinition & {
  accountId: string | null;
  merchantKey: string;
  dateToleranceDays: number;
  amountToleranceBps: number;
  state: string;
  occurrences: PersistedForecastOccurrence[];
};
export type MatchableTransaction = {
  id: string;
  accountId: string;
  transactionDate: Date;
  amountMinor: number;
  normalizedMerchant: string;
  originalDescription: string;
  type: string;
  excluded: boolean;
  affectsLedger: boolean;
  possibleDuplicate: boolean;
  clearingStatus: string;
  outgoingTransferMatches?: { status: string }[];
  incomingTransferMatches?: { status: string }[];
};
export type ForecastMatch = {
  ruleId: string;
  expectedDate: Date;
  transactionId: string;
  score: number;
  dateDifferenceDays: number;
  amountDifferenceMinor: number;
  reasons: string[];
};

export function matchForecastTransactions(
  rules: MatchableRule[],
  transactions: MatchableTransaction[],
  asOf = new Date(),
) {
  const start = new Date(asOf);
  start.setUTCDate(start.getUTCDate() - 45);
  const end = new Date(asOf);
  end.setUTCDate(end.getUTCDate() + 45);
  const expected = rules
    .filter((rule) => rule.state === "CONFIRMED")
    .flatMap((rule) =>
      generateForecastOccurrences(rule, start, end, rule.occurrences)
        .filter(
          (item) =>
            !["MATCHED", "POSTED", "SKIPPED", "CANCELLED", "SUPERSEDED"].includes(item.status),
        )
        .map((occurrence) => ({ rule, occurrence })),
    );
  const usedRules = new Set<string>();
  const matches: ForecastMatch[] = [];
  for (const transaction of transactions
    .filter(eligibleTransaction)
    .sort(
      (a, b) =>
        a.transactionDate.getTime() - b.transactionDate.getTime() || a.id.localeCompare(b.id),
    )) {
    const candidates = expected
      .filter(
        ({ rule, occurrence }) =>
          !usedRules.has(`${rule.id}|${dateKey(occurrence.expectedDate)}`) &&
          directionMatches(rule.direction, transaction.amountMinor) &&
          (!rule.accountId || rule.accountId === transaction.accountId),
      )
      .map(({ rule, occurrence }) =>
        score(rule, occurrence.expectedDate, occurrence.expectedAmountMinor, transaction),
      )
      .filter((item): item is ForecastMatch => item !== null && item.score >= 70)
      .sort((a, b) => b.score - a.score || a.ruleId.localeCompare(b.ruleId));
    if (!candidates.length || (candidates[1] && candidates[0].score - candidates[1].score < 8))
      continue;
    const best = candidates[0];
    usedRules.add(`${best.ruleId}|${dateKey(best.expectedDate)}`);
    matches.push(best);
  }
  return matches;
}

function score(
  rule: MatchableRule,
  expectedDate: Date,
  expectedAmount: number,
  transaction: MatchableTransaction,
): ForecastMatch | null {
  const days = Math.round(
    (transaction.transactionDate.getTime() - expectedDate.getTime()) / 86_400_000,
  );
  if (Math.abs(days) > rule.dateToleranceDays) return null;
  const amountDifference = Math.abs(transaction.amountMinor) - expectedAmount;
  const amountBps = Math.round((Math.abs(amountDifference) * 10_000) / Math.max(1, expectedAmount));
  if (amountBps > rule.amountToleranceBps) return null;
  const merchant = normalizeRecurringMerchant(
    transaction.normalizedMerchant || transaction.originalDescription,
  );
  const similarity = tokenSimilarity(rule.merchantKey, merchant);
  if (similarity < 0.45) return null;
  const score = Math.round(
    45 * similarity +
      30 * (1 - Math.abs(days) / Math.max(1, rule.dateToleranceDays + 1)) +
      25 * (1 - amountBps / Math.max(1, rule.amountToleranceBps + 1)),
  );
  return {
    ruleId: rule.id,
    expectedDate,
    transactionId: transaction.id,
    score,
    dateDifferenceDays: days,
    amountDifferenceMinor: amountDifference,
    reasons: [
      `Account and ${rule.direction.toLowerCase()} direction match.`,
      `Date is ${Math.abs(days)} day(s) from expected.`,
      `Amount differs by ${amountBps / 100}%.`,
      `Merchant similarity is ${Math.round(similarity * 100)}%.`,
    ],
  };
}

function eligibleTransaction(item: MatchableTransaction) {
  return (
    !item.excluded &&
    item.affectsLedger &&
    !item.possibleDuplicate &&
    item.clearingStatus === "CLEARED" &&
    !item.outgoingTransferMatches?.some((match) => match.status === "CONFIRMED") &&
    !item.incomingTransferMatches?.some((match) => match.status === "CONFIRMED")
  );
}
function directionMatches(direction: string, amount: number) {
  return direction === "INCOME" ? amount > 0 : amount < 0;
}
function tokenSimilarity(a: string, b: string) {
  const left = new Set(normalizeRecurringMerchant(a).split(" ").filter(Boolean));
  const right = new Set(normalizeRecurringMerchant(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.min(left.size, right.size);
}
