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
  const cashAfterObligationsAndProtectionsMinor = input.maximumSurplusMinor;
  const requestedRetained =
    Math.max(
      input.discretionaryReserveMinor,
      input.minimumCashRetainedMinor - input.startingCashMinor,
      0,
    ) + input.extraSafetyReserveMinor;
  const retained = Math.min(
    Math.max(0, cashAfterObligationsAndProtectionsMinor),
    requestedRetained,
  );
  const allocatable = Math.max(0, cashAfterObligationsAndProtectionsMinor - retained);
  const effectiveTargetBps =
    input.mode === "CONSERVATIVE"
      ? Math.min(input.targetBps, 3500)
      : input.mode === "AGGRESSIVE"
        ? Math.max(input.targetBps, 7500)
        : input.targetBps;
  const target = Math.floor((allocatable * effectiveTargetBps) / 10000);
  const recommended = Math.max(0, Math.min(allocatable, target));
  const adjustmentBps =
    input.confidence === "HIGH"
      ? 0
      : input.confidence === "LIMITED"
        ? Math.min(10000, input.conservativeAdjustmentBps * 2)
        : input.conservativeAdjustmentBps;
  const confidenceReduction = Math.floor((recommended * adjustmentBps) / 10000);
  const conservative = Math.max(0, recommended - confidenceReduction);
  const safeToSpend = Math.max(0, allocatable - recommended);
  const unallocated = allocatable - recommended - safeToSpend;
  return {
    cashAfterObligationsAndProtectionsMinor,
    retainedSafetyReserveMinor: retained,
    allocatableSurplusMinor: allocatable,
    recommendedMinor: recommended,
    conservativeMinor: conservative,
    safeToSpendMinor: safeToSpend,
    unallocatedSurplusMinor: unallocated,
    policyCapMinor: target,
    effectiveTargetBps,
    conservativeReductionMinor: confidenceReduction,
  };
}
