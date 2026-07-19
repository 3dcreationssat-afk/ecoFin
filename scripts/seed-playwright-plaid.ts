import { PrismaClient } from "@prisma/client";
import { assertTestDatabase, configureDatabaseUrl } from "../src/server/db/database-url";

configureDatabaseUrl();
assertTestDatabase();
const prisma = new PrismaClient();

async function main() {
  const household = await prisma.household.findFirstOrThrow();
  const item = await prisma.plaidItem.upsert({
    where: { providerItemId: `playwright-item-${household.id}` },
    update: {},
    create: {
      householdId: household.id,
      providerItemId: `playwright-item-${household.id}`,
      institutionId: "ins_playwright",
      institutionName: "Playwright Community Bank",
      environment: "sandbox",
      status: "ACTIVE",
    },
  });
  await prisma.plaidAccount.upsert({
    where: { providerAccountId: `playwright-account-${household.id}` },
    update: {},
    create: {
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

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Playwright Plaid fixture failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
