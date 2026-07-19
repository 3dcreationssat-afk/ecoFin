// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-plaid-connections.db";
process.env.FINANCIAL_COMPASS_PROJECT_ROOT = process.cwd();
process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE = "TEST";

let connections: typeof import("./connections");
let prismaModule: typeof import("@/server/db/prisma");

describe("Plaid account decisions", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-plaid-connections.db" },
    });
    prismaModule = await import("@/server/db/prisma");
    connections = await import("./connections");
  }, 120_000);

  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("previews and rematches connected history without losing provenance", async () => {
    const checking = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CHECKING" },
    });
    const savings = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "SAVINGS" },
    });
    const item = await prismaModule.prisma.plaidItem.create({
      data: {
        householdId: checking.householdId,
        providerItemId: "provider-item-match-test",
        institutionName: "Fixture Bank",
        environment: "sandbox",
        status: "ACTIVE",
      },
    });
    const connected = await prismaModule.prisma.plaidAccount.create({
      data: {
        plaidItemId: item.id,
        localAccountId: checking.id,
        providerAccountId: "provider-account-match-test",
        displayName: "Connected Savings",
        type: "depository",
        subtype: "savings",
        currency: "USD",
        currentBalanceMinor: 42_000,
        selectedForImport: true,
        matchStatus: "USER_LINKED",
      },
    });
    const transaction = await prismaModule.prisma.transaction.create({
      data: {
        householdId: checking.householdId,
        accountId: checking.id,
        sourceType: "BANK_CONNECTION",
        originalDescription: "Connected transaction",
        originalAmountText: "42.00",
        originalDateText: "2026-07-10",
        normalizedMerchant: "Connected transaction",
        amountMinor: 4_200,
        transactionDate: new Date("2026-07-10T00:00:00.000Z"),
        postedDate: new Date("2026-07-10T00:00:00.000Z"),
        type: "CREDIT",
      },
    });
    const source = await prismaModule.prisma.plaidTransactionSource.create({
      data: {
        plaidAccountId: connected.id,
        transactionId: transaction.id,
        providerTransactionId: "provider-transaction-match-test",
        postedDate: transaction.transactionDate,
        amountMinor: transaction.amountMinor,
        rawName: transaction.originalDescription,
        ledgerDisposition: "AUTHORITATIVE",
      },
    });

    const preview = await connections.plaidAccountMatchPreview(connected.id, savings.id);
    expect(preview).toMatchObject({
      coverage: { providerCount: 1, possibleOverlaps: 0 },
      impact: { transactionProvenancePreserved: true },
    });
    await connections.resolvePlaidAccount(connected.id, {
      action: "LINK",
      localAccountId: savings.id,
      confirmation: "CONFIRM ACCOUNT MATCH",
    });
    expect(
      await prismaModule.prisma.transaction.findUniqueOrThrow({ where: { id: transaction.id } }),
    ).toMatchObject({ accountId: savings.id });
    expect(
      await prismaModule.prisma.plaidTransactionSource.findUniqueOrThrow({
        where: { id: source.id },
      }),
    ).toMatchObject({
      providerTransactionId: source.providerTransactionId,
      transactionId: transaction.id,
    });
    expect(
      await prismaModule.prisma.auditLog.findFirst({
        where: { entityId: connected.id, action: "rematch" },
      }),
    ).toBeTruthy();

    await connections.resolvePlaidAccount(connected.id, { action: "DISABLE_SYNC" });
    expect(
      await prismaModule.prisma.plaidAccount.findUniqueOrThrow({ where: { id: connected.id } }),
    ).toMatchObject({
      localAccountId: savings.id,
      selectedForImport: false,
      matchStatus: "SYNC_DISABLED",
    });
    await connections.resolvePlaidAccount(connected.id, { action: "ENABLE_SYNC" });
    await connections.resolvePlaidAccount(connected.id, { action: "UNLINK" });
    expect(
      await prismaModule.prisma.plaidAccount.findUniqueOrThrow({ where: { id: connected.id } }),
    ).toMatchObject({ localAccountId: null, selectedForImport: false, matchStatus: "UNMATCHED" });
  });
});
