import { z } from "zod";

export const reconciliationSchema = z
  .object({
    reportedBalanceMinor: z.number().int(),
    reportedAvailableMinor: z.number().int().nullable().optional(),
    reportedBalanceAsOf: z.coerce.date(),
    note: z.string().trim().max(500).nullable().optional(),
    createAdjustment: z.boolean().default(false),
    adjustmentReason: z.string().trim().max(300).nullable().optional(),
  })
  .refine((value) => !value.createAdjustment || Boolean(value.adjustmentReason), {
    message: "An adjustment reason is required.",
  });

export type LedgerTransaction = {
  amountMinor: number;
  transactionDate: Date;
  affectsLedger: boolean;
  possibleDuplicate: boolean;
  clearingStatus: string;
};
export type LedgerAdjustment = { amountMinor: number; effectiveDate: Date };
export function isLiabilityAccount(type: string) {
  return ["CREDIT", "LOAN", "MORTGAGE"].includes(type);
}
export function ledgerTransactionEffect(accountType: string, amountMinor: number) {
  return isLiabilityAccount(accountType) ? -amountMinor : amountMinor;
}
export function netWorthContribution(accountType: string, ledgerBalanceMinor: number) {
  return isLiabilityAccount(accountType) ? -ledgerBalanceMinor : ledgerBalanceMinor;
}
export function calculateLedgerBalance(
  accountType: string,
  openingBalanceMinor: number,
  openingBalanceDate: Date,
  transactions: LedgerTransaction[],
  adjustments: LedgerAdjustment[],
) {
  const movement = transactions
    .filter(
      (item) =>
        item.affectsLedger &&
        item.clearingStatus === "CLEARED" &&
        !item.possibleDuplicate &&
        item.transactionDate > openingBalanceDate,
    )
    .reduce((sum, item) => sum + ledgerTransactionEffect(accountType, item.amountMinor), 0);
  const adjustment = adjustments
    .filter((item) => item.effectiveDate >= openingBalanceDate)
    .reduce((sum, item) => sum + item.amountMinor, 0);
  return {
    ledgerBalanceMinor: openingBalanceMinor + movement + adjustment,
    transactionMovementMinor: movement,
    adjustmentMinor: adjustment,
  };
}

export function balanceConfidence(
  input: {
    hasOpening: boolean;
    differenceMinor: number | null;
    lastReportedAt: Date | null;
    duplicates: number;
    unreviewed: number;
  },
  now = new Date(),
) {
  if (!input.hasOpening) return "LIMITED";
  const stale =
    !input.lastReportedAt || now.getTime() - input.lastReportedAt.getTime() > 45 * 86400000;
  if (input.differenceMinor === 0 && !stale && input.duplicates === 0 && input.unreviewed === 0)
    return "HIGH";
  if (!stale && input.duplicates <= 2 && input.unreviewed <= 5) return "MODERATE";
  return "LIMITED";
}
