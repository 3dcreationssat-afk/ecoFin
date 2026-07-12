import { describe, expect, it } from "vitest";
import { buildOverviewDashboard } from "./dashboard";

const asOf = new Date("2026-07-12T12:00:00Z");

function baseHousehold(
  overrides: Partial<Parameters<typeof buildOverviewDashboard>[0]["household"]> = {},
) {
  return {
    checkingBufferMinor: 150000,
    debtStrategy: "AVALANCHE",
    accounts: [
      {
        id: "checking",
        name: "Everyday Checking",
        type: "CHECKING",
        ledgerBalanceMinor: 120000,
        lastUpdated: new Date("2026-07-12"),
      },
      {
        id: "card",
        name: "Chase Sapphire",
        type: "CREDIT",
        ledgerBalanceMinor: 420000,
        aprBasisPoints: 2149,
        minimumPaymentMinor: 8500,
        dueDay: 18,
        lastUpdated: new Date("2026-07-12"),
      },
      {
        id: "loan",
        name: "Auto Loan",
        type: "LOAN",
        ledgerBalanceMinor: 900000,
        aprBasisPoints: 650,
        minimumPaymentMinor: 30000,
        dueDay: 20,
        lastUpdated: new Date("2026-07-12"),
      },
    ],
    categories: [
      {
        id: "groceries",
        name: "Groceries",
        group: "Essential",
        type: "EXPENSE",
        budgetMinor: 50000,
        sortOrder: 1,
      },
      {
        id: "dining",
        name: "Dining",
        group: "Discretionary",
        type: "EXPENSE",
        budgetMinor: 10000,
        sortOrder: 2,
      },
    ],
    transactions: [
      {
        id: "grocery-1",
        amountMinor: -52000,
        type: "DEBIT",
        categoryId: "groceries",
        transactionDate: new Date("2026-07-10"),
        reviewStatus: "REVIEWED",
      },
      {
        id: "uncat-1",
        amountMinor: -2500,
        type: "DEBIT",
        categoryId: null,
        transactionDate: new Date("2026-07-11"),
        reviewStatus: "NEEDS_REVIEW",
      },
      {
        id: "transfer",
        amountMinor: -8500,
        type: "TRANSFER_OUT",
        categoryId: null,
        transactionDate: new Date("2026-07-11"),
        reviewStatus: "REVIEWED",
      },
    ],
    goals: [
      {
        id: "emergency",
        name: "Emergency Fund",
        targetMinor: 1000000,
        currentMinor: 500000,
        plannedMonthlyMinor: 10000,
        requiredMonthlyMinor: 20000,
        priority: 1,
        targetDate: new Date("2026-12-31"),
      },
      {
        id: "vacation",
        name: "Vacation",
        targetMinor: 200000,
        currentMinor: 200000,
        plannedMonthlyMinor: 0,
        requiredMonthlyMinor: 0,
        priority: 2,
        targetDate: new Date("2026-09-01"),
      },
    ],
    importBatches: [],
    transferMatches: [],
    recurringExpenses: [],
    ...overrides,
  };
}

describe("buildOverviewDashboard", () => {
  it("orders attention items by severity and action priority", () => {
    const dashboard = buildOverviewDashboard({
      household: baseHousehold({
        transferMatches: [
          {
            id: "match",
            status: "SUGGESTED",
            confidence: "HIGH",
            score: 95,
            incomingTransaction: { account: { type: "CREDIT" } },
          },
        ],
      }),
      asOf,
    });

    expect(dashboard.actionItems.map((item) => item.type).slice(0, 4)).toEqual([
      "checking-buffer-risk",
      "upcoming-payment",
      "credit-card-payment-candidate",
      "uncategorized-transactions",
    ]);
    expect(dashboard.actionItems[0].severity).toBe("Critical");
  });

  it("builds upcoming obligations from account minimums and confirmed recurring expenses", () => {
    const dashboard = buildOverviewDashboard({
      household: baseHousehold({
        recurringExpenses: [
          {
            id: "internet",
            displayName: "Comcast Internet",
            serviceName: "Comcast Internet",
            typicalAmountMinor: 7000,
            monthlyEquivalentMinor: 7000,
            confidence: "HIGH",
            confidenceScore: 100,
            status: "CONFIRMED",
            nextExpectedDate: new Date("2026-07-19"),
            priceChangeAmountMinor: 0,
          },
          {
            id: "card-payment",
            displayName: "Chase Sapphire Payment",
            typicalAmountMinor: 8500,
            monthlyEquivalentMinor: 8500,
            confidence: "HIGH",
            confidenceScore: 100,
            status: "CONFIRMED",
            nextExpectedDate: new Date("2026-07-18"),
            priceChangeAmountMinor: 0,
          },
        ],
      }),
      asOf,
    });

    expect(dashboard.upcomingObligations.map((item) => item.displayName)).toEqual([
      "Chase Sapphire",
      "Comcast Internet",
      "Auto Loan",
    ]);
    expect(
      dashboard.upcomingObligations.find((item) => item.displayName.includes("Payment")),
    ).toBeUndefined();
  });

  it("excludes transfers and represents uncategorized category spending", () => {
    const dashboard = buildOverviewDashboard({ household: baseHousehold(), asOf });

    expect(dashboard.categorySpending.find((row) => row.name === "Groceries")).toMatchObject({
      actualMinor: 52000,
      status: "Over budget",
    });
    expect(dashboard.categorySpending.find((row) => row.name === "Uncategorized")).toMatchObject({
      actualMinor: 2500,
      status: "No budget",
    });
    expect(dashboard.categorySpending.some((row) => row.actualMinor === 8500)).toBe(false);
  });

  it("calculates goal statuses from stored target and contribution values", () => {
    const dashboard = buildOverviewDashboard({
      household: baseHousehold({
        goals: [
          ...baseHousehold().goals,
          {
            id: "missing-date",
            name: "No Date",
            targetMinor: 100000,
            currentMinor: 10000,
            plannedMonthlyMinor: 1000,
            requiredMonthlyMinor: 1000,
            priority: 3,
            targetDate: null,
          },
          {
            id: "missing-plan",
            name: "No Plan",
            targetMinor: 100000,
            currentMinor: 10000,
            plannedMonthlyMinor: 0,
            requiredMonthlyMinor: 1000,
            priority: 4,
            targetDate: new Date("2027-01-01"),
          },
        ],
      }),
      asOf,
    });

    expect(dashboard.goals.map((goal) => [goal.name, goal.status])).toEqual([
      ["Emergency Fund", "Behind"],
      ["Vacation", "Completed"],
      ["No Date", "Missing target date"],
      ["No Plan", "Missing contribution plan"],
    ]);
  });

  it("selects debt recommendation by avalanche or snowball strategy", () => {
    expect(
      buildOverviewDashboard({ household: baseHousehold({ debtStrategy: "AVALANCHE" }), asOf }).debt
        .recommendedDebt?.name,
    ).toBe("Chase Sapphire");
    expect(
      buildOverviewDashboard({ household: baseHousehold({ debtStrategy: "SNOWBALL" }), asOf }).debt
        .recommendedDebt?.name,
    ).toBe("Chase Sapphire");
    expect(
      buildOverviewDashboard({ household: baseHousehold({ debtStrategy: "CUSTOM" }), asOf }).debt
        .recommendedDebt,
    ).toBeNull();
  });
});
