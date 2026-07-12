import { z } from "zod";

export const accountSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().min(1).max(120),
  institution: z.string().min(1).max(120),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT", "LOAN", "MORTGAGE", "OTHER"]),
  openingBalanceMinor: z.number().int().nullable().optional(),
  openingBalanceDate: z.coerce.date().nullable().optional(),
  openingBalanceSource: z
    .enum(["USER_OPENING_BALANCE", "RECONCILIATION_ANCHOR", "START_ZERO", "DEMO_SEED"])
    .nullable()
    .optional(),
  reportedBalanceMinor: z.number().int().nullable().optional(),
  reportedAvailableMinor: z.number().int().nullable().optional(),
  reportedBalanceAsOf: z.coerce.date().nullable().optional(),
  creditLimitMinor: z.number().int().nullable().optional(),
  aprBasisPoints: z.number().int().min(0).nullable().optional(),
  minimumPaymentMinor: z.number().int().min(0).nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  lastUpdated: z.coerce.date(),
});
