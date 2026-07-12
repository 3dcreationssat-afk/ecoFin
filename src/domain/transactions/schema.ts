import { z } from "zod";

export const transactionUpdateSchema = z.object({
  normalizedMerchant: z.string().min(1).max(160),
  categoryId: z.string().min(1).nullable().optional(),
  type: z.enum([
    "DEBIT",
    "CREDIT",
    "INCOME",
    "EXPENSE",
    "TRANSFER_OUT",
    "TRANSFER_IN",
    "REFUND",
    "FEE",
    "INTEREST",
    "UNKNOWN",
  ]),
  reviewStatus: z.enum(["NEEDS_REVIEW", "REVIEWED", "FLAGGED"]),
  excluded: z.boolean(),
  notes: z.string().max(1000).nullable().optional(),
});
