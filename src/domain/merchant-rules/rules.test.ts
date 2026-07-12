import { describe, expect, it } from "vitest";
import {
  normalizeRuleText,
  orderRules,
  ruleMatches,
  rulesConflict,
  type MatchableRule,
} from "./rules";

const rule = (overrides: Partial<MatchableRule> = {}): MatchableRule => ({
  id: "one",
  name: "Rule",
  priority: 100,
  active: true,
  matchField: "ORIGINAL_DESCRIPTION",
  matchType: "CONTAINS",
  pattern: "whole foods",
  normalizedMerchant: "Whole Foods",
  categoryId: null,
  transactionType: null,
  markReviewed: false,
  notes: null,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});
describe("merchant rule matching", () => {
  it.each([
    ["EXACT", " WHOLE   FOODS ", true],
    ["CONTAINS", "Card WHOLE FOODS #44", true],
    ["STARTS_WITH", "Whole Foods 44", true],
    ["ENDS_WITH", "Store Whole Foods", true],
  ])("supports %s matching", (matchType, value, expected) =>
    expect(
      ruleMatches(rule({ matchType: matchType as MatchableRule["matchType"] }), {
        originalDescription: value,
        normalizedMerchant: "Other",
      }),
    ).toBe(expected),
  );
  it("normalizes case and whitespace", () => expect(normalizeRuleText("  A   b C ")).toBe("a b c"));
  it("orders priority, specificity, and stable creation time", () => {
    const ordered = orderRules([
      rule({ id: "contains", priority: 10 }),
      rule({ id: "exact", priority: 10, matchType: "EXACT" }),
      rule({ id: "priority", priority: 1 }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["priority", "exact", "contains"]);
  });
  it("detects conflicting outcomes", () =>
    expect(
      rulesConflict([rule({ categoryId: "one" }), rule({ id: "two", categoryId: "different" })]),
    ).toBe(true));
});
