import { z } from "zod";

export const recurringFrequencySchema = z.enum([
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "EVERY_TWO_MONTHS",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "IRREGULAR_RECURRING",
  "UNKNOWN",
]);

export const recurringStatusSchema = z.enum([
  "SUGGESTED",
  "CONFIRMED",
  "REJECTED",
  "CANCELED",
  "INACTIVE",
  "NEEDS_REVIEW",
]);

export const recurringClassificationSchema = z.enum([
  "ESSENTIAL",
  "USEFUL",
  "OPTIONAL",
  "UNKNOWN",
  "CANCELLATION_CANDIDATE",
]);

export const recurringRecommendationSchema = z.enum([
  "KEEP",
  "REVIEW",
  "RENEGOTIATE",
  "CONSIDER_CANCELING",
  "UNKNOWN",
]);

export const recurringTypeSchema = z.enum([
  "SUBSCRIPTION",
  "RECURRING_BILL",
  "INSURANCE",
  "LOAN_PAYMENT",
  "UTILITY",
  "MEMBERSHIP",
  "SERVICE_CONTRACT",
  "OTHER_RECURRING_EXPENSE",
]);

export const recurringUpdateSchema = z.object({
  displayName: z.string().min(1).max(160).optional(),
  serviceName: z.string().max(160).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  frequency: recurringFrequencySchema.optional(),
  classification: recurringClassificationSchema.optional(),
  recommendation: recurringRecommendationSchema.optional(),
  recurringType: recurringTypeSchema.optional(),
  userNotes: z.string().max(1000).nullable().optional(),
});

export const manualRecurringSchema = z.object({
  householdId: z.string().min(1),
  displayName: z.string().min(1).max(160),
  merchantPattern: z.string().min(1).max(160),
  serviceName: z.string().max(160).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  frequency: recurringFrequencySchema,
  typicalAmountMinor: z.number().int().positive(),
  classification: recurringClassificationSchema,
  recommendation: recurringRecommendationSchema,
  recurringType: recurringTypeSchema.default("OTHER_RECURRING_EXPENSE"),
  nextExpectedDate: z.coerce.date().nullable().optional(),
  userNotes: z.string().max(1000).nullable().optional(),
});

export const recurringActionSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
});

export const cancelRecurringSchema = z.object({
  canceledAt: z.coerce.date().default(() => new Date()),
  canceledNote: z.string().max(1000).nullable().optional(),
  expectedFinalChargeDate: z.coerce.date().nullable().optional(),
  reactivateOnFutureMatch: z.boolean().default(true),
});

export const selectedSavingsSchema = z.object({
  ids: z.array(z.string().min(1)).max(100),
});
