export type ForecastCadence =
  | "ONE_TIME"
  | "WEEKLY"
  | "BI_WEEKLY"
  | "BIWEEKLY"
  | "SEMIMONTHLY"
  | "TWICE_MONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "IRREGULAR";

export type ForecastRuleDefinition = {
  id: string;
  name: string;
  direction: string;
  cadence: string;
  nextExpectedDate: Date;
  typicalAmountMinor: number;
  semimonthlyDay1?: number | null;
  semimonthlyDay2?: number | null;
  endDate?: Date | null;
};

export type PersistedForecastOccurrence = {
  id: string;
  expectedDate: Date;
  expectedAmountMinor: number;
  status: string;
  overrideDate?: Date | null;
  overrideAmountMinor?: number | null;
  matchedTransactionId?: string | null;
  amountDifferenceMinor?: number;
  dateDifferenceDays?: number;
};

export type GeneratedForecastOccurrence = {
  id: string;
  ruleId: string;
  ruleName: string;
  expectedDate: Date;
  effectiveDate: Date;
  expectedAmountMinor: number;
  effectiveAmountMinor: number;
  status: string;
  persistedId: string | null;
  matchedTransactionId: string | null;
};

export function generateForecastOccurrences(
  rule: ForecastRuleDefinition,
  start: Date,
  end: Date,
  persisted: PersistedForecastOccurrence[] = [],
) {
  const stored = new Map(persisted.map((item) => [dateKey(item.expectedDate), item]));
  const results: GeneratedForecastOccurrence[] = [];
  let cursor = dateOnly(rule.nextExpectedDate);
  let guard = 0;
  while (cursor < end && (!rule.endDate || cursor <= rule.endDate) && guard < 550) {
    if (cursor >= start) {
      const exception = stored.get(dateKey(cursor));
      const effectiveDate = dateOnly(exception?.overrideDate ?? cursor);
      results.push({
        id: exception?.id ?? `virtual:${rule.id}:${dateKey(cursor)}`,
        ruleId: rule.id,
        ruleName: rule.name,
        expectedDate: new Date(cursor),
        effectiveDate,
        expectedAmountMinor: exception?.expectedAmountMinor ?? rule.typicalAmountMinor,
        effectiveAmountMinor:
          exception?.overrideAmountMinor ??
          exception?.expectedAmountMinor ??
          rule.typicalAmountMinor,
        status: exception?.status ?? "EXPECTED",
        persistedId: exception?.id ?? null,
        matchedTransactionId: exception?.matchedTransactionId ?? null,
      });
    }
    const next = nextForecastDate(cursor, rule);
    if (!next || next <= cursor) break;
    cursor = next;
    guard += 1;
  }
  return results;
}

export function nextForecastDate(
  date: Date,
  rule: Pick<ForecastRuleDefinition, "cadence" | "semimonthlyDay1" | "semimonthlyDay2">,
) {
  const cadence = normalizeCadence(rule.cadence);
  if (cadence === "ONE_TIME" || cadence === "IRREGULAR") return null;
  if (cadence === "WEEKLY") return addDays(date, 7);
  if (cadence === "BIWEEKLY") return addDays(date, 14);
  if (cadence === "SEMIMONTHLY") {
    const first = rule.semimonthlyDay1 ?? 1;
    const second = rule.semimonthlyDay2 ?? 15;
    const day = date.getUTCDate();
    if (day < second) return setClampedDay(date.getUTCFullYear(), date.getUTCMonth(), second);
    return setClampedDay(date.getUTCFullYear(), date.getUTCMonth() + 1, first);
  }
  const months =
    cadence === "MONTHLY" ? 1 : cadence === "QUARTERLY" ? 3 : cadence === "SEMIANNUAL" ? 6 : 12;
  return setClampedDay(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate());
}

export function normalizeCadence(value: string): ForecastCadence {
  if (value === "BI_WEEKLY") return "BIWEEKLY";
  if (value === "TWICE_MONTHLY") return "SEMIMONTHLY";
  if (value === "IRREGULAR_RECURRING" || value === "UNKNOWN") return "IRREGULAR";
  return value as ForecastCadence;
}

export function dateKey(value: Date) {
  return dateOnly(value).toISOString().slice(0, 10);
}

export function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number) {
  const result = dateOnly(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function setClampedDay(year: number, month: number, day: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first;
}
