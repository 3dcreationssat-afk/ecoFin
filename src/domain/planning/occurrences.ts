export function nextOccurrence(
  date: Date,
  frequency: string,
  day1?: number | null,
  day2?: number | null,
) {
  const next = new Date(date);
  if (frequency === "ONE_TIME") return null;
  if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  if (frequency === "BIWEEKLY") next.setUTCDate(next.getUTCDate() + 14);
  if (frequency === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1);
  if (frequency === "QUARTERLY") next.setUTCMonth(next.getUTCMonth() + 3);
  if (frequency === "ANNUAL") next.setUTCFullYear(next.getUTCFullYear() + 1);
  if (frequency === "TWICE_MONTHLY") {
    const first = day1!,
      second = day2!;
    if (next.getUTCDate() < second) next.setUTCDate(second);
    else {
      next.setUTCMonth(next.getUTCMonth() + 1, first);
    }
  }
  return next;
}

export function occurrenceDates(
  start: Date,
  frequency: string,
  end: Date,
  day1?: number | null,
  day2?: number | null,
  scheduleEnd?: Date | null,
) {
  const dates: Date[] = [];
  let cursor = new Date(start);
  while (cursor < end && (!scheduleEnd || cursor <= scheduleEnd) && dates.length < 100) {
    dates.push(new Date(cursor));
    const next = nextOccurrence(cursor, frequency, day1, day2);
    if (!next) break;
    cursor = next;
  }
  return dates;
}

export function effectiveOccurrenceStatus(status: string, expectedDate: Date, asOf: Date) {
  return status === "UPCOMING" && expectedDate < asOf ? "OVERDUE" : status;
}

export function savingsRecommendation(input: {
  maximumSurplusMinor: number;
  mode: string;
  targetBps: number;
  discretionaryReserveMinor: number;
  extraSafetyReserveMinor: number;
  minimumCashRetainedMinor: number;
  startingCashMinor: number;
  confidence: string;
  conservativeAdjustmentBps: number;
}) {
  const retained =
    Math.max(
      input.discretionaryReserveMinor,
      input.minimumCashRetainedMinor - input.startingCashMinor,
      0,
    ) + input.extraSafetyReserveMinor;
  const available = Math.max(0, input.maximumSurplusMinor - retained);
  const target = Math.floor((input.maximumSurplusMinor * input.targetBps) / 10000);
  const recommended = Math.max(0, Math.min(available, target));
  const confidenceReduction =
    input.confidence === "HIGH"
      ? 0
      : Math.floor((recommended * input.conservativeAdjustmentBps) / 10000);
  const conservative = Math.max(0, recommended - confidenceReduction);
  return {
    retainedDiscretionaryMinor: retained,
    recommendedMinor: recommended,
    conservativeMinor: conservative,
    safeToSpendMinor: Math.max(0, input.maximumSurplusMinor - recommended),
    policyCapMinor: target,
  };
}
