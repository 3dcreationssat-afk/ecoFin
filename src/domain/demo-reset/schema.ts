import { z } from "zod";

export const demoResetSchema = z.object({
  confirmation: z.string(),
  simulateFailure: z.boolean().optional(),
});

export const DEMO_RESET_CONFIRMATION = "RESET DEMO DATA";
