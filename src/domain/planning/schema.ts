import { z } from "zod";

export const frequencySchema = z.enum([
  "ONE_TIME",
  "WEEKLY",
  "BIWEEKLY",
  "TWICE_MONTHLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
]);
const expectedIncomeBase = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().positive(),
  frequency: frequencySchema,
  nextExpectedDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  twiceMonthlyDay1: z.number().int().min(1).max(31).nullable().optional(),
  twiceMonthlyDay2: z.number().int().min(1).max(31).nullable().optional(),
  accountId: z.string().nullable().optional(),
  recurringExpenseId: z.string().nullable().optional(),
  sourceType: z
    .enum(["USER_ENTERED", "CONFIRMED_RECURRING", "IMPORT_DERIVED_CONFIRMED", "DEMO"])
    .default("USER_ENTERED"),
  confidence: z.enum(["HIGH", "MODERATE", "LIMITED"]).default("HIGH"),
  active: z.boolean().default(true),
  notes: z.string().trim().max(500).nullable().optional(),
});
export const expectedIncomeSchema = expectedIncomeBase.refine(
  (v) =>
    v.frequency !== "TWICE_MONTHLY" ||
    (v.twiceMonthlyDay1 && v.twiceMonthlyDay2 && v.twiceMonthlyDay1 < v.twiceMonthlyDay2),
  { message: "Twice-monthly schedules require two ordered days." },
);
export const expectedIncomeUpdateSchema = expectedIncomeBase.partial({ householdId: true });
export const obligationSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().positive(),
  dueDate: z.coerce.date(),
  frequency: frequencySchema,
  accountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  obligationType: z.enum([
    "HOUSING",
    "UTILITY",
    "INSURANCE",
    "DEBT_MINIMUM",
    "SUBSCRIPTION",
    "CHILDCARE",
    "TAX",
    "MEDICAL",
    "GOAL_CONTRIBUTION",
    "SINKING_FUND",
    "OTHER",
  ]),
  sourceType: z
    .enum(["USER_ENTERED", "CONFIRMED_RECURRING", "DEBT_TERMS", "GOAL_PLAN", "DEMO"])
    .default("USER_ENTERED"),
  recurringExpenseId: z.string().nullable().optional(),
  debtAccountId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  essentiality: z.enum(["ESSENTIAL", "IMPORTANT", "DISCRETIONARY"]).default("ESSENTIAL"),
  confidence: z.enum(["HIGH", "MODERATE", "LIMITED"]).default("HIGH"),
  active: z.boolean().default(true),
  notes: z.string().trim().max(500).nullable().optional(),
});
export const occurrenceActionSchema = z.object({
  action: z.enum(["PAID", "RECEIVED", "SKIPPED", "PARTIALLY_PAID", "REJECT_MATCH"]),
  transactionId: z.string().nullable().optional(),
  satisfiedDate: z.coerce.date().optional(),
  amountMinor: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export const savingsPolicySchema = z.object({
  savingsRecommendationMode: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE", "CUSTOM"]),
  savingsTargetBps: z.number().int().min(0).max(10000),
  minimumDiscretionaryReserveMinor: z.number().int().nonnegative(),
  extraSafetyReserveMinor: z.number().int().nonnegative(),
  minimumCashRetainedMinor: z.number().int().nonnegative(),
  includeGoalContributionsInSafeToSave: z.boolean(),
  emergencyShortfallIncreasesRecommendation: z.boolean(),
  conservativeConfidenceAdjustmentBps: z.number().int().min(0).max(10000),
});
