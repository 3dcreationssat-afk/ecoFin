import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.household.deleteMany();

  const household = await prisma.household.create({
    data: {
      name: "Our Household",
      currency: "USD",
      financialMonthStart: 1,
      incomeSchedule: "BI_WEEKLY",
      checkingBufferMinor: 150000,
      emergencyFundTargetMinor: 1500000,
      debtStrategy: "AVALANCHE",
      accounts: {
        create: [
          {
            name: "Everyday Checking",
            institution: "First National Bank",
            type: "CHECKING",
            balanceMinor: 842055,
            availableMinor: 842055,
            lastUpdated: new Date("2026-07-09"),
          },
          {
            name: "High-Yield Savings",
            institution: "First National Bank",
            type: "SAVINGS",
            balanceMinor: 1420000,
            availableMinor: 1420000,
            lastUpdated: new Date("2026-07-09"),
          },
          {
            name: "Chase Sapphire",
            institution: "Chase",
            type: "CREDIT",
            balanceMinor: -284730,
            availableMinor: 715270,
            creditLimitMinor: 1000000,
            aprBasisPoints: 2149,
            dueDay: 17,
            lastUpdated: new Date("2026-07-09"),
          },
          {
            name: "Capital One Venture",
            institution: "Capital One",
            type: "CREDIT",
            balanceMinor: -120380,
            availableMinor: 879620,
            creditLimitMinor: 1000000,
            aprBasisPoints: 1899,
            dueDay: 21,
            lastUpdated: new Date("2026-07-08"),
          },
          {
            name: "Auto Loan",
            institution: "Toyota Financial",
            type: "LOAN",
            balanceMinor: -1840000,
            aprBasisPoints: 490,
            lastUpdated: new Date("2026-06-30"),
          },
          {
            name: "Mortgage",
            institution: "Quicken Loans",
            type: "MORTGAGE",
            balanceMinor: -24780000,
            aprBasisPoints: 375,
            lastUpdated: new Date("2026-06-30"),
          },
        ],
      },
      categories: {
        create: [
          { name: "Mortgage", group: "Fixed", type: "EXPENSE", budgetMinor: 165000, sortOrder: 10 },
          { name: "Auto Loan", group: "Fixed", type: "EXPENSE", budgetMinor: 38000, sortOrder: 20 },
          { name: "Car Insurance", group: "Fixed", type: "EXPENSE", budgetMinor: 18000, sortOrder: 30 },
          { name: "Phone", group: "Fixed", type: "EXPENSE", budgetMinor: 8500, sortOrder: 40 },
          { name: "Internet", group: "Fixed", type: "EXPENSE", budgetMinor: 7000, sortOrder: 50 },
          { name: "Life Insurance", group: "Fixed", type: "EXPENSE", budgetMinor: 4500, sortOrder: 60 },
          { name: "Groceries", group: "Essential Variable", type: "EXPENSE", budgetMinor: 65000, sortOrder: 70 },
          { name: "Dining", group: "Discretionary", type: "EXPENSE", budgetMinor: 25000, sortOrder: 80 },
          { name: "Gas", group: "Essential Variable", type: "EXPENSE", budgetMinor: 18000, sortOrder: 90 },
          { name: "Subscriptions", group: "Discretionary", type: "EXPENSE", budgetMinor: 9000, sortOrder: 100 },
          { name: "Income", group: "Income", type: "INCOME", budgetMinor: 485000, sortOrder: 110 },
        ],
      },
    },
  });

  console.log(`Seeded synthetic household ${household.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

