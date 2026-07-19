import { z } from "zod";

export const matchFields = ["ORIGINAL_DESCRIPTION", "NORMALIZED_MERCHANT", "EITHER"] as const;
export const matchTypes = ["EXACT", "CONTAINS", "STARTS_WITH", "ENDS_WITH"] as const;
export const ruleTransactionTypes = [
  "DEBIT",
  "CREDIT",
  "INCOME",
  "EXPENSE",
  "REFUND",
  "FEE",
  "INTEREST",
  "UNKNOWN",
  "OTHER",
] as const;
export const fieldSources = [
  "IMPORT_DEFAULT",
  "MERCHANT_RULE",
  "USER",
  "TRANSFER",
  "RECURRING",
  "SEED",
  "BULK_USER",
] as const;

const merchantRuleObjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  priority: z.coerce.number().int().min(1).max(10000),
  active: z.boolean().default(true),
  matchField: z.enum(matchFields),
  matchType: z.enum(matchTypes),
  pattern: z.string().trim().min(1).max(160),
  normalizedMerchant: z.string().trim().min(1).max(160).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  transactionType: z.enum(ruleTransactionTypes).nullable().optional(),
  markReviewed: z.boolean().default(false),
  notes: z.string().trim().max(500).nullable().optional(),
});
export const merchantRuleSchema = merchantRuleObjectSchema.refine(
  (value) =>
    value.normalizedMerchant || value.categoryId || value.transactionType || value.markReviewed,
  { message: "Choose at least one rule result." },
);
export const merchantRuleUpdateSchema = merchantRuleObjectSchema.partial();
export const rulePreviewSchema = merchantRuleObjectSchema.extend({ id: z.string().optional() });

export const bulkActionSchema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum([
    "ASSIGN_CATEGORY",
    "MARK_REVIEWED",
    "MARK_NEEDS_REVIEW",
    "EXCLUDE",
    "RESTORE",
    "SET_TYPE",
    "NORMALIZE_MERCHANT",
    "REAPPLY_RULES",
    "APPLY_REVIEW_RECOMMENDATIONS",
  ]),
  value: z.string().trim().max(160).optional(),
  confirmation: z.string().optional(),
});

export type MerchantRuleInput = z.infer<typeof merchantRuleSchema>;
export type MatchableRule = MerchantRuleInput & { id: string; createdAt: Date };
export type MatchableTransaction = { originalDescription: string; normalizedMerchant: string };

export function normalizeRuleText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function ruleMatches(
  rule: Pick<MatchableRule, "matchField" | "matchType" | "pattern">,
  transaction: MatchableTransaction,
) {
  const pattern = normalizeRuleText(rule.pattern);
  const values =
    rule.matchField === "ORIGINAL_DESCRIPTION"
      ? [transaction.originalDescription]
      : rule.matchField === "NORMALIZED_MERCHANT"
        ? [transaction.normalizedMerchant]
        : [transaction.originalDescription, transaction.normalizedMerchant];
  return values
    .map(normalizeRuleText)
    .some((value) =>
      rule.matchType === "EXACT"
        ? value === pattern
        : rule.matchType === "STARTS_WITH"
          ? value.startsWith(pattern)
          : rule.matchType === "ENDS_WITH"
            ? value.endsWith(pattern)
            : value.includes(pattern),
    );
}
const specificity = { EXACT: 4, STARTS_WITH: 3, ENDS_WITH: 3, CONTAINS: 2 } as const;
export function orderRules<
  T extends Pick<MatchableRule, "priority" | "matchType" | "createdAt" | "id">,
>(rules: T[]) {
  return [...rules].sort(
    (a, b) =>
      a.priority - b.priority ||
      specificity[b.matchType] - specificity[a.matchType] ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}
export function matchingRules<T extends MatchableRule>(
  rules: T[],
  transaction: MatchableTransaction,
) {
  return orderRules(rules.filter((rule) => rule.active && ruleMatches(rule, transaction)));
}
export function rulesConflict(rules: MatchableRule[]) {
  if (rules.length < 2) return false;
  const first = rules[0];
  return rules
    .slice(1)
    .some(
      (rule) =>
        (first.categoryId && rule.categoryId && first.categoryId !== rule.categoryId) ||
        (first.normalizedMerchant &&
          rule.normalizedMerchant &&
          first.normalizedMerchant !== rule.normalizedMerchant) ||
        (first.transactionType &&
          rule.transactionType &&
          first.transactionType !== rule.transactionType),
    );
}
export function isManualSource(source: string) {
  return (
    source === "USER" || source === "BULK_USER" || source === "TRANSFER" || source === "RECURRING"
  );
}
