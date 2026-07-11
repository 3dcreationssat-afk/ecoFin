import { z } from "zod";

export const categorySchema = z.object({
  householdId: z.string().min(1),
  name: z.string().min(1).max(80),
  group: z.string().min(1).max(80),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  budgetMinor: z.number().int().min(0),
  sortOrder: z.number().int().min(0),
});

