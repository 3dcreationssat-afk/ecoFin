import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

type SeedClient = PrismaClient | Prisma.TransactionClient;

export async function seedDemoData(source = "seed", db?: SeedClient) {
  const client = db ?? new PrismaClient();
  try {
    await client.auditLog.deleteMany();
    await client.backupRecord.deleteMany();
    await client.transactionSavedView.deleteMany();
    await client.recurringExpenseTransaction.deleteMany();
    await client.recurringExpense.deleteMany();
    await client.transferMatch.deleteMany();
    await client.importRow.deleteMany();
    await client.transaction.deleteMany();
    await client.importBatch.deleteMany();
    await client.importProfile.deleteMany();
    await client.goalContribution.deleteMany();
    await client.goal.deleteMany();
    await client.category.deleteMany();
    await client.account.deleteMany();
    await client.household.deleteMany();

    const household = await client.household.create({
      data: {
        name: "Our Household",
        currency: "USD",
        financialMonthStart: 1,
        incomeSchedule: "BI_WEEKLY",
        checkingBufferMinor: 150000,
        emergencyFundTargetMinor: 1500000,
        debtStrategy: "AVALANCHE",
        workspaceMode: "DEMONSTRATION",
      },
    });

    const checking = await client.account.create({
      data: {
        householdId: household.id,
        name: "Everyday Checking",
        institution: "First National Bank",
        type: "CHECKING",
        balanceMinor: 842055,
        availableMinor: 842055,
        notes: "Primary bill-pay account.",
        lastUpdated: new Date("2026-07-09"),
      },
    });
    const savings = await client.account.create({
      data: {
        householdId: household.id,
        name: "High-Yield Savings",
        institution: "First National Bank",
        type: "SAVINGS",
        balanceMinor: 1420000,
        availableMinor: 1420000,
        notes: "Emergency fund and goals.",
        lastUpdated: new Date("2026-07-09"),
      },
    });
    const sapphire = await client.account.create({
      data: {
        householdId: household.id,
        name: "Chase Sapphire",
        institution: "Chase",
        type: "CREDIT",
        balanceMinor: -284730,
        availableMinor: 715270,
        creditLimitMinor: 1000000,
        aprBasisPoints: 2149,
        minimumPaymentMinor: 8500,
        dueDay: 17,
        statementDay: 8,
        lastUpdated: new Date("2026-07-09"),
      },
    });
    await client.account.createMany({
      data: [
        {
          householdId: household.id,
          name: "Capital One Venture",
          institution: "Capital One",
          type: "CREDIT",
          balanceMinor: -120380,
          availableMinor: 879620,
          creditLimitMinor: 1000000,
          aprBasisPoints: 1899,
          minimumPaymentMinor: 4500,
          dueDay: 21,
          statementDay: 12,
          lastUpdated: new Date("2026-07-08"),
        },
        {
          householdId: household.id,
          name: "Auto Loan",
          institution: "Toyota Financial",
          type: "LOAN",
          balanceMinor: -1840000,
          aprBasisPoints: 490,
          minimumPaymentMinor: 38000,
          dueDay: 5,
          statementDay: 28,
          lastUpdated: new Date("2026-06-30"),
        },
        {
          householdId: household.id,
          name: "Mortgage",
          institution: "Quicken Loans",
          type: "MORTGAGE",
          balanceMinor: -24780000,
          aprBasisPoints: 375,
          minimumPaymentMinor: 165000,
          dueDay: 1,
          statementDay: 15,
          lastUpdated: new Date("2026-06-30"),
        },
      ],
    });

    const fixed = await client.category.create({
      data: {
        householdId: household.id,
        name: "Fixed",
        group: "Fixed",
        type: "EXPENSE",
        budgetMinor: 0,
        sortOrder: 1,
      },
    });
    const variable = await client.category.create({
      data: {
        householdId: household.id,
        name: "Essential Variable",
        group: "Essential Variable",
        type: "EXPENSE",
        budgetMinor: 0,
        sortOrder: 2,
      },
    });
    const discretionary = await client.category.create({
      data: {
        householdId: household.id,
        name: "Discretionary",
        group: "Discretionary",
        type: "EXPENSE",
        budgetMinor: 0,
        sortOrder: 3,
      },
    });
    const income = await client.category.create({
      data: {
        householdId: household.id,
        name: "Income",
        group: "Income",
        type: "INCOME",
        budgetMinor: 485000,
        sortOrder: 110,
      },
    });
    const groceries = await client.category.create({
      data: {
        householdId: household.id,
        parentId: variable.id,
        name: "Groceries",
        group: "Essential Variable",
        type: "EXPENSE",
        budgetMinor: 65000,
        sortOrder: 70,
      },
    });
    const dining = await client.category.create({
      data: {
        householdId: household.id,
        parentId: discretionary.id,
        name: "Dining",
        group: "Discretionary",
        type: "EXPENSE",
        budgetMinor: 25000,
        sortOrder: 80,
      },
    });
    const subscriptions = await client.category.create({
      data: {
        householdId: household.id,
        parentId: discretionary.id,
        name: "Subscriptions",
        group: "Discretionary",
        type: "EXPENSE",
        budgetMinor: 9000,
        sortOrder: 100,
      },
    });
    await client.category.createMany({
      data: [
        {
          householdId: household.id,
          parentId: fixed.id,
          name: "Mortgage",
          group: "Fixed",
          type: "EXPENSE",
          budgetMinor: 165000,
          sortOrder: 10,
        },
        {
          householdId: household.id,
          parentId: fixed.id,
          name: "Auto Loan",
          group: "Fixed",
          type: "EXPENSE",
          budgetMinor: 38000,
          sortOrder: 20,
        },
        {
          householdId: household.id,
          parentId: fixed.id,
          name: "Car Insurance",
          group: "Fixed",
          type: "EXPENSE",
          budgetMinor: 18000,
          sortOrder: 30,
        },
        {
          householdId: household.id,
          parentId: fixed.id,
          name: "Phone",
          group: "Fixed",
          type: "EXPENSE",
          budgetMinor: 8500,
          sortOrder: 40,
        },
        {
          householdId: household.id,
          parentId: fixed.id,
          name: "Internet",
          group: "Fixed",
          type: "EXPENSE",
          budgetMinor: 7000,
          sortOrder: 50,
        },
        {
          householdId: household.id,
          parentId: fixed.id,
          name: "Life Insurance",
          group: "Fixed",
          type: "EXPENSE",
          budgetMinor: 4500,
          sortOrder: 60,
        },
        {
          householdId: household.id,
          parentId: variable.id,
          name: "Gas",
          group: "Essential Variable",
          type: "EXPENSE",
          budgetMinor: 18000,
          sortOrder: 90,
        },
      ],
    });

    const emergency = await client.goal.create({
      data: {
        householdId: household.id,
        linkedAccountId: savings.id,
        name: "Emergency Fund",
        targetMinor: 1500000,
        currentMinor: 840000,
        plannedMonthlyMinor: 50000,
        requiredMonthlyMinor: 44000,
        priority: 10,
      },
    });
    const vehicle = await client.goal.create({
      data: {
        householdId: household.id,
        linkedAccountId: savings.id,
        name: "Vehicle Down Payment",
        targetMinor: 1000000,
        currentMinor: 320000,
        plannedMonthlyMinor: 40000,
        requiredMonthlyMinor: 56000,
        priority: 20,
      },
    });
    await client.goal.createMany({
      data: [
        {
          householdId: household.id,
          linkedAccountId: savings.id,
          name: "Vacation",
          targetMinor: 250000,
          currentMinor: 115000,
          plannedMonthlyMinor: 15000,
          requiredMonthlyMinor: 11200,
          priority: 30,
        },
        {
          householdId: household.id,
          linkedAccountId: savings.id,
          name: "Home Repairs",
          targetMinor: 200000,
          currentMinor: 45000,
          plannedMonthlyMinor: 10000,
          requiredMonthlyMinor: 10000,
          priority: 40,
        },
      ],
    });
    await client.goalContribution.createMany({
      data: [
        {
          goalId: emergency.id,
          amountMinor: 840000,
          contributionDate: new Date("2026-07-01"),
          note: "Seeded opening balance",
          source,
        },
        {
          goalId: vehicle.id,
          amountMinor: 320000,
          contributionDate: new Date("2026-07-01"),
          note: "Seeded opening balance",
          source,
        },
      ],
    });

    await client.transaction.createMany({
      data: [
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: groceries.id,
          originalDescription: "WHOLE FOODS MARKET #123",
          originalAmountText: "-87.42",
          originalDateText: "2026-07-09",
          normalizedMerchant: "Whole Foods Market",
          amountMinor: -8742,
          transactionDate: new Date("2026-07-09"),
          postedDate: new Date("2026-07-09"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: dining.id,
          originalDescription: "STARBUCKS STORE #1234",
          originalAmountText: "-6.75",
          originalDateText: "2026-07-09",
          normalizedMerchant: "Starbucks",
          amountMinor: -675,
          transactionDate: new Date("2026-07-09"),
          postedDate: new Date("2026-07-09"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: null,
          originalDescription: "AMAZON.COM*XX123",
          originalAmountText: "-34.99",
          originalDateText: "2026-07-08",
          normalizedMerchant: "Amazon",
          amountMinor: -3499,
          transactionDate: new Date("2026-07-08"),
          postedDate: new Date("2026-07-08"),
          type: "DEBIT",
          reviewStatus: "NEEDS_REVIEW",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: subscriptions.id,
          originalDescription: "NETFLIX.COM MONTHLY",
          originalAmountText: "-17.99",
          originalDateText: "2026-07-08",
          normalizedMerchant: "Netflix",
          amountMinor: -1799,
          transactionDate: new Date("2026-07-08"),
          postedDate: new Date("2026-07-08"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: subscriptions.id,
          originalDescription: "NETFLIX.COM MONTHLY",
          originalAmountText: "-15.99",
          originalDateText: "2026-06-08",
          normalizedMerchant: "Netflix",
          amountMinor: -1599,
          transactionDate: new Date("2026-06-08"),
          postedDate: new Date("2026-06-08"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: subscriptions.id,
          originalDescription: "NETFLIX.COM MONTHLY",
          originalAmountText: "-15.99",
          originalDateText: "2026-05-08",
          normalizedMerchant: "Netflix",
          amountMinor: -1599,
          transactionDate: new Date("2026-05-08"),
          postedDate: new Date("2026-05-08"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: subscriptions.id,
          originalDescription: "SPOTIFY USA",
          originalAmountText: "-10.99",
          originalDateText: "2026-07-03",
          normalizedMerchant: "Spotify",
          amountMinor: -1099,
          transactionDate: new Date("2026-07-03"),
          postedDate: new Date("2026-07-03"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: subscriptions.id,
          originalDescription: "SPOTIFY USA",
          originalAmountText: "-10.99",
          originalDateText: "2026-06-03",
          normalizedMerchant: "Spotify",
          amountMinor: -1099,
          transactionDate: new Date("2026-06-03"),
          postedDate: new Date("2026-06-03"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: subscriptions.id,
          originalDescription: "SPOTIFY USA",
          originalAmountText: "-10.99",
          originalDateText: "2026-05-03",
          normalizedMerchant: "Spotify",
          amountMinor: -1099,
          transactionDate: new Date("2026-05-03"),
          postedDate: new Date("2026-05-03"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: variable.id,
          originalDescription: "CITY WATER UTILITY AUTOPAY",
          originalAmountText: "-62.18",
          originalDateText: "2026-07-01",
          normalizedMerchant: "City Water Utility",
          amountMinor: -6218,
          transactionDate: new Date("2026-07-01"),
          postedDate: new Date("2026-07-01"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: variable.id,
          originalDescription: "CITY WATER UTILITY AUTOPAY",
          originalAmountText: "-58.40",
          originalDateText: "2026-06-01",
          normalizedMerchant: "City Water Utility",
          amountMinor: -5840,
          transactionDate: new Date("2026-06-01"),
          postedDate: new Date("2026-06-01"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: variable.id,
          originalDescription: "CITY WATER UTILITY AUTOPAY",
          originalAmountText: "-64.05",
          originalDateText: "2026-05-01",
          normalizedMerchant: "City Water Utility",
          amountMinor: -6405,
          transactionDate: new Date("2026-05-01"),
          postedDate: new Date("2026-05-01"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: null,
          originalDescription: "TARGET 00012345",
          originalAmountText: "-42.99",
          originalDateText: "2026-07-08",
          normalizedMerchant: "Target",
          amountMinor: -4299,
          transactionDate: new Date("2026-07-08"),
          postedDate: new Date("2026-07-08"),
          type: "DEBIT",
          reviewStatus: "FLAGGED",
          possibleDuplicate: true,
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: null,
          originalDescription: "TARGET 00012345",
          originalAmountText: "-42.99",
          originalDateText: "2026-07-08",
          normalizedMerchant: "Target",
          amountMinor: -4299,
          transactionDate: new Date("2026-07-08"),
          postedDate: new Date("2026-07-08"),
          type: "DEBIT",
          reviewStatus: "FLAGGED",
          possibleDuplicate: true,
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: income.id,
          originalDescription: "PAYROLL DEPOSIT",
          originalAmountText: "3250.00",
          originalDateText: "2026-07-07",
          normalizedMerchant: "Payroll",
          amountMinor: 325000,
          transactionDate: new Date("2026-07-07"),
          postedDate: new Date("2026-07-07"),
          type: "CREDIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: sapphire.id,
          categoryId: dining.id,
          originalDescription: "UBER EATS",
          originalAmountText: "-28.50",
          originalDateText: "2026-07-07",
          normalizedMerchant: "Uber Eats",
          amountMinor: -2850,
          transactionDate: new Date("2026-07-07"),
          postedDate: new Date("2026-07-07"),
          type: "DEBIT",
          reviewStatus: "REVIEWED",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: null,
          originalDescription: "ONLINE TRANSFER TO HIGH-YIELD SAVINGS",
          originalAmountText: "-500.00",
          originalDateText: "2026-07-06",
          normalizedMerchant: "Online Transfer",
          amountMinor: -50000,
          transactionDate: new Date("2026-07-06"),
          postedDate: new Date("2026-07-06"),
          type: "DEBIT",
          reviewStatus: "NEEDS_REVIEW",
        },
        {
          householdId: household.id,
          accountId: savings.id,
          categoryId: null,
          originalDescription: "TRANSFER FROM EVERYDAY CHECKING",
          originalAmountText: "500.00",
          originalDateText: "2026-07-06",
          normalizedMerchant: "Online Transfer",
          amountMinor: 50000,
          transactionDate: new Date("2026-07-06"),
          postedDate: new Date("2026-07-06"),
          type: "CREDIT",
          reviewStatus: "NEEDS_REVIEW",
        },
        {
          householdId: household.id,
          accountId: checking.id,
          categoryId: null,
          originalDescription: "AUTOPAY CHASE SAPPHIRE",
          originalAmountText: "-28.50",
          originalDateText: "2026-07-07",
          normalizedMerchant: "Chase Sapphire Payment",
          amountMinor: -2850,
          transactionDate: new Date("2026-07-07"),
          postedDate: new Date("2026-07-07"),
          type: "DEBIT",
          reviewStatus: "NEEDS_REVIEW",
        },
        {
          householdId: household.id,
          accountId: sapphire.id,
          categoryId: null,
          originalDescription: "PAYMENT RECEIVED THANK YOU",
          originalAmountText: "28.50",
          originalDateText: "2026-07-08",
          normalizedMerchant: "Payment Received",
          amountMinor: 2850,
          transactionDate: new Date("2026-07-08"),
          postedDate: new Date("2026-07-08"),
          type: "CREDIT",
          reviewStatus: "NEEDS_REVIEW",
        },
      ],
    });

    await client.auditLog.create({
      data: {
        householdId: household.id,
        entityType: "Household",
        entityId: household.id,
        action: "seed",
        source,
        field: "demoData",
        newValue: "synthetic",
      },
    });

    return household;
  } finally {
    if (!db) await (client as PrismaClient).$disconnect();
  }
}
