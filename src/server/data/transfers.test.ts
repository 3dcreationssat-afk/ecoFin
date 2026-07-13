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

  it("creates idempotent candidates, rejects suggestions, confirms, and unmatches", async () => {
    const first = await transfers.scanTransferCandidates();
    const second = await transfers.scanTransferCandidates();
    expect(first.createdCount).toBeGreaterThanOrEqual(2);
    expect(second.createdCount).toBe(0);

    const suggested = await prismaModule.prisma.transferMatch.findMany({
      where: { status: "SUGGESTED" },
      orderBy: { score: "desc" },
    });
    const rejectable = suggested.at(-1);
    expect(rejectable).toBeTruthy();
    await transfers.rejectTransferMatch(rejectable!.id, {
      confirmation: "REJECT TRANSFER",
      notes: "not the same movement",
    });
    await expect(
      transfers.rejectTransferMatch(rejectable!.id, { confirmation: "REJECT TRANSFER" }),
    ).resolves.toMatchObject({ status: "REJECTED" });

    const confirmable = await prismaModule.prisma.transferMatch.findFirstOrThrow({
      where: { status: "SUGGESTED", confidence: "HIGH" },
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
