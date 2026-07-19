import { describe, expect, it } from "vitest";
import { bestAccountMatch, mapPlaidType, scoreAccountMatch } from "./account-matching";

describe("Plaid account matching", () => {
  it("proposes a unique institution, type, and name match", () => {
    const match = bestAccountMatch(
      {
        displayName: "Everyday Checking",
        institutionName: "Example Bank",
        type: "depository",
        subtype: "checking",
      },
      [{ id: "a", name: "Everyday Checking", institution: "Example Bank", type: "CHECKING" }],
    );
    expect(match).toMatchObject({ score: 95, confidence: "HIGH", account: { id: "a" } });
  });

  it("does not propose ambiguous or type-conflicting matches", () => {
    expect(
      scoreAccountMatch(
        { displayName: "Card", institutionName: "Example", type: "credit" },
        { id: "a", name: "Card", institution: "Example", type: "CHECKING" },
      ).score,
    ).toBe(0);
    expect(
      bestAccountMatch(
        { displayName: "Checking", institutionName: "Example", type: "depository" },
        [
          { id: "a", name: "Checking", institution: "Example", type: "CHECKING" },
          { id: "b", name: "Checking", institution: "Example", type: "CHECKING" },
        ],
      ),
    ).toBeNull();
  });

  it("maps provider account types to the local ledger convention", () => {
    expect(mapPlaidType("depository", "savings")).toBe("SAVINGS");
    expect(mapPlaidType("credit", "credit card")).toBe("CREDIT");
    expect(mapPlaidType("loan", "mortgage")).toBe("MORTGAGE");
  });
});
