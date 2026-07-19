import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { seedDefaultCategories } from "./default-categories";

type SeedClient = PrismaClient | Prisma.TransactionClient;

export async function seedDemoData(source = "seed", db?: SeedClient) {
  const client = db ?? new PrismaClient();
  try {
    const identities = await client.workspaceMetadata.findMany({ take: 2 });
    if (identities.length > 1) {
      throw new Error("Refusing demo seed: database has multiple workspace identities.");
    }
    if (identities[0]?.workspaceType === "REAL") {
      throw new Error("Refusing demo seed against a REAL workspace.");
    }
    if (!identities.length && (await client.household.count()) > 0) {
      throw new Error("Refusing demo seed against an existing unidentified workspace.");
    }
    if (!identities.length) {
      await client.workspaceMetadata.create({
        data: {
          id: randomUUID(),
          workspaceType: "DEMO",
          databaseCreationSource: source === "reset" ? "DEMO_RESET" : "DEMO_SEED",
          workspaceName: "Demonstration workspace",
        },
      });
    }
    await client.auditLog.deleteMany();
    await client.backupRecord.deleteMany();
    await client.decisionScenario.deleteMany();
    await client.debtPlan.deleteMany();
    await client.transactionSavedView.deleteMany();
    await client.merchantRule.deleteMany();
    await client.reconciliationAdjustment.deleteMany();
    await client.forecastOccurrence.deleteMany();
    await client.forecastRule.deleteMany();
    await client.expectedIncomeOccurrence.deleteMany();
    await client.obligationOccurrence.deleteMany();
    await client.expectedIncomeSchedule.deleteMany();
    await client.scheduledObligation.deleteMany();
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
        savingsRecommendationMode: "BALANCED",
        savingsTargetBps: 5000,
        minimumDiscretionaryReserveMinor: 125000,
        extraSafetyReserveMinor: 50000,
        minimumCashRetainedMinor: 300000,
        conservativeConfidenceAdjustmentBps: 2000,
        workspaceMode: "DEMONSTRATION",
      },
    });

    const checking = await client.account.create({
      data: {
        householdId: household.id,
        name: "Everyday Checking",
        institution: "First National Bank",
        type: "CHECKING",
        reportedBalanceMinor: 842055,
        reportedAvailableMinor: 842055,
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
        reportedBalanceMinor: 1420000,
        reportedAvailableMinor: 1420000,
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
        reportedBalanceMinor: 284730,
        reportedAvailableMinor: 715270,
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
          reportedBalanceMinor: 120380,
          reportedAvailableMinor: 879620,
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
          reportedBalanceMinor: 1840000,
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
          reportedBalanceMinor: 24780000,
          aprBasisPoints: 375,
          minimumPaymentMinor: 165000,
          dueDay: 1,
          statementDay: 15,
          lastUpdated: new Date("2026-06-30"),
        },
      ],
    });
    await client.debtPlan.create({
      data: {
        householdId: household.id,
        strategy: "AVALANCHE",
        extraPaymentMinor: 25000,
      },
    });

    const defaultCategories = await seedDefaultCategories(client, household.id, { isDemo: true });
    const variable = defaultCategories.ESSENTIAL_VARIABLE;
    const income = defaultCategories.INCOME;
    const groceries = defaultCategories.GROCERIES;
    const dining = defaultCategories.DINING;
    const subscriptions = defaultCategories.SUBSCRIPTIONS;

    const emergency = await client.goal.create({
      data: {
        householdId: household.id,
        linkedAccountId: savings.id,
        name: "Emergency Fund",
        purpose: "EMERGENCY_FUND",
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
    await client.emergencyFundConfiguration.create({
      data: {
        householdId: household.id,
        enabled: true,
        targetAmountMinor: 1500000,
        targetRunwayMonths: 3,
        accounts: {
          create: {
            accountId: savings.id,
            includedAmountMode: "FIXED_AMOUNT",
            fixedProtectedAmountMinor: 840000,
          },
        },
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

    const payrollRecurring = await client.recurringExpense.create({
      data: {
        householdId: household.id,
        merchantKey: "northstar payroll",
        displayName: "Northstar Payroll",
        frequency: "BIWEEKLY",
        typicalAmountMinor: 242500,
        minAmountMinor: 242500,
        maxAmountMinor: 242500,
        averageAmountMinor: 242500,
        medianAmountMinor: 242500,
        monthlyEquivalentMinor: 525417,
        annualEquivalentMinor: 6305000,
        amountVariabilityBps: 0,
        confidence: "HIGH",
        confidenceScore: 100,
        status: "CONFIRMED",
        classification: "ESSENTIAL",
        recommendation: "KEEP",
        recurringType: "INCOME",
        firstObservedDate: new Date("2026-06-19"),
        lastObservedDate: new Date("2026-07-03"),
        nextExpectedDate: new Date("2026-07-17"),
        reasonsJson: '["User-confirmed synthetic payroll"]',
        detectionHash: "demo-payroll",
        userConfirmed: true,
      },
    });
    const utilityRecurring = await client.recurringExpense.create({
      data: {
        householdId: household.id,
        merchantKey: "city electric",
        displayName: "City Electric",
        frequency: "MONTHLY",
        typicalAmountMinor: 14200,
        minAmountMinor: 12800,
        maxAmountMinor: 14800,
        averageAmountMinor: 13900,
        medianAmountMinor: 14200,
        monthlyEquivalentMinor: 14200,
        annualEquivalentMinor: 170400,
        amountVariabilityBps: 700,
        confidence: "HIGH",
        confidenceScore: 94,
        status: "CONFIRMED",
        classification: "ESSENTIAL",
        recommendation: "KEEP",
        recurringType: "EXPENSE",
        firstObservedDate: new Date("2026-05-18"),
        lastObservedDate: new Date("2026-06-18"),
        nextExpectedDate: new Date("2026-07-18"),
        reasonsJson: '["User-confirmed synthetic utility"]',
        detectionHash: "demo-electric",
        userConfirmed: true,
      },
    });
    const streamingRecurring = await client.recurringExpense.create({
      data: {
        householdId: household.id,
        merchantKey: "streaming subscription",
        displayName: "Streaming subscription",
        frequency: "MONTHLY",
        typicalAmountMinor: 1599,
        minAmountMinor: 1599,
        maxAmountMinor: 1599,
        averageAmountMinor: 1599,
        medianAmountMinor: 1599,
        monthlyEquivalentMinor: 1599,
        annualEquivalentMinor: 19188,
        amountVariabilityBps: 0,
        confidence: "HIGH",
        confidenceScore: 100,
        status: "CONFIRMED",
        classification: "DISCRETIONARY",
        recommendation: "REVIEW",
        recurringType: "SUBSCRIPTION",
        firstObservedDate: new Date("2026-05-19"),
        lastObservedDate: new Date("2026-06-19"),
        nextExpectedDate: new Date("2026-07-19"),
        reasonsJson: '["User-confirmed synthetic subscription"]',
        detectionHash: "demo-streaming",
        userConfirmed: true,
      },
    });
    await client.expectedIncomeSchedule.createMany({
      data: [
        {
          householdId: household.id,
          name: "Northstar biweekly payroll",
          amountMinor: 242500,
          frequency: "BIWEEKLY",
          nextExpectedDate: new Date("2026-07-17"),
          accountId: checking.id,
          recurringExpenseId: payrollRecurring.id,
          sourceType: "CONFIRMED_RECURRING",
          confidence: "HIGH",
          isDemo: true,
        },
        {
          householdId: household.id,
          name: "Synthetic performance bonus",
          amountMinor: 45000,
          frequency: "ONE_TIME",
          nextExpectedDate: new Date("2026-07-29"),
          accountId: checking.id,
          sourceType: "DEMO",
          confidence: "MODERATE",
          isDemo: true,
        },
      ],
    });
    const mortgageAccount = await client.account.findFirstOrThrow({
      where: { householdId: household.id, type: "MORTGAGE" },
    });
    const mortgageObligation = await client.scheduledObligation.create({
      data: {
        householdId: household.id,
        name: "Mortgage",
        amountMinor: 165000,
        dueDate: new Date("2026-07-01"),
        frequency: "MONTHLY",
        accountId: checking.id,
        debtAccountId: mortgageAccount.id,
        obligationType: "HOUSING",
        sourceType: "DEMO",
        essentiality: "ESSENTIAL",
        confidence: "HIGH",
        isDemo: true,
      },
    });
    await client.obligationOccurrence.create({
      data: {
        householdId: household.id,
        obligationId: mortgageObligation.id,
        expectedDate: new Date("2026-07-01"),
        expectedAmountMinor: 165000,
        status: "PAID",
        satisfiedDate: new Date("2026-07-01"),
      },
    });
    await client.scheduledObligation.createMany({
      data: [
        {
          householdId: household.id,
          name: "Electricity",
          amountMinor: 14200,
          dueDate: new Date("2026-07-18"),
          frequency: "MONTHLY",
          accountId: checking.id,
          recurringExpenseId: utilityRecurring.id,
          obligationType: "UTILITY",
          sourceType: "CONFIRMED_RECURRING",
          essentiality: "ESSENTIAL",
          confidence: "HIGH",
          isDemo: true,
        },
        {
          householdId: household.id,
          name: "Water",
          amountMinor: 6800,
          dueDate: new Date("2026-07-22"),
          frequency: "MONTHLY",
          accountId: checking.id,
          obligationType: "UTILITY",
          sourceType: "DEMO",
          essentiality: "ESSENTIAL",
          confidence: "HIGH",
          isDemo: true,
        },
        {
          householdId: household.id,
          name: "Internet",
          amountMinor: 7000,
          dueDate: new Date("2026-07-20"),
          frequency: "MONTHLY",
          accountId: checking.id,
          obligationType: "SUBSCRIPTION",
          sourceType: "DEMO",
          essentiality: "IMPORTANT",
          confidence: "HIGH",
          isDemo: true,
        },
        {
          householdId: household.id,
          name: "Phone",
          amountMinor: 8500,
          dueDate: new Date("2026-07-24"),
          frequency: "MONTHLY",
          accountId: checking.id,
          obligationType: "UTILITY",
          sourceType: "DEMO",
          essentiality: "IMPORTANT",
          confidence: "HIGH",
          isDemo: true,
        },
        {
          householdId: household.id,
          name: "Insurance",
          amountMinor: 18000,
          dueDate: new Date("2026-07-28"),
          frequency: "MONTHLY",
          accountId: checking.id,
          obligationType: "INSURANCE",
          sourceType: "DEMO",
          essentiality: "ESSENTIAL",
          confidence: "HIGH",
          isDemo: true,
        },
        {
          householdId: household.id,
          name: "Streaming subscription",
          amountMinor: 1599,
          dueDate: new Date("2026-07-19"),
          frequency: "MONTHLY",
          accountId: checking.id,
          categoryId: subscriptions.id,
          recurringExpenseId: streamingRecurring.id,
          obligationType: "SUBSCRIPTION",
          sourceType: "DEMO",
          essentiality: "DISCRETIONARY",
          confidence: "MODERATE",
          isDemo: true,
        },
        {
          householdId: household.id,
          name: "Vehicle goal contribution",
          amountMinor: 40000,
          dueDate: new Date("2026-07-30"),
          frequency: "MONTHLY",
          accountId: checking.id,
          goalId: vehicle.id,
          obligationType: "GOAL_CONTRIBUTION",
          sourceType: "GOAL_PLAN",
          essentiality: "IMPORTANT",
          confidence: "HIGH",
          isDemo: true,
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

    const seededAccounts = await client.account.findMany({
      where: { householdId: household.id },
      include: { transactions: true },
    });
    const openingDate = new Date("2026-07-01T00:00:00.000Z");
    for (const account of seededAccounts) {
      const liability = ["CREDIT", "LOAN", "MORTGAGE"].includes(account.type);
      const movement = account.transactions.reduce(
        (sum, transaction) =>
          transaction.affectsLedger &&
          transaction.clearingStatus === "CLEARED" &&
          !transaction.possibleDuplicate &&
          transaction.transactionDate > openingDate
            ? sum + (liability ? -transaction.amountMinor : transaction.amountMinor)
            : sum,
        0,
      );
      await client.account.update({
        where: { id: account.id },
        data: {
          openingBalanceMinor: (account.reportedBalanceMinor ?? 0) - movement,
          openingBalanceDate: openingDate,
          openingBalanceSource: "DEMO_SEED",
          reportedBalanceAsOf: account.lastUpdated,
          ledgerBalanceMinor: account.reportedBalanceMinor,
          ledgerCalculatedAt: account.lastUpdated,
          ledgerStatus: "CURRENT",
          reconciliationDifferenceMinor: 0,
          reconciliationStatus: "RECONCILED",
          balanceConfidence: "HIGH",
          lastReconciledAt: account.lastUpdated,
        },
      });
    }

    const autoLoan = seededAccounts.find((account) => account.type === "LOAN");
    await client.decisionScenario.create({
      data: {
        householdId: household.id,
        name: "Add vehicle payment",
        description:
          "Model a synthetic vehicle payment, down payment, insurance, and operating cost.",
        isDemo: true,
        components: {
          create: {
            type: "VEHICLE_PAYMENT",
            name: "Replacement vehicle",
            amountMinor: 52500,
            secondaryAmountMinor: 300000,
            insuranceIncreaseMinor: 6500,
            operatingIncreaseMinor: 5000,
            tradeInMinor: 100000,
            frequency: "MONTHLY",
            startDate: new Date("2026-07-15"),
            durationMonths: 60,
            essentiality: "ESSENTIAL",
            linkedAccountId: savings.id,
          },
        },
      },
    });
    await client.decisionScenario.create({
      data: {
        householdId: household.id,
        name: "Cancel selected subscription",
        description: "Pause the confirmed synthetic streaming subscription for comparison.",
        isDemo: true,
        components: {
          create: {
            type: "CANCEL_RECURRING",
            name: `Cancel ${streamingRecurring.displayName}`,
            linkedRecurringId: streamingRecurring.id,
            startDate: new Date("2026-07-12"),
          },
        },
      },
    });
    if (autoLoan) {
      await client.decisionScenario.create({
        data: {
          householdId: household.id,
          name: "Increase debt payment",
          description:
            "Add a synthetic monthly payment to the auto loan without changing the saved debt plan.",
          isDemo: true,
          components: {
            create: {
              type: "DEBT_EXTRA_PAYMENT",
              name: "Auto loan extra payment",
              amountMinor: 25000,
              frequency: "MONTHLY",
              startDate: new Date("2026-07-12"),
              linkedDebtAccountId: autoLoan.id,
            },
          },
        },
      });
    }
    await client.decisionScenario.create({
      data: {
        householdId: household.id,
        name: "Add childcare cost",
        description: "Model a new essential monthly childcare obligation.",
        isDemo: true,
        components: {
          create: {
            type: "RECURRING_EXPENSE",
            name: "Childcare",
            amountMinor: 120000,
            frequency: "MONTHLY",
            startDate: new Date("2026-07-15"),
            essentiality: "ESSENTIAL",
          },
        },
      },
    });

    const [seededIncomeRules, seededObligationRules] = await Promise.all([
      client.expectedIncomeSchedule.findMany({ where: { householdId: household.id } }),
      client.scheduledObligation.findMany({ where: { householdId: household.id } }),
    ]);
    await client.forecastRule.createMany({
      data: [
        ...seededIncomeRules.map((item) => ({
          householdId: household.id,
          accountId: item.accountId,
          recurringExpenseId: item.recurringExpenseId,
          name: item.name,
          merchantKey: item.name.toLowerCase(),
          direction: "INCOME",
          cadence: item.frequency,
          anchorDate: item.nextExpectedDate,
          lastObservedDate:
            item.recurringExpenseId === payrollRecurring.id
              ? payrollRecurring.lastObservedDate
              : null,
          nextExpectedDate: item.nextExpectedDate,
          typicalAmountMinor: item.amountMinor,
          minAmountMinor: item.amountMinor,
          maxAmountMinor: item.amountMinor,
          amountVariabilityBps: 0,
          confidence: item.confidence === "MODERATE" ? "MEDIUM" : item.confidence,
          confidenceScore: item.confidence === "HIGH" ? 100 : 75,
          state: item.active ? "CONFIRMED" : "PAUSED",
          provenance: "Canonical synthetic forecast rule.",
          creationSource: "DEMO",
          sourceRecordType: "ExpectedIncomeSchedule",
          sourceRecordId: item.id,
          effectiveStartDate: item.nextExpectedDate,
          endDate: item.endDate,
          semimonthlyDay1: item.twiceMonthlyDay1,
          semimonthlyDay2: item.twiceMonthlyDay2,
          reasonsJson: JSON.stringify(["Synthetic demonstration rule."]),
          detectionFingerprint: `income-schedule:${item.id}`,
        })),
        ...seededObligationRules.map((item) => ({
          householdId: household.id,
          accountId: item.accountId,
          recurringExpenseId: item.recurringExpenseId,
          name: item.name,
          merchantKey: item.name.toLowerCase(),
          direction: "EXPENSE",
          cadence: item.frequency,
          anchorDate: item.dueDate,
          nextExpectedDate: item.dueDate,
          typicalAmountMinor: item.amountMinor,
          minAmountMinor: item.amountMinor,
          maxAmountMinor: item.amountMinor,
          amountVariabilityBps: 0,
          confidence: item.confidence === "MODERATE" ? "MEDIUM" : item.confidence,
          confidenceScore: item.confidence === "HIGH" ? 100 : 75,
          state: item.active ? "CONFIRMED" : "PAUSED",
          provenance: "Canonical synthetic forecast rule.",
          creationSource: "DEMO",
          sourceRecordType: "ScheduledObligation",
          sourceRecordId: item.id,
          effectiveStartDate: item.dueDate,
          reasonsJson: JSON.stringify(["Synthetic demonstration rule."]),
          detectionFingerprint: `obligation:${item.id}`,
        })),
      ],
    });

    if (process.env.FINANCIAL_COMPASS_PLAYWRIGHT_FIXTURES === "true") {
      const item = await client.plaidItem.create({
        data: {
          householdId: household.id,
          providerItemId: `playwright-item-${household.id}`,
          institutionId: "ins_playwright",
          institutionName: "Playwright Community Bank",
          environment: "sandbox",
          status: "ACTIVE",
        },
      });
      await client.plaidAccount.create({
        data: {
          plaidItemId: item.id,
          providerAccountId: `playwright-account-${household.id}`,
          officialName: "Playwright Everyday Checking",
          displayName: "Everyday Checking",
          mask: "4242",
          type: "depository",
          subtype: "checking",
          currency: "USD",
          currentBalanceMinor: 236_842,
          availableBalanceMinor: 226_842,
          balanceAsOf: new Date("2026-07-11T12:00:00.000Z"),
          selectedForImport: false,
          matchStatus: "PROPOSED",
          matchConfidence: "HIGH",
          matchEvidenceJson: JSON.stringify([
            "Account type is compatible.",
            "Institution and account name resemble an existing local account.",
          ]),
        },
      });
    }

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
