import { z } from "zod";

export const allowedDelimiters = [",", ";", "\t"] as const;
export const allowedEncodings = ["UTF-8", "UTF-8-BOM"] as const;
export const amountModes = ["SIGNED_AMOUNT", "DEBIT_CREDIT_COLUMNS"] as const;
export const signConventions = ["DEBITS_NEGATIVE", "DEBITS_POSITIVE"] as const;
export const dateFormats = [
  "MM/DD/YYYY",
  "M/D/YYYY",
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "D/M/YYYY",
  "MM/DD/YY",
  "DD/MM/YY",
] as const;

export const importProfileBaseSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().min(1).max(80),
  institutionName: z.string().max(80).nullable().optional(),
  accountType: z.string().max(40).nullable().optional(),
  delimiter: z.enum(allowedDelimiters),
  encoding: z.enum(allowedEncodings),
  hasHeader: z.boolean(),
  dateColumn: z.string().min(1).max(80),
  postedDateColumn: z.string().max(80).nullable().optional(),
  descriptionColumn: z.string().min(1).max(80),
  merchantColumn: z.string().max(80).nullable().optional(),
  amountMode: z.enum(amountModes),
  amountColumn: z.string().max(80).nullable().optional(),
  debitColumn: z.string().max(80).nullable().optional(),
  creditColumn: z.string().max(80).nullable().optional(),
  dateFormat: z.enum(dateFormats),
  decimalSeparator: z.enum([".", ","]),
  thousandsSeparator: z.enum([",", ".", " ", ""]),
  signConvention: z.enum(signConventions),
  currency: z.string().min(3).max(3).default("USD"),
});

export const importProfileSchema = importProfileBaseSchema
  .superRefine((data, ctx) => {
    if (data.amountMode === "SIGNED_AMOUNT" && !data.amountColumn) {
      ctx.addIssue({ code: "custom", path: ["amountColumn"], message: "Amount column required." });
    }
    if (data.amountMode === "DEBIT_CREDIT_COLUMNS" && (!data.debitColumn || !data.creditColumn)) {
      ctx.addIssue({
        code: "custom",
        path: ["debitColumn"],
        message: "Debit and credit columns required.",
      });
    }
  });

export const importProfileUpdateSchema = importProfileBaseSchema
  .partial({ householdId: true })
  .superRefine((data, ctx) => {
    if (data.amountMode === "SIGNED_AMOUNT" && !data.amountColumn) {
      ctx.addIssue({ code: "custom", path: ["amountColumn"], message: "Amount column required." });
    }
    if (data.amountMode === "DEBIT_CREDIT_COLUMNS" && (!data.debitColumn || !data.creditColumn)) {
      ctx.addIssue({
        code: "custom",
        path: ["debitColumn"],
        message: "Debit and credit columns required.",
      });
    }
  });

export const previewImportSchema = z.object({
  accountId: z.string().min(1),
  filename: z.string().min(1).max(180),
  fileSize: z.number().int().positive(),
  content: z.string().min(1),
  delimiter: z.enum(allowedDelimiters).optional(),
  encoding: z.enum(allowedEncodings).optional(),
  hasHeader: z.boolean().default(true),
  profileId: z.string().min(1).nullable().optional(),
});

export const validateImportSchema = previewImportSchema.extend({
  batchId: z.string().min(1).optional(),
  mapping: importProfileBaseSchema.omit({ householdId: true, name: true }).extend({
    name: z.string().min(1).max(80).optional(),
    saveProfile: z.boolean().default(false),
  }),
});

export const confirmImportSchema = z.object({
  batchId: z.string().min(1),
  decisions: z.array(
    z.object({
      rowId: z.string().min(1),
      decision: z.enum(["IMPORT", "SKIP", "REVIEW"]),
    }),
  ),
  allowRepeatedFile: z.boolean().default(false),
  confirm: z.literal("IMPORT CSV"),
});

export const undoImportSchema = z.object({
  confirm: z.literal("UNDO IMPORT"),
});
