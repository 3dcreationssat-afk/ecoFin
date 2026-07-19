import { describe, expect, it } from "vitest";
import { interpretProviderTransaction } from "./interpretation";

describe("provider transaction interpretation policy", () => {
  it("automatically applies strong payroll evidence", () => {
    expect(
      interpretProviderTransaction({
        amountMinor: 250000,
        accountType: "CHECKING",
        name: "ACME PAYROLL DIRECT DEP",
        providerCategoryPrimary: "INCOME",
        providerCategoryDetailed: "INCOME_WAGES",
      }),
    ).toMatchObject({
      classification: "PAYROLL_INCOME",
      confidence: "HIGH",
      automaticallyApplied: true,
      reviewRequired: false,
    });
  });

  it("keeps provider-only transfer evidence provisional and non-blocking", () => {
    expect(
      interpretProviderTransaction({
        amountMinor: -50000,
        accountType: "CHECKING",
        name: "Online transfer",
        providerCategoryPrimary: "TRANSFER_OUT",
      }),
    ).toMatchObject({
      classification: "TRANSFER",
      confidence: "MEDIUM",
      automaticallyApplied: false,
      reviewRequired: false,
      affectsIncomeSpendingReports: false,
    });
  });

  it("requires review only for materially ambiguous inflows", () => {
    expect(
      interpretProviderTransaction({
        amountMinor: 12000,
        accountType: "CHECKING",
        name: "ACH credit",
      }),
    ).toMatchObject({ classification: "UNKNOWN", confidence: "LOW", reviewRequired: true });
  });
});
