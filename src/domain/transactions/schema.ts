import { z } from "zod";

const transactionTypes = [
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
  "CREDIT_CARD_PAYMENT",
  "OTHER",
] as const;

export const transactionUpdateSchema = z.object({
  normalizedMerchant: z.string().min(1).max(160),
  categoryId: z.string().min(1).nullable().optional(),
  type: z.enum(transactionTypes),
  reviewStatus: z.enum(["NEEDS_REVIEW", "REVIEWED", "FLAGGED"]),
  excluded: z.boolean(),
  notes: z.string().max(1000).nullable().optional(),
});

export const manualTransactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable().optional(),
  description: z.string().trim().min(1).max(500),
  merchant: z.string().trim().min(1).max(160),
  amount: z.string().trim().min(1).max(40),
  direction: z.enum(["MONEY_OUT", "MONEY_IN"]),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid transaction date."),
  type: z.enum(transactionTypes),
  notes: z.string().trim().max(1000).nullable().optional(),
});
