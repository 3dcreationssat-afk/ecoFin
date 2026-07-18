import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-import-repair.db";
const { canonicalRepairAmount, classifySemantics } = await import("./import-repair");

describe("import semantics repair", () => {
  it("normalizes the economic sign independently from account type", () => {
    expect(canonicalRepairAmount(1250, "DEBITS_POSITIVE")).toBe(-1250);
    expect(canonicalRepairAmount(-1250, "DEBITS_POSITIVE")).toBe(1250);
    expect(canonicalRepairAmount(-1250, "DEBITS_NEGATIVE")).toBe(-1250);
  });

  it("uses reliable source types but flags ambiguous descriptions instead of guessing", () => {
    expect(
      classifySemantics("Ordinary purchase", { "Transaction Type": "Purchase" }, -500),
    ).toEqual({
      type: "DEBIT",
      source: "IMPORT_SOURCE",
      ambiguous: false,
    });
    expect(classifySemantics("Statement credit adjustment", {}, 500)).toEqual({
      type: "UNKNOWN",
      source: "IMPORT_REPAIR_REVIEW",
      ambiguous: true,
    });
    expect(classifySemantics("Account activity", { Type: "Payment" }, 500)).toEqual({
      type: "UNKNOWN",
      source: "IMPORT_REPAIR_REVIEW",
      ambiguous: true,
    });
    expect(classifySemantics("Purchase", { Type: "Purchase" }, 500)).toEqual({
      type: "UNKNOWN",
      source: "IMPORT_REPAIR_REVIEW",
      ambiguous: true,
    });
    expect(classifySemantics("Ordinary merchant", {}, -500)).toEqual({
      type: "DEBIT",
      source: "IMPORT_ECONOMIC_DIRECTION",
      ambiguous: false,
    });
  });

  it("recognizes a positive Apple Card ACH transfer as a debt payment", () => {
    expect(
      classifySemantics(
        "ACH DEPOSIT INTERNET TRANSFER FROM ACCOUNT ENDING IN 0143",
        { Type: "Payment" },
        8915,
        "CREDIT",
      ),
    ).toEqual({
      type: "CREDIT_CARD_PAYMENT",
      source: "IMPORT_ACCOUNT_CONTEXT",
      ambiguous: false,
    });
    expect(
      classifySemantics("ACH DEPOSIT INTERNET TRANSFER FROM ACCOUNT ENDING IN 0143", {}, 8915),
    ).toMatchObject({ type: "CREDIT", ambiguous: false });
  });
});
