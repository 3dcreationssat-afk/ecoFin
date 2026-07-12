import { z } from "zod";

export const transactionTypes = [
  "INCOME",
  "EXPENSE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "CREDIT_CARD_PAYMENT",
  "REFUND",
  "FEE",
  "INTEREST",
  "OTHER",
  "DEBIT",
  "CREDIT",
  "UNKNOWN",
] as const;
export const transactionPeriods = [
  "CURRENT_MONTH",
  "PREVIOUS_MONTH",
  "THIS_QUARTER",
  "PREVIOUS_QUARTER",
  "THIS_YEAR",
  "PREVIOUS_YEAR",
  "CUSTOM",
  "ALL",
] as const;

const enumOrDefault = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.enum(values).catch(fallback);
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);

export const transactionQuerySchema = z.object({
  q: z.string().trim().max(120).catch(""),
  account: z.string().max(100).catch(""),
  category: z.string().max(100).catch(""),
  status: optionalEnum(["NEEDS_REVIEW", "REVIEWED", "FLAGGED"]),
  source: optionalEnum(["MANUAL", "CSV_IMPORT", "BANK_CONNECTION"]),
  type: optionalEnum(transactionTypes),
  period: enumOrDefault(transactionPeriods, "ALL"),
  from: z.string().date().optional().catch(undefined),
  to: z.string().date().optional().catch(undefined),
  amountMin: z.coerce.number().int().safe().optional().catch(undefined),
  amountMax: z.coerce.number().int().safe().optional().catch(undefined),
  excluded: enumOrDefault(["all", "included", "excluded"], "all"),
  transfer: enumOrDefault(["all", "confirmed", "suggested", "unmatched", "none"], "all"),
  recurring: enumOrDefault(["all", "confirmed", "suggested", "none"], "all"),
  sort: enumOrDefault(
    ["date", "amount", "merchant", "account", "category", "status", "source"],
    "date",
  ),
  direction: enumOrDefault(["asc", "desc"], "desc"),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]))
    .catch(25),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type RawTransactionQuery = Record<string, string | string[] | undefined>;

export const transactionQueryDefaults: TransactionQuery = transactionQuerySchema.parse({});
export const transactionStateKeys = new Set(Object.keys(transactionQueryDefaults));

export function parseTransactionQuery(
  input: RawTransactionQuery | URLSearchParams,
): TransactionQuery {
  const raw =
    input instanceof URLSearchParams
      ? Object.fromEntries([...input.entries()].filter(([key]) => transactionStateKeys.has(key)))
      : Object.fromEntries(
          Object.entries(input).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
          ]),
        );
  const parsed = transactionQuerySchema.parse(raw);
  if (parsed.period !== "CUSTOM") return { ...parsed, from: undefined, to: undefined };
  if (parsed.from && parsed.to && parsed.from > parsed.to)
    return { ...parsed, from: undefined, to: undefined };
  return parsed;
}

export function serializeTransactionQuery(query: TransactionQuery): URLSearchParams {
  const parsed = transactionQuerySchema.parse(query);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) {
    if (
      value === undefined ||
      value === "" ||
      value === transactionQueryDefaults[key as keyof TransactionQuery]
    )
      continue;
    params.set(key, String(value));
  }
  return params;
}

export function withTransactionQueryChange(
  query: TransactionQuery,
  change: Partial<TransactionQuery>,
  paginationOnly = false,
) {
  return transactionQuerySchema.parse({
    ...query,
    ...change,
    page: paginationOnly ? (change.page ?? query.page) : 1,
  });
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}
function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function financialPeriodBounds(
  period: TransactionQuery["period"],
  financialMonthStart: number,
  now = new Date(),
) {
  if (period === "ALL") return {};
  const day = Math.min(28, Math.max(1, financialMonthStart));
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const currentStart = now.getUTCDate() >= day ? utcDate(y, m, day) : utcDate(y, m - 1, day);
  let from: Date;
  let to: Date;
  if (period === "CURRENT_MONTH" || period === "PREVIOUS_MONTH") {
    const offset = period === "PREVIOUS_MONTH" ? -1 : 0;
    from = utcDate(currentStart.getUTCFullYear(), currentStart.getUTCMonth() + offset, day);
    to = utcDate(from.getUTCFullYear(), from.getUTCMonth() + 1, day - 1);
  } else if (period === "THIS_QUARTER" || period === "PREVIOUS_QUARTER") {
    const fiscalMonth = (currentStart.getUTCMonth() - (day === 1 ? 0 : 1) + 12) % 12;
    const quarterOffset = fiscalMonth % 3;
    from = utcDate(
      currentStart.getUTCFullYear(),
      currentStart.getUTCMonth() - quarterOffset + (period === "PREVIOUS_QUARTER" ? -3 : 0),
      day,
    );
    to = utcDate(from.getUTCFullYear(), from.getUTCMonth() + 3, day - 1);
  } else {
    const startYear = now.getUTCMonth() > 0 || now.getUTCDate() >= day ? y : y - 1;
    from = utcDate(startYear + (period === "PREVIOUS_YEAR" ? -1 : 0), 0, day);
    to = utcDate(from.getUTCFullYear() + 1, 0, day - 1);
  }
  return { from: dateOnly(from), to: dateOnly(to) };
}

export function hasExplicitTransactionState(input: RawTransactionQuery) {
  return Object.keys(input).some((key) => transactionStateKeys.has(key));
}
