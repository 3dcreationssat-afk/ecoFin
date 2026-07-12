import { z } from "zod";

export const emergencyFundConfigurationSchema = z
  .object({
    enabled: z.boolean(),
    targetAmountMinor: z.number().int().min(0).nullable(),
    targetRunwayMonths: z.number().int().min(1).max(24),
    accounts: z
      .array(
        z.object({
          accountId: z.string().min(1),
          includedAmountMode: z.enum(["ENTIRE_BALANCE", "FIXED_AMOUNT"]),
          fixedProtectedAmountMinor: z.number().int().min(0).nullable(),
        }),
      )
      .max(20),
  })
  .superRefine((value, context) => {
    if (value.enabled && !value.accounts.length)
      context.addIssue({
        code: "custom",
        path: ["accounts"],
        message: "Select at least one emergency-fund account.",
      });
    if (new Set(value.accounts.map((item) => item.accountId)).size !== value.accounts.length)
      context.addIssue({
        code: "custom",
        path: ["accounts"],
        message: "An account cannot be linked more than once.",
      });
    value.accounts.forEach((account, index) => {
      if (
        account.includedAmountMode === "FIXED_AMOUNT" &&
        account.fixedProtectedAmountMinor == null
      )
        context.addIssue({
          code: "custom",
          path: ["accounts", index, "fixedProtectedAmountMinor"],
          message: "Enter a fixed protected amount.",
        });
    });
  });

export const goalPurposes = [
  "GENERAL",
  "EMERGENCY_FUND",
  "SINKING_FUND",
  "PURCHASE",
  "DEBT_PAYOFF",
  "OTHER",
] as const;
