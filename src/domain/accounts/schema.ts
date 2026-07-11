import { z } from "zod";

export const accountSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().min(1).max(120),
  institution: z.string().min(1).max(120),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT", "LOAN", "MORTGAGE", "OTHER"]),
  balanceMinor: z.number().int(),
  availableMinor: z.number().int().nullable().optional(),
  creditLimitMinor: z.number().int().nullable().optional(),
  aprBasisPoints: z.number().int().min(0).nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  lastUpdated: z.coerce.date(),
});

