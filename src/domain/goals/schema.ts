import { z } from "zod";

export const goalSchema = z.object({
  householdId: z.string().min(1),
  linkedAccountId: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(120),
  targetMinor: z.number().int().min(1),
  currentMinor: z.number().int().min(0).default(0),
  plannedMonthlyMinor: z.number().int().min(0).default(0),
  requiredMonthlyMinor: z.number().int().min(0).default(0),
  priority: z.number().int().min(1).max(999).default(100),
  targetDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const goalContributionSchema = z.object({
  amountMinor: z
    .number()
    .int()
    .refine((value) => value !== 0, "Contribution cannot be zero."),
  contributionDate: z.coerce.date(),
  source: z.string().min(1).max(120).default("Manual contribution"),
  note: z.string().max(500).nullable().optional(),
});
