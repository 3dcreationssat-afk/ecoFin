import { z } from "zod";

export const workspaceStateSchema = z.enum(["DEMONSTRATION", "EMPTY", "USER_DATA", "MIXED"]);
export type WorkspaceState = z.infer<typeof workspaceStateSchema>;

export const START_FRESH_CONFIRMATION = "START FRESH";

export const startFreshSchema = z.object({
  confirmation: z.string(),
  simulateFailure: z.boolean().optional(),
});
