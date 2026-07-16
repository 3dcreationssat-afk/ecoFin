import { z } from "zod";

export const forecastRuleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  accountId: z.string().min(1).nullable().optional(),
  cadence: z
    .enum([
      "ONE_TIME",
      "WEEKLY",
      "BIWEEKLY",
      "SEMIMONTHLY",
      "MONTHLY",
      "QUARTERLY",
      "SEMIANNUAL",
      "ANNUAL",
      "IRREGULAR",
    ])
    .optional(),
  nextExpectedDate: z.coerce.date().optional(),
  typicalAmountMinor: z.number().int().positive().optional(),
  minAmountMinor: z.number().int().nonnegative().optional(),
  maxAmountMinor: z.number().int().positive().optional(),
  dateToleranceDays: z.number().int().min(0).max(10).optional(),
  amountToleranceBps: z.number().int().min(0).max(10_000).optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export const forecastRuleActionSchema = z.object({
  action: z.enum(["CONFIRM", "IGNORE", "PAUSE", "RESUME", "END", "ARCHIVE"]),
  notes: z.string().max(1000).nullable().optional(),
});

export const forecastOccurrenceActionSchema = z
  .object({
    ruleId: z.string().min(1),
    expectedDate: z.coerce.date(),
    action: z.enum(["SKIP", "CHANGE", "CANCEL", "RESTORE"]),
    overrideDate: z.coerce.date().nullable().optional(),
    overrideAmountMinor: z.number().int().positive().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.action === "CHANGE" &&
      value.overrideDate == null &&
      value.overrideAmountMinor == null
    )
      context.addIssue({
        code: "custom",
        message: "A changed occurrence needs a date or amount override.",
      });
  });
