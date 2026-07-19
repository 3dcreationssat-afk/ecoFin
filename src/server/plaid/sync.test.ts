// @vitest-environment node

import { execSync } from "node:child_process";
import type { AccountBase, Transaction as PlaidTransaction } from "plaid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-plaid-sync.db";

let sync: typeof import("./sync");
let prismaModule: typeof import("@/server/db/prisma");
let itemId: string;
let providerAccountId: string;
let localAccountId: string;

describe("Plaid synchronization persistence", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-plaid-sync.db" },
    });
    prismaModule = await import("@/server/db/prisma");
    sync = await import("./sync");
    const household = await prismaModule.prisma.household.findFirstOrThrow();
    const account = await prismaModule.prisma.account.findFirstOrThrow({
      where: { householdId: household.id, type: "CHECKING" },
    });
    const item = await prismaModule.prisma.plaidItem.create({
      data: {
        householdId: household.id,
        providerItemId: "synthetic-item",
        encryptedAccessToken: null,
        environment: "sandbox",
      },
    });
    const connected = await prismaModule.prisma.plaidAccount.create({
      data: {
        plaidItemId: item.id,
        localAccountId: account.id,
        providerAccountId: "synthetic-provider-account",
        displayName: "Synthetic Checking",
        type: "depository",
        subtype: "checking",
        matchStatus: "USER_LINKED",
      },
    });
    itemId = item.id;
    providerAccountId = connected.providerAccountId;
    localAccountId = account.id;
  }, 120_000);

  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("is idempotent and audits modifications and removals without deleting history", async () => {
    const added = providerTransaction("provider-txn-1", {
      name: "Synthetic Grocery",
      amount: 12.34,
    });
    const first = await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-1",
      added: [added],
      modified: [],
      removed: [],
    });
    expect(first.createdLedger).toBe(1);
    const createdSource = await prismaModule.prisma.plaidTransactionSource.findUniqueOrThrow({
      where: { providerTransactionId: added.transaction_id },
      include: { transaction: true },
    });
    expect(createdSource.transaction).toMatchObject({
      amountMinor: -1234,
      sourceType: "BANK_CONNECTION",
      affectsLedger: true,
    });

    await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-2",
      added: [added],
      modified: [],
      removed: [],
    });
    expect(
      await prismaModule.prisma.plaidTransactionSource.count({
        where: { providerTransactionId: added.transaction_id },
      }),
    ).toBe(1);
    expect(
      await prismaModule.prisma.transaction.count({ where: { id: createdSource.transactionId! } }),
    ).toBe(1);

    const modified = providerTransaction("provider-txn-1", {
      name: "Synthetic Grocery Corrected",
      amount: 13.34,
    });
    await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-3",
      added: [],
      modified: [modified],
      removed: [],
    });
    expect(
      await prismaModule.prisma.transaction.findUniqueOrThrow({
        where: { id: createdSource.transactionId! },
      }),
    ).toMatchObject({ amountMinor: -1334, originalDescription: "Synthetic Grocery Corrected" });

    await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-4",
      added: [],
      modified: [],
      removed: [modified.transaction_id],
    });
    expect(
      await prismaModule.prisma.plaidTransactionSource.findUniqueOrThrow({
        where: { providerTransactionId: modified.transaction_id },
      }),
    ).toMatchObject({ status: "REMOVED", ledgerDisposition: "REMOVED" });
    expect(
      await prismaModule.prisma.transaction.findUniqueOrThrow({
        where: { id: createdSource.transactionId! },
      }),
    ).toMatchObject({
      affectsLedger: false,
      affectsIncomeSpendingReports: false,
      reviewStatus: "FLAGGED",
    });
  });

  it("reuses one ledger record for an explicit pending-to-posted transition", async () => {
    const pending = providerTransaction("provider-pending", {
      name: "Synthetic Fuel",
      amount: 25,
      pending: true,
    });
    await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-5",
      added: [pending],
      modified: [],
      removed: [],
    });
    const pendingSource = await prismaModule.prisma.plaidTransactionSource.findUniqueOrThrow({
      where: { providerTransactionId: pending.transaction_id },
    });
    const posted = providerTransaction("provider-posted", {
      name: "Synthetic Fuel",
      amount: 25,
      pendingTransactionId: pending.transaction_id,
      date: "2026-07-11",
    });
    await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-6",
      added: [posted],
      modified: [],
      removed: [],
    });
    const postedSource = await prismaModule.prisma.plaidTransactionSource.findUniqueOrThrow({
      where: { providerTransactionId: posted.transaction_id },
    });
    expect(postedSource.transactionId).toBe(pendingSource.transactionId);
    expect(postedSource.ledgerDisposition).toBe("PENDING_TO_POSTED");
    expect(
      await prismaModule.prisma.plaidTransactionSource.findUniqueOrThrow({
        where: { providerTransactionId: pending.transaction_id },
      }),
    ).toMatchObject({ transactionId: null, status: "SUPERSEDED" });
  });

  it("reconciles one strongly evidenced CSV overlap without duplicate ledger impact", async () => {
    const csv = await prismaModule.prisma.transaction.create({
      data: {
        householdId: (await prismaModule.prisma.household.findFirstOrThrow()).id,
        accountId: localAccountId,
        sourceType: "CSV_IMPORT",
        originalDescription: "Synthetic Pharmacy",
        originalAmountText: "-42.10",
        originalDateText: "07/12/2026",
        normalizedMerchant: "Synthetic Pharmacy",
        amountMinor: -4210,
        transactionDate: new Date("2026-07-12T00:00:00.000Z"),
        type: "EXPENSE",
        isDemo: false,
      },
    });
    const provider = providerTransaction("provider-overlap", {
      name: "Synthetic Pharmacy",
      amount: 42.1,
      date: "2026-07-13",
    });
    const before = await prismaModule.prisma.transaction.count();
    const result = await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-7",
      added: [provider],
      modified: [],
      removed: [],
    });
    expect(result.reconciledLedger).toBe(1);
    expect(await prismaModule.prisma.transaction.count()).toBe(before);
    expect(
      await prismaModule.prisma.plaidTransactionSource.findUniqueOrThrow({
        where: { providerTransactionId: provider.transaction_id },
      }),
    ).toMatchObject({ transactionId: csv.id, ledgerDisposition: "RECONCILED_CSV" });
  });

  it("refreshes provider and linked local balance snapshots with audit history", async () => {
    await sync.applyPlaidUpdates({
      itemId,
      cursor: "cursor-8",
      added: [],
      modified: [],
      removed: [],
      accounts: [providerAccount({ current: 987.65, available: 876.54, limit: null })],
    });
    expect(
      await prismaModule.prisma.plaidAccount.findUniqueOrThrow({
        where: { providerAccountId },
      }),
    ).toMatchObject({ currentBalanceMinor: 98765, availableBalanceMinor: 87654 });
    expect(
      await prismaModule.prisma.account.findUniqueOrThrow({ where: { id: localAccountId } }),
    ).toMatchObject({ reportedBalanceMinor: 98765, reportedAvailableMinor: 87654 });
    expect(
      await prismaModule.prisma.auditLog.count({
        where: {
          entityType: "Account",
          entityId: localAccountId,
          action: "plaid_balance_refresh",
        },
      }),
    ).toBeGreaterThan(0);
  });
});

function providerAccount(balances: {
  current: number | null;
  available: number | null;
  limit: number | null;
}) {
  return {
    account_id: providerAccountId,
    name: "Synthetic Checking",
    official_name: "Synthetic Checking",
    mask: "1234",
    type: "depository",
    subtype: "checking",
    balances: {
      ...balances,
      iso_currency_code: "USD",
      unofficial_currency_code: null,
    },
  } as unknown as AccountBase;
}

function providerTransaction(
  transactionId: string,
  input: {
    name: string;
    amount: number;
    pending?: boolean;
    pendingTransactionId?: string;
    date?: string;
  },
) {
  return {
    transaction_id: transactionId,
    account_id: providerAccountId,
    name: input.name,
    merchant_name: input.name,
    amount: input.amount,
    date: input.date ?? "2026-07-10",
    authorized_date: input.date ?? "2026-07-10",
    pending: input.pending ?? false,
    pending_transaction_id: input.pendingTransactionId ?? null,
    iso_currency_code: "USD",
    unofficial_currency_code: null,
    transaction_code: null,
    personal_finance_category: {
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_GROCERIES",
      confidence_level: "VERY_HIGH",
    },
  } as unknown as PlaidTransaction;
}
