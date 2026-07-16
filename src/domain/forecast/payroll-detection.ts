import { createHash } from "node:crypto";
import { normalizeRecurringMerchant } from "@/domain/recurring/detection";

export type PayrollTransaction = {
  id: string;
  householdId: string;
  accountId: string;
  normalizedMerchant?: string | null;
  originalDescription: string;
  amountMinor: number;
  transactionDate: Date | string;
  postedDate?: Date | string | null;
  type?: string | null;
  excluded?: boolean;
  affectsLedger?: boolean;
  possibleDuplicate?: boolean;
  clearingStatus?: string;
  outgoingTransferMatches?: { status: string }[];
  incomingTransferMatches?: { status: string }[];
};

export type PayrollCandidate = {
  householdId: string;
  accountId: string;
  merchantKey: string;
  displayName: string;
  cadence: "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY";
  typicalAmountMinor: number;
  minAmountMinor: number;
  maxAmountMinor: number;
  amountVariabilityBps: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore: number;
  firstObservedDate: Date;
  lastObservedDate: Date;
  nextExpectedDate: Date;
  expectedWeekday: number | null;
  semimonthlyDay1: number | null;
  semimonthlyDay2: number | null;
  dateToleranceDays: number;
  amountToleranceBps: number;
  transactionIds: string[];
  reasons: string[];
  fingerprint: string;
};

const EXCLUDED =
  /\b(bonus|reimburse(?:ment)?|expense repay|refund|interest|cashback|reward|tax refund|transfer|xfer|zelle|venmo|cash ?app|p2p)\b/i;

export function isPayrollEligible(transaction: PayrollTransaction) {
  if (transaction.amountMinor <= 0 || transaction.excluded || transaction.possibleDuplicate)
    return false;
  if (transaction.affectsLedger === false || transaction.clearingStatus === "VOID") return false;
  if (["TRANSFER_IN", "TRANSFER_OUT", "REFUND", "INTEREST"].includes(transaction.type ?? ""))
    return false;
  if (
    transaction.outgoingTransferMatches?.some((item) => item.status === "CONFIRMED") ||
    transaction.incomingTransferMatches?.some((item) => item.status === "CONFIRMED")
  )
    return false;
  return !EXCLUDED.test(
    `${transaction.normalizedMerchant ?? ""} ${transaction.originalDescription}`,
  );
}

export function detectPayrollCandidates(transactions: PayrollTransaction[], asOf = new Date()) {
  const groups = new Map<string, PayrollTransaction[]>();
  for (const transaction of transactions.filter(isPayrollEligible)) {
    const merchantKey = payrollMerchantKey(
      transaction.normalizedMerchant || transaction.originalDescription,
    );
    if (!merchantKey) continue;
    const key = `${transaction.householdId}|${transaction.accountId}|${merchantKey}`;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return [...groups.values()]
    .map((group) => buildPayrollCandidate(group, asOf))
    .filter((candidate): candidate is PayrollCandidate => Boolean(candidate))
    .sort(
      (a, b) => b.confidenceScore - a.confidenceScore || a.fingerprint.localeCompare(b.fingerprint),
    );
}

function buildPayrollCandidate(group: PayrollTransaction[], asOf: Date): PayrollCandidate | null {
  const sorted = [...group].sort((a, b) => observed(a).getTime() - observed(b).getTime());
  const unique = distinctDates(sorted);
  if (unique.length < 2) return null;
  const intervals = unique
    .slice(1)
    .map((item, index) => daysBetween(observed(unique[index]), observed(item)));
  const cadence = detectCadence(unique, intervals);
  if (!cadence) return null;
  const amounts = unique.map((item) => item.amountMinor).sort((a, b) => a - b);
  const typical = median(amounts);
  const variability = typical ? roundDiv((amounts.at(-1)! - amounts[0]) * 10_000, typical) : 10_000;
  if (variability > 5000) return null;
  const ratio = cadence.matchCount / Math.max(1, intervals.length);
  let score = Math.min(28, unique.length * 7) + Math.round(ratio * 40);
  score += variability <= 1000 ? 25 : variability <= 2500 ? 15 : 5;
  score += weekdayConsistency(unique) >= 0.75 ? 7 : 0;
  score = Math.min(100, score);
  const confidence =
    score >= 85 && unique.length >= 4
      ? "HIGH"
      : score >= 60 && unique.length >= 3
        ? "MEDIUM"
        : "LOW";
  const lastObservedDate = observed(unique.at(-1)!);
  const nextExpectedDate = nextDate(
    lastObservedDate,
    cadence.cadence,
    cadence.days,
    cadence.semimonthlyDays,
  );
  if (daysBetween(lastObservedDate, asOf) > cadence.days * 3) return null;
  const merchantKey = payrollMerchantKey(
    unique[0].normalizedMerchant || unique[0].originalDescription,
  );
  const expectedWeekday =
    cadence.cadence === "SEMIMONTHLY"
      ? null
      : mostCommon(unique.map((item) => observed(item).getUTCDay()));
  const reasons = [
    `${unique.length} positive deposits matched the same account and normalized source.`,
    `${cadence.label} cadence matched ${Math.round(ratio * 100)}% of observed gaps.`,
    `Net amounts varied by ${(variability / 100).toFixed(1)}%.`,
  ];
  if (weekdayConsistency(unique) >= 0.75)
    reasons.push("Deposit weekday is consistent, including small early-posting shifts.");
  return {
    householdId: unique[0].householdId,
    accountId: unique[0].accountId,
    merchantKey,
    displayName: titleCase(merchantKey),
    cadence: cadence.cadence,
    typicalAmountMinor: typical,
    minAmountMinor: amounts[0],
    maxAmountMinor: amounts.at(-1)!,
    amountVariabilityBps: variability,
    confidence,
    confidenceScore: score,
    firstObservedDate: observed(unique[0]),
    lastObservedDate,
    nextExpectedDate,
    expectedWeekday,
    semimonthlyDay1: cadence.semimonthlyDays?.[0] ?? null,
    semimonthlyDay2: cadence.semimonthlyDays?.[1] ?? null,
    dateToleranceDays: cadence.cadence === "SEMIMONTHLY" ? 3 : 2,
    amountToleranceBps: Math.max(1000, Math.min(3000, variability + 500)),
    transactionIds: unique.map((item) => item.id),
    reasons,
    fingerprint: fingerprint(
      unique[0].householdId,
      unique[0].accountId,
      merchantKey,
      cadence.cadence,
    ),
  };
}

function detectCadence(items: PayrollTransaction[], intervals: number[]) {
  const rules = [
    { cadence: "WEEKLY" as const, days: 7, tolerance: 2, label: "Weekly" },
    { cadence: "BIWEEKLY" as const, days: 14, tolerance: 3, label: "Every two weeks" },
    { cadence: "MONTHLY" as const, days: 30, tolerance: 4, label: "Monthly" },
  ];
  const ranked = rules
    .map((rule) => ({
      ...rule,
      matchCount: intervals.filter((gap) => Math.abs(gap - rule.days) <= rule.tolerance).length,
    }))
    .sort((a, b) => b.matchCount - a.matchCount || a.tolerance - b.tolerance);
  const semimonthly = semimonthlyPattern(items);
  if (semimonthly && semimonthly.matchCount >= (ranked[0]?.matchCount ?? 0)) return semimonthly;
  const best = ranked[0];
  if (!best || best.matchCount / Math.max(1, intervals.length) < 0.65) return null;
  return { ...best, semimonthlyDays: null as [number, number] | null };
}

function semimonthlyPattern(items: PayrollTransaction[]) {
  if (items.length < 3) return null;
  const days = items.map((item) => observed(item).getUTCDate()).sort((a, b) => a - b);
  const uniqueDays = [...new Set(days)];
  if (uniqueDays.length < 2) return null;
  let split = 0;
  let largestGap = 0;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const gap = uniqueDays[index] - uniqueDays[index - 1];
    if (gap > largestGap) {
      largestGap = gap;
      split = index;
    }
  }
  const firstSet = new Set(uniqueDays.slice(0, split));
  const firstValues = days.filter((day) => firstSet.has(day));
  const secondValues = days.filter((day) => !firstSet.has(day));
  if (largestGap < 7 || firstValues.length < 2 || secondValues.length < 2) return null;
  const first = median(firstValues);
  const second = median(secondValues);
  if (
    Math.max(...firstValues) - Math.min(...firstValues) > 2 ||
    Math.max(...secondValues) - Math.min(...secondValues) > 2
  )
    return null;
  const matches = days.filter(
    (day) => Math.min(Math.abs(day - first), Math.abs(day - second)) <= 3,
  ).length;
  if (matches / days.length < 0.8) return null;
  return {
    cadence: "SEMIMONTHLY" as const,
    days: 15,
    tolerance: 3,
    label: "Twice monthly",
    matchCount: Math.max(0, items.length - 1),
    semimonthlyDays: [first, second] as [number, number],
  };
}

function nextDate(
  last: Date,
  cadence: PayrollCandidate["cadence"],
  days: number,
  semimonthly: [number, number] | null,
) {
  if (cadence === "SEMIMONTHLY" && semimonthly) {
    const [first, second] = semimonthly;
    if (last.getUTCDate() < second)
      return clampedDate(last.getUTCFullYear(), last.getUTCMonth(), second);
    return clampedDate(last.getUTCFullYear(), last.getUTCMonth() + 1, first);
  }
  if (cadence === "MONTHLY")
    return clampedDate(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate());
  const next = new Date(last);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function payrollMerchantKey(value: string) {
  return normalizeRecurringMerchant(value)
    .replace(/\b(payroll|direct deposit|ach credit|deposit|salary|net pay)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function observed(item: PayrollTransaction) {
  return new Date(item.postedDate ?? item.transactionDate);
}
function distinctDates(items: PayrollTransaction[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = observed(item).toISOString().slice(0, 10);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function weekdayConsistency(items: PayrollTransaction[]) {
  const counts = new Map<number, number>();
  items.forEach((item) =>
    counts.set(observed(item).getUTCDay(), (counts.get(observed(item).getUTCDay()) ?? 0) + 1),
  );
  return Math.max(...counts.values()) / items.length;
}
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : roundDiv(sorted[middle - 1] + sorted[middle], 2);
}
function mostCommon(values: number[]) {
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}
function roundDiv(value: number, divisor: number) {
  return Math.round(value / divisor);
}
function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function fingerprint(householdId: string, accountId: string, merchantKey: string, cadence: string) {
  return createHash("sha256")
    .update([householdId, accountId, merchantKey, cadence, "income"].join("|"))
    .digest("hex");
}
function clampedDate(year: number, month: number, day: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first;
}
