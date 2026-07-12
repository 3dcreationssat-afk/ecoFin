import { z } from "zod";

export const scenarioComponentTypes = [
  "RECURRING_EXPENSE",
  "ONE_TIME_EXPENSE",
  "RECURRING_INCOME_CHANGE",
  "ONE_TIME_INCOME",
  "CANCEL_RECURRING",
  "DEBT_EXTRA_PAYMENT",
  "SAVINGS_CHANGE",
  "SAVINGS_POLICY_OVERRIDE",
  "CHECKING_BUFFER_OVERRIDE",
  "VEHICLE_PAYMENT",
] as const;

export const scenarioComponentSchema = z
  .object({
    type: z.enum(scenarioComponentTypes),
    name: z.string().trim().min(1).max(100),
    amountMinor: z.number().int().min(-100_000_000).max(100_000_000).nullable().optional(),
    secondaryAmountMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
    frequency: z.enum(["MONTHLY", "ONE_TIME"]).nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    durationMonths: z.number().int().min(1).max(600).nullable().optional(),
    essentiality: z.enum(["ESSENTIAL", "IMPORTANT", "DISCRETIONARY"]).nullable().optional(),
    linkedAccountId: z.string().nullable().optional(),
    linkedDebtAccountId: z.string().nullable().optional(),
    linkedGoalId: z.string().nullable().optional(),
    linkedRecurringId: z.string().nullable().optional(),
    policyMode: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE", "CUSTOM"]).nullable().optional(),
    targetBasisPoints: z.number().int().min(0).max(10_000).nullable().optional(),
    minimumDiscretionaryReserveMinor: z
      .number()
      .int()
      .min(0)
      .max(100_000_000)
      .nullable()
      .optional(),
    extraSafetyReserveMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
    minimumCashRetainedMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
    insuranceIncreaseMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
    operatingIncreaseMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
    tradeInMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
  })
  .superRefine((value, context) => {
    const requiresAmount = !["CANCEL_RECURRING", "SAVINGS_POLICY_OVERRIDE"].includes(value.type);
    if (requiresAmount && (value.amountMinor == null || value.amountMinor === 0)) {
      context.addIssue({
        code: "custom",
        path: ["amountMinor"],
        message: "A non-zero amount is required.",
      });
    }
    if (
      [
        "RECURRING_EXPENSE",
        "ONE_TIME_EXPENSE",
        "ONE_TIME_INCOME",
        "DEBT_EXTRA_PAYMENT",
        "CHECKING_BUFFER_OVERRIDE",
        "VEHICLE_PAYMENT",
      ].includes(value.type) &&
      (value.amountMinor ?? 0) < 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["amountMinor"],
        message: "Amount cannot be negative.",
      });
    }
    if (value.type === "CANCEL_RECURRING" && !value.linkedRecurringId)
      context.addIssue({
        code: "custom",
        path: ["linkedRecurringId"],
        message: "Select a confirmed recurring item.",
      });
    if (value.type === "DEBT_EXTRA_PAYMENT" && !value.linkedDebtAccountId)
      context.addIssue({
        code: "custom",
        path: ["linkedDebtAccountId"],
        message: "Select a debt account.",
      });
    if (value.type === "SAVINGS_POLICY_OVERRIDE" && !value.policyMode)
      context.addIssue({
        code: "custom",
        path: ["policyMode"],
        message: "Select a savings policy mode.",
      });
    if (value.endDate && value.startDate && value.endDate < value.startDate)
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot precede start date.",
      });
  });

export const createScenarioSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateScenarioSchema = createScenarioSchema.partial().extend({
  action: z.enum(["RENAME", "ARCHIVE", "RESTORE"]).optional(),
});

export type ScenarioComponentInput = z.infer<typeof scenarioComponentSchema>;
