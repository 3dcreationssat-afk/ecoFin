import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { auditChange, auditFields } from "./audit";
import { recalculateAccountBalances } from "./account-balances";
import { AppError } from "./errors";

type EditableSnapshot = {
  sourceRowNumber: number;
  normalizedMerchant: string;
  categoryId: string | null;
  type: string;
  reviewStatus: string;
  excluded: boolean;
  notes: string | null;
  merchantSource: string;
  categorySource: string;
  typeSource: string;
  reviewSource: string;
};

export async function verifiedUndoForReimport(input: {
  batchId: string;
  expectedFileHash: string;
  expectedAccountId: string;
  expectedTransactionCount: number;
  expectedAccountClass: "ASSET" | "LIABILITY";
}) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findUnique({
      where: { id: input.batchId },
      include: { account: true, rows: true, transactions: true },
    });
    if (!batch) throw new AppError("Verified reimport batch was not found.", 404);
    if (!["IMPORTED", "PARTIALLY_IMPORTED"].includes(batch.status))
      throw new AppError("Verified reimport requires an active imported batch.", 409);
    if (batch.fileHash !== input.expectedFileHash || batch.accountId !== input.expectedAccountId)
      throw new AppError("Verified reimport source identity changed during execution.", 409);
    if (accountClass(batch.account.type) !== input.expectedAccountClass)
      throw new AppError("Verified reimport account safety condition failed.", 409);
    if (
      batch.transactions.length !== input.expectedTransactionCount ||
      batch.importedTransactionCount !== input.expectedTransactionCount
    )
      throw new AppError("Verified reimport transaction count changed during execution.", 409);
    const transactionIds = batch.transactions.map((transaction) => transaction.id);
    const confirmedTransfers = await tx.transferMatch.count({
      where: {
        status: "CONFIRMED",
        OR: [
          { outgoingTransactionId: { in: transactionIds } },
          { incomingTransactionId: { in: transactionIds } },
        ],
      },
    });
    if (confirmedTransfers)
      throw new AppError("Verified reimport is blocked by a confirmed transfer.", 409);
    const linkedRows = new Map(batch.rows.map((row) => [row.id, row]));
    if (
      batch.transactions.some((transaction) => {
        const row = transaction.importRowId ? linkedRows.get(transaction.importRowId) : null;
        return (
          !row || row.createdTransactionId !== transaction.id || row.importDecision !== "IMPORT"
        );
      })
    )
      throw new AppError("Verified reimport row provenance changed during execution.", 409);

    const staleMatches = await tx.transferMatch.findMany({
      where: {
        OR: [
          { outgoingTransactionId: { in: transactionIds } },
          { incomingTransactionId: { in: transactionIds } },
        ],
      },
    });
    for (const match of staleMatches) {
      await auditChange(tx, {
        householdId: batch.householdId,
        entityType: "TransferMatch",
        entityId: match.id,
        action: "candidate_removed_for_verified_reimport",
        field: "status",
        previousValue: match.status,
        source: "import_reimport",
      });
    }
    if (staleMatches.length)
      await tx.transferMatch.deleteMany({
        where: { id: { in: staleMatches.map((item) => item.id) } },
      });
    await tx.transaction.deleteMany({ where: { importBatchId: batch.id } });
    await recalculateAccountBalances([batch.accountId], tx);
    const summary = parseObject(batch.summaryJson);
    const updated = await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "UNDONE",
        completedAt: new Date(),
        summaryJson: JSON.stringify({
          ...summary,
          verifiedReimportUndo: true,
          preservedHistoricalRowCount: batch.rows.length,
        }),
      },
    });
    await auditChange(tx, {
      householdId: batch.householdId,
      entityType: "ImportBatch",
      entityId: batch.id,
      action: "verified_reimport_undo",
      field: "status",
      previousValue: batch.status,
      newValue: "UNDONE",
      reason: "Source-hash and row-provenance verified replacement import.",
      source: "import_reimport",
    });
    return updated;
  });
}

export async function linkReplacementBatch(oldBatchId: string, newBatchId: string) {
  const [oldBatch, newBatch] = await Promise.all([
    prisma.importBatch.findUnique({ where: { id: oldBatchId } }),
    prisma.importBatch.findUnique({ where: { id: newBatchId } }),
  ]);
  if (!oldBatch || !newBatch || oldBatch.status !== "UNDONE")
    throw new AppError("Replacement batch linkage is invalid.", 409);
  if (
    oldBatch.fileHash !== newBatch.fileHash ||
    oldBatch.accountId !== newBatch.accountId ||
    !["IMPORTED", "PARTIALLY_IMPORTED"].includes(newBatch.status)
  )
    throw new AppError("Replacement batch does not match historical source provenance.", 409);
  const oldSummary = parseObject(oldBatch.summaryJson);
  await prisma.importBatch.update({
    where: { id: oldBatch.id },
    data: { summaryJson: JSON.stringify({ ...oldSummary, replacementBatchId: newBatch.id }) },
  });
  await auditChange(prisma, {
    householdId: oldBatch.householdId,
    entityType: "ImportBatch",
    entityId: oldBatch.id,
    action: "replacement_batch_linked",
    field: "replacementBatchId",
    newValue: newBatch.id,
    source: "import_reimport",
  });
}

export function editableSnapshots(
  transactions: Array<{
    sourceRowNumber: number | null;
    normalizedMerchant: string;
    categoryId: string | null;
    type: string;
    reviewStatus: string;
    excluded: boolean;
    notes: string | null;
    merchantSource: string;
    categorySource: string;
    typeSource: string;
    reviewSource: string;
  }>,
) {
  return transactions
    .filter((transaction): transaction is typeof transaction & { sourceRowNumber: number } =>
      Number.isInteger(transaction.sourceRowNumber),
    )
    .map(
      (transaction) =>
        ({
          sourceRowNumber: transaction.sourceRowNumber,
          normalizedMerchant: transaction.normalizedMerchant,
          categoryId: transaction.categoryId,
          type: transaction.type,
          reviewStatus: transaction.reviewStatus,
          excluded: transaction.excluded,
          notes: transaction.notes,
          merchantSource: transaction.merchantSource,
          categorySource: transaction.categorySource,
          typeSource: transaction.typeSource,
          reviewSource: transaction.reviewSource,
        }) satisfies EditableSnapshot,
    );
}

export async function carryForwardEditableIntent(batchId: string, snapshots: EditableSnapshot[]) {
  const transactions = await prisma.transaction.findMany({ where: { importBatchId: batchId } });
  const byRow = new Map(snapshots.map((snapshot) => [snapshot.sourceRowNumber, snapshot]));
  let carriedFields = 0;
  let semanticReviewsPreserved = 0;
  await prisma.$transaction(async (tx) => {
    for (const transaction of transactions) {
      if (transaction.sourceRowNumber == null) continue;
      const snapshot = byRow.get(transaction.sourceRowNumber);
      if (!snapshot) continue;
      const ambiguous = transaction.typeSource === "IMPORT_REPAIR_REVIEW";
      const data: Prisma.TransactionUpdateInput = {};
      if (["USER", "BULK_USER"].includes(snapshot.categorySource)) {
        data.category = snapshot.categoryId
          ? { connect: { id: snapshot.categoryId } }
          : { disconnect: true };
        data.categorySource = snapshot.categorySource;
      }
      if (["USER", "BULK_USER"].includes(snapshot.merchantSource)) {
        data.normalizedMerchant = snapshot.normalizedMerchant;
        data.merchantSource = snapshot.merchantSource;
      }
      if (["USER", "BULK_USER"].includes(snapshot.typeSource) && !ambiguous) {
        data.type = snapshot.type;
        data.typeSource = snapshot.typeSource;
      }
      if (["USER", "BULK_USER"].includes(snapshot.reviewSource) && !ambiguous) {
        data.reviewStatus = snapshot.reviewStatus;
        data.reviewSource = snapshot.reviewSource;
        semanticReviewsPreserved += 1;
      }
      if (snapshot.excluded) data.excluded = true;
      if (snapshot.notes) data.notes = snapshot.notes;
      if (!Object.keys(data).length) continue;
      const updated = await tx.transaction.update({ where: { id: transaction.id }, data });
      await auditFields(tx, {
        householdId: transaction.householdId,
        entityType: "Transaction",
        entityId: transaction.id,
        action: "verified_reimport_intent_carried_forward",
        before: transaction,
        after: updated,
        fields: Object.keys(data).filter((field) => field !== "category"),
        source: "import_reimport",
      });
      if (data.category) {
        await auditChange(tx, {
          householdId: transaction.householdId,
          entityType: "Transaction",
          entityId: transaction.id,
          action: "verified_reimport_intent_carried_forward",
          field: "categoryId",
          previousValue: transaction.categoryId,
          newValue: snapshot.categoryId,
          source: "import_reimport",
        });
      }
      carriedFields += Object.keys(data).length;
    }
  });
  return { carriedFields, semanticReviewsPreserved };
}

function accountClass(type: string): "ASSET" | "LIABILITY" {
  return ["CREDIT", "LOAN", "MORTGAGE"].includes(type) ? "LIABILITY" : "ASSET";
}

function parseObject(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}
