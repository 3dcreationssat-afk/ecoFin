export type FinancialPeriod = { start: Date; end: Date; monthEnd: Date };

function startFor(year: number, month: number, configuredDay: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(configuredDay, lastDay)));
}

export function financialPeriod(asOf: Date, configuredDay: number): FinancialPeriod {
  const day = Math.min(31, Math.max(1, configuredDay));
  const thisMonth = startFor(asOf.getUTCFullYear(), asOf.getUTCMonth(), day);
  const start =
    asOf >= thisMonth ? thisMonth : startFor(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, day);
  const end = startFor(start.getUTCFullYear(), start.getUTCMonth() + 1, day);
  return { start, end, monthEnd: new Date(end.getTime() - 1) };
}

export function dueDateInPeriod(dueDay: number, period: FinancialPeriod) {
  const candidates = [
    startFor(period.start.getUTCFullYear(), period.start.getUTCMonth(), dueDay),
    startFor(period.end.getUTCFullYear(), period.end.getUTCMonth(), dueDay),
  ];
  return candidates.find((date) => date >= period.start && date < period.end) ?? null;
}
