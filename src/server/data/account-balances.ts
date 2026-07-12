import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  balanceConfidence,
  calculateLedgerBalance,
  reconciliationSchema,
} from "@/domain/accounts/ledger";
import { auditChange } from "./audit";
import { AppError } from "./errors";

type Db = typeof prisma | Prisma.TransactionClient;
export async function recalculateAccountBalance(accountId: string, db: Db = prisma) {
  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { transactions: true, reconciliationAdjustments: true },
  });
  if (!account) throw new AppError("Account not found.", 404);
  if (account.openingBalanceMinor === null || !account.openingBalanceDate)
    return db.account.update({
      where: { id: accountId },
      data: {
        ledgerBalanceMinor: null,
        ledgerCalculatedAt: new Date(),
        ledgerStatus: "NEEDS_ANCHOR",
        reconciliationStatus: "NEEDS_SETUP",
        reconciliationDifferenceMinor: null,
        balanceConfidence: "LIMITED",
      },
    });
  const ledger = calculateLedgerBalance(
    account.type,
    account.openingBalanceMinor,
    account.openingBalanceDate,
    account.transactions,
    account.reconciliationAdjustments,
  );
  const difference =
    account.reportedBalanceMinor === null
      ? null
      : account.reportedBalanceMinor - ledger.ledgerBalanceMinor;
  const duplicates = account.transactions.filter((item) => item.possibleDuplicate).length;
  const unreviewed = account.transactions.filter((item) => item.reviewStatus !== "REVIEWED").length;
  const confidence = balanceConfidence({
    hasOpening: true,
    differenceMinor: difference,
    lastReportedAt: account.reportedBalanceAsOf,
    duplicates,
    unreviewed,
  });
  const status =
    difference === 0
      ? "RECONCILED"
      : account.reportedBalanceMinor === null
        ? "LEDGER_ONLY"
        : "UNRECONCILED";
  return db.account.update({
    where: { id: accountId },
    data: {
      ledgerBalanceMinor: ledger.ledgerBalanceMinor,
      ledgerCalculatedAt: new Date(),
      ledgerStatus: "CURRENT",
      reconciliationDifferenceMinor: difference,
      reconciliationStatus: status,
      balanceConfidence: confidence,
    },
  });
}
export async function recalculateAccountBalances(accountIds: string[], db: Db = prisma) {
  const results = [];
  for (const id of [...new Set(accountIds)]) results.push(await recalculateAccountBalance(id, db));
  return results;
}

export async function reconcileAccount(accountId: string, input: unknown) {
  const data = reconciliationSchema.parse(input);
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError("Account not found.", 404);
  return prisma.$transaction(async (tx) => {
    let openingBalanceMinor = account.openingBalanceMinor;
    let openingBalanceDate = account.openingBalanceDate;
    if (openingBalanceMinor === null || !openingBalanceDate) {
      openingBalanceMinor = data.reportedBalanceMinor;
      openingBalanceDate = data.reportedBalanceAsOf;
    }
    await tx.account.update({
      where: { id: accountId },
      data: {
        openingBalanceMinor,
        openingBalanceDate,
        openingBalanceSource: account.openingBalanceSource ?? "RECONCILIATION_ANCHOR",
        reportedBalanceMinor: data.reportedBalanceMinor,
        reportedAvailableMinor: data.reportedAvailableMinor,
        reportedBalanceAsOf: data.reportedBalanceAsOf,
        lastUpdated: new Date(),
      },
    });
    let recalculated = await recalculateAccountBalance(accountId, tx);
    if (data.createAdjustment && recalculated.reconciliationDifferenceMinor) {
      await tx.reconciliationAdjustment.create({
        data: {
          householdId: account.householdId,
          accountId,
          amountMinor: recalculated.reconciliationDifferenceMinor,
          effectiveDate: data.reportedBalanceAsOf,
          reason: data.adjustmentReason!,
          note: data.note,
        },
      });
      await auditChange(tx, {
        householdId: account.householdId,
        entityType: "ReconciliationAdjustment",
        entityId: accountId,
        action: "create",
        field: "amountMinor",
        newValue: recalculated.reconciliationDifferenceMinor,
        reason: data.adjustmentReason!,
        source: "reconciliation",
      });
      recalculated = await recalculateAccountBalance(accountId, tx);
    }
    if (recalculated.reconciliationDifferenceMinor === 0)
      await tx.account.update({
        where: { id: accountId },
        data: { lastReconciledAt: new Date(), reconciliationStatus: "RECONCILED" },
      });
    await auditChange(tx, {
      householdId: account.householdId,
      entityType: "Account",
      entityId: accountId,
      action: "reconcile",
      field: "reportedBalanceMinor",
      previousValue: account.reportedBalanceMinor,
      newValue: data.reportedBalanceMinor,
      reason: data.note ?? undefined,
      source: "reconciliation",
    });
    return tx.account.findUnique({ where: { id: accountId } });
  });
}
