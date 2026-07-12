import { z } from "zod";
import { transactionQuerySchema } from "./query";

export const savedViewNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(60, "Name must be 60 characters or fewer.");
export const createSavedViewSchema = z.object({
  name: savedViewNameSchema,
  query: transactionQuerySchema,
});
export const updateSavedViewSchema = z
  .object({
    name: savedViewNameSchema.optional(),
    query: transactionQuerySchema.optional(),
    isDefault: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one change is required.");
