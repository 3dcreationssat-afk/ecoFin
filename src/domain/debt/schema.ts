import { z } from "zod";

export const debtPlanSchema = z.object({
  strategy: z.enum(["AVALANCHE", "SNOWBALL", "CUSTOM"]),
  extraPaymentMinor: z.number().int().min(0).max(100_000_000),
  customOrder: z.array(z.string().min(1)).max(100).default([]),
});

export type DebtPlanInput = z.infer<typeof debtPlanSchema>;
