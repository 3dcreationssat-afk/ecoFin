import { describe, expect, it } from "vitest";
import { accountSchema } from "./schema";

const validAccount = {
  householdId: "household-1",
  name: "Synthetic Card",
  institution: "Synthetic Bank",
  type: "CREDIT" as const,
  lastUpdated: "2026-07-12T00:00:00.000Z",
};

describe("account schema", () => {
  it.each([
    ["dueDay", "Payment due day must be between 1 and 31."],
    ["statementDay", "Statement closing day must be between 1 and 31."],
  ] as const)("returns an actionable message for an invalid %s", (field, message) => {
    const result = accountSchema.safeParse({ ...validAccount, [field]: 0 });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]).toMatchObject({ path: [field], message });
  });
});
