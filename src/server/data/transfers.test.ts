// @vitest-environment node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-transfers.db";

let transfers: typeof import("./transfers");
let imports: typeof import("./imports");
let backup: typeof import("./backup");
let prismaModule: typeof import("@/server/db/prisma");
let accountBalances: typeof import("./account-balances");

describe("transfer matching service", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-transfers.db" },
    });
    transfers = await import("./transfers");
    imports = await import("./imports");
    backup = await import("./backup");
    prismaModule = await import("@/server/db/prisma");
    accountBalances = await import("./account-balances");
  }, 120_000);

  afterAll(async () => {
    await prismaModule?.prisma.$disconnect();
  });

  it("auto-confirms unique evidence while keeping lower-confidence decisions reversible", async () => {
    const first = await transfers.scanTransferCandidates();
    const second = await transfers.scanTransferCandidates();
    expect(first.createdCount).toBeGreaterThanOrEqual(2);
    expect(first.automaticallyConfirmed).toBeGreaterThan(0);
    expect(second.createdCount).toBe(0);

    const automaticallyConfirmed = await prismaModule.prisma.transferMatch.findFirstOrThrow({
      where: { status: "CONFIRMED", source: "AUTOMATIC_CONFIRMED" },
      include: { outgoingTransaction: true, incomingTransaction: true },
    });
    expect(automaticallyConfirmed.outgoingTransaction.affectsIncomeSpendingReports).toBe(false);
    expect(automaticallyConfirmed.incomingTransaction.affectsIncomeSpendingReports).toBe(false);
    await transfers.unmatchTransfer(automaticallyConfirmed.id, {
      confirmation: "UNMATCH TRANSFER",
    });
    expect(
      await prismaModule.prisma.transferMatch.findUniqueOrThrow({
        where: { id: automaticallyConfirmed.id },
      }),
    ).toMatchObject({ status: "UNMATCHED" });

    const checking = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CHECKING" },
    });
    const credit = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CREDIT" },
    });
    const savings = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "SAVINGS" },
    });
    const createPair = async (
      amountMinor: number,
      incomingDate: string,
      description: string,
      outgoingAccount = checking,
    ) => {
      const outgoing = await prismaModule.prisma.transaction.create({
        data: {
          householdId: outgoingAccount.householdId,
          accountId: outgoingAccount.id,
          originalDescription: description,
          originalAmountText: String(-amountMinor),
          originalDateText: "2026-07-10",
          normalizedMerchant: description,
          amountMinor: -amountMinor,
          transactionDate: new Date("2026-07-10T00:00:00.000Z"),
          postedDate: new Date("2026-07-10T00:00:00.000Z"),
          type: "DEBIT",
        },
      });
      const incoming = await prismaModule.prisma.transaction.create({
        data: {
          householdId: credit.householdId,
          accountId: credit.id,
          originalDescription: description,
          originalAmountText: String(amountMinor),
          originalDateText: incomingDate,
          normalizedMerchant: description,
          amountMinor,
          transactionDate: new Date(`${incomingDate}T00:00:00.000Z`),
          postedDate: new Date(`${incomingDate}T00:00:00.000Z`),
          type: "CREDIT",
        },
      });
      await transfers.scanTransferCandidates({ transactionIds: [outgoing.id, incoming.id] });
      return { outgoing, incoming };
    };

    const rejectPair = await createPair(12_345, "2026-07-13", "Account movement");
    const rejectable = await prismaModule.prisma.transferMatch.findFirstOrThrow({
      where: {
        outgoingTransactionId: rejectPair.outgoing.id,
        incomingTransactionId: rejectPair.incoming.id,
        status: "SUGGESTED",
      },
    });
    await transfers.rejectTransferMatch(rejectable!.id, {
      confirmation: "REJECT TRANSFER",
      notes: "not the same movement",
    });
    await expect(
      transfers.rejectTransferMatch(rejectable!.id, { confirmation: "REJECT TRANSFER" }),
    ).resolves.toMatchObject({ status: "REJECTED" });

    const confirmPair = await createPair(23_456, "2026-07-11", "Card payment transfer", savings);
    const confirmable = await prismaModule.prisma.transferMatch.findFirstOrThrow({
      where: {
        outgoingTransactionId: confirmPair.outgoing.id,
        incomingTransactionId: confirmPair.incoming.id,
        status: "SUGGESTED",
        confidence: "HIGH",
      },
    });
    const matchedTransactions = await prismaModule.prisma.transaction.findMany({
      where: {
        id: {
          in: [confirmable.outgoingTransactionId, confirmable.incomingTransactionId],
        },
      },
      select: { accountId: true },
    });
    const matchedAccountIds = matchedTransactions.map((transaction) => transaction.accountId);
    await accountBalances.recalculateAccountBalances(matchedAccountIds);
    const ledgerBefore = await prismaModule.prisma.account.findMany({
      where: { id: { in: matchedAccountIds } },
      select: { id: true, ledgerBalanceMinor: true },
    });
    await transfers.confirmTransferMatch(confirmable.id, { confirmation: "CONFIRM TRANSFER" });
    const confirmed = await prismaModule.prisma.transferMatch.findUniqueOrThrow({
      where: { id: confirmable.id },
      include: { outgoingTransaction: true, incomingTransaction: true },
    });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.outgoingTransaction.type).toBe("TRANSFER_OUT");
    expect(confirmed.incomingTransaction.type).toBe("TRANSFER_IN");
    expect(confirmed.outgoingTransaction.affectsLedger).toBe(true);
    expect(confirmed.incomingTransaction.affectsLedger).toBe(true);
    expect(confirmed.outgoingTransaction.affectsIncomeSpendingReports).toBe(false);
    expect(confirmed.incomingTransaction.affectsIncomeSpendingReports).toBe(false);
    expect(
      await prismaModule.prisma.account.findMany({
        where: { id: { in: matchedAccountIds } },
        select: { id: true, ledgerBalanceMinor: true },
      }),
    ).toEqual(ledgerBefore);
    await expect(
      transfers.confirmTransferMatch(confirmable.id, { confirmation: "CONFIRM TRANSFER" }),
    ).rejects.toThrow(/Only suggested/);

    await transfers.unmatchTransfer(confirmable.id, { confirmation: "UNMATCH TRANSFER" });
    const unmatched = await prismaModule.prisma.transferMatch.findUniqueOrThrow({
      where: { id: confirmable.id },
      include: { outgoingTransaction: true, incomingTransaction: true },
    });
    expect(unmatched.status).toBe("UNMATCHED");
    expect(unmatched.outgoingTransaction.type).toBe("DEBIT");
    expect(unmatched.incomingTransaction.type).toBe("CREDIT");
    expect(unmatched.outgoingTransaction.affectsIncomeSpendingReports).toBe(true);
    expect(unmatched.incomingTransaction.affectsIncomeSpendingReports).toBe(true);
  });

  it("creates manual matches and prevents duplicate confirmed relationships", async () => {
    const checking = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CHECKING" },
    });
    const savings = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "SAVINGS" },
    });
    const householdId = checking.householdId;
    const outgoing = await prismaModule.prisma.transaction.create({
      data: {
        householdId,
        accountId: checking.id,
        originalDescription: "Manual transfer out",
        originalAmountText: "-123.45",
        originalDateText: "2026-07-12",
        normalizedMerchant: "Manual Transfer",
        amountMinor: -12345,
        transactionDate: new Date("2026-07-12"),
        postedDate: new Date("2026-07-12"),
        type: "DEBIT",
      },
    });
    const incoming = await prismaModule.prisma.transaction.create({
      data: {
        householdId,
        accountId: savings.id,
        originalDescription: "Manual transfer in",
        originalAmountText: "123.45",
        originalDateText: "2026-07-12",
        normalizedMerchant: "Manual Transfer",
        amountMinor: 12345,
        transactionDate: new Date("2026-07-12"),
        postedDate: new Date("2026-07-12"),
        type: "CREDIT",
      },
    });
    const match = await transfers.createManualTransfer({
      outgoingTransactionId: outgoing.id,
      incomingTransactionId: incoming.id,
      confirmation: "CONFIRM TRANSFER",
    });
    expect(match.status).toBe("CONFIRMED");
    await expect(
      transfers.createManualTransfer({
        outgoingTransactionId: outgoing.id,
        incomingTransactionId: incoming.id,
        confirmation: "CONFIRM TRANSFER",
      }),
    ).rejects.toThrow(/already in a confirmed transfer/);
  });

  it("leaves competing high-confidence matches in the review queue", async () => {
    const checking = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CHECKING" },
    });
    const destinations = await prismaModule.prisma.account.findMany({
      where: { type: { in: ["SAVINGS", "CREDIT"] } },
      take: 2,
    });
    const common = {
      householdId: checking.householdId,
      originalDescription: "Online transfer payment",
      originalDateText: "2026-07-15",
      normalizedMerchant: "Online Transfer",
      transactionDate: new Date("2026-07-15T00:00:00.000Z"),
      postedDate: new Date("2026-07-15T00:00:00.000Z"),
    };
    const outgoing = await prismaModule.prisma.transaction.create({
      data: {
        ...common,
        accountId: checking.id,
        originalAmountText: "-777.77",
        amountMinor: -77_777,
        type: "DEBIT",
      },
    });
    const incoming = await Promise.all(
      destinations.map((account) =>
        prismaModule.prisma.transaction.create({
          data: {
            ...common,
            accountId: account.id,
            originalAmountText: "777.77",
            amountMinor: 77_777,
            type: "CREDIT",
          },
        }),
      ),
    );
    const result = await transfers.scanTransferCandidates({
      transactionIds: [outgoing.id, ...incoming.map((item) => item.id)],
    });
    expect(result.automaticallyConfirmed).toBe(0);
    expect(
      await prismaModule.prisma.transferMatch.count({
        where: { outgoingTransactionId: outgoing.id, status: "SUGGESTED" },
      }),
    ).toBe(2);
  });

  it("blocks import undo when an imported transaction is in a confirmed transfer", async () => {
    const dashboard = await imports.importDashboard();
    const checking = dashboard.accounts.find((account) => account.type === "CHECKING")!;
    const savings = dashboard.accounts.find((account) => account.type === "SAVINGS")!;
    const csv = "Date,Description,Amount\n07/12/2026,Imported transfer out,-77.00\n";
    const validated = await imports.validateImport({
      accountId: checking.id,
      filename: "synthetic-transfer.csv",
      fileSize: csv.length,
      content: csv,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        saveProfile: false,
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
      },
    });
    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      confirm: "IMPORT CSV",
    });
    const incoming = await prismaModule.prisma.transaction.create({
      data: {
        householdId: checking.householdId,
        accountId: savings.id,
        originalDescription: "Imported transfer in",
        originalAmountText: "77.00",
        originalDateText: "2026-07-12",
        normalizedMerchant: "Imported Transfer",
        amountMinor: 7700,
        transactionDate: new Date("2026-07-12"),
        postedDate: new Date("2026-07-12"),
        type: "CREDIT",
      },
    });
    await transfers.createManualTransfer({
      outgoingTransactionId: imported.transactions[0].id,
      incomingTransactionId: incoming.id,
      confirmation: "CONFIRM TRANSFER",
    });
    await expect(imports.undoImportBatch(imported.id, { confirm: "UNDO IMPORT" })).rejects.toThrow(
      /confirmed transfers/,
    );
  });

  it("preserves transfer relationships through backup and restore", async () => {
    const checking = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CHECKING" },
    });
    const savings = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "SAVINGS" },
    });
    const base = {
      householdId: checking.householdId,
      originalDateText: "2026-07-13",
      normalizedMerchant: "Backup Transfer",
      transactionDate: new Date("2026-07-13"),
      postedDate: new Date("2026-07-13"),
    };
    const outgoing = await prismaModule.prisma.transaction.create({
      data: {
        ...base,
        accountId: checking.id,
        originalDescription: "Backup transfer out",
        originalAmountText: "-543.21",
        amountMinor: -54321,
        type: "DEBIT",
      },
    });
    const incoming = await prismaModule.prisma.transaction.create({
      data: {
        ...base,
        accountId: savings.id,
        originalDescription: "Backup transfer in",
        originalAmountText: "543.21",
        amountMinor: 54321,
        type: "CREDIT",
      },
    });
    await transfers.createManualTransfer({
      outgoingTransactionId: outgoing.id,
      incomingTransactionId: incoming.id,
      confirmation: "CONFIRM TRANSFER",
    });
    const created = await backup.createLocalBackup();
    await prismaModule.prisma.transferMatch.updateMany({ data: { status: "BROKEN" } });
    await backup.restoreBackup(readFileSync(created.path), { confirmation: "RESTORE BACKUP" });
    const restoredClient = new PrismaClient();
    try {
      const restored = await restoredClient.transferMatch.findMany({
        where: { status: "CONFIRMED" },
      });
      expect(restored.length).toBeGreaterThan(0);
    } finally {
      await restoredClient.$disconnect();
    }
  });
});
