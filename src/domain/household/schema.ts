import { z } from "zod";

export const householdSettingsSchema = z.object({
  name: z.string().min(1).max(80),
  currency: z.literal("USD"),
  financialMonthStart: z.number().int().min(1).max(28),
  incomeSchedule: z.enum(["WEEKLY", "BI_WEEKLY", "SEMI_MONTHLY", "MONTHLY"]),
  checkingBufferMinor: z.number().int().min(0),
  emergencyFundTargetMinor: z.number().int().min(0),
  debtStrategy: z.enum(["AVALANCHE", "SNOWBALL", "CUSTOM"]),
});
