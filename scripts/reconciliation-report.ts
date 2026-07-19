import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { prisma } from "../src/server/db/prisma";

function anonymousId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function main() {
  const [
    identity,
    batches,
    rows,
    transactions,
    accounts,
    transfers,
    recurring,
    forecastRules,
    plaidSources,
    plaidItems,
    integrity,
  ] = await Promise.all([
    prisma.workspaceMetadata.findFirst(),
    prisma.importBatch.findMany({
      select: {
        id: true,
        accountId: true,
        fileHash: true,
        status: true,
        totalRowCount: true,
        importedTransactionCount: true,
      },
    }),
    prisma.importRow.findMany({
      select: {
        id: true,
        importBatchId: true,
        rowNumber: true,
        parsedTransactionDate: true,
        parsedPostedDate: true,
        originalDescription: true,
        originalAmountText: true,
        parsedAmountMinor: true,
        validationStatus: true,
        duplicateStatus: true,
        importDecision: true,
        createdTransactionId: true,
      },
    }),
    prisma.transaction.findMany({
      select: {
        id: true,
        accountId: true,
        importBatchId: true,
        importRowId: true,
        sourceType: true,
        sourceRowNumber: true,
        originalDescription: true,
        originalAmountText: true,
        originalDateText: true,
        amountMinor: true,
        transactionDate: true,
        postedDate: true,
        type: true,
        reviewStatus: true,
        possibleDuplicate: true,
        excluded: true,
        affectsLedger: true,
        interpretationType: true,
        interpretationConfidence: true,
        interpretationAutoApplied: true,
        interpretationReviewRequired: true,
      },
    }),
    prisma.account.findMany({ select: { id: true, type: true, balanceConfidence: true } }),
    prisma.transferMatch.groupBy({ by: ["status"], _count: true }),
    prisma.recurringExpense.groupBy({ by: ["status"], _count: true }),
    prisma.forecastRule.groupBy({ by: ["direction", "state"], _count: true }),
    prisma.plaidTransactionSource.findMany({
      select: {
        providerTransactionId: true,
        transactionId: true,
        status: true,
        ledgerDisposition: true,
      },
    }),
    prisma.plaidItem.findMany({ select: { environment: true, status: true } }),
    prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>(`PRAGMA integrity_check`),
  ]);
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const reconciliation = {
    matched: 0,
    historicalUndoneRows: 0,
    stagedNotImportedRows: 0,
    intentionallySkippedRows: 0,
    importedWithoutLedgerImpactRows: 0,
    missingTransaction: 0,
    accountMismatch: 0,
    amountMismatch: 0,
    dateMismatch: 0,
    descriptionMismatch: 0,
    originalTextMismatch: 0,
    sourceRowMismatch: 0,
  };
  for (const row of rows) {
    const batch = batchById.get(row.importBatchId);
    if (!row.createdTransactionId) {
      if (batch?.status === "UNDONE") reconciliation.historicalUndoneRows++;
      else if (batch?.status === "VALIDATED") reconciliation.stagedNotImportedRows++;
      else if (row.importDecision === "SKIP" || row.validationStatus === "INVALID")
        reconciliation.intentionallySkippedRows++;
      else reconciliation.importedWithoutLedgerImpactRows++;
      continue;
    }
    const transaction = transactionById.get(row.createdTransactionId);
    if (!transaction && batch?.status === "UNDONE") {
      reconciliation.historicalUndoneRows++;
      continue;
    }
    if (!transaction || !batch) {
      reconciliation.missingTransaction++;
      continue;
    }
    let exact = true;
    if (transaction.accountId !== batch.accountId) {
      reconciliation.accountMismatch++;
      exact = false;
    }
    if (transaction.amountMinor !== row.parsedAmountMinor) {
      reconciliation.amountMismatch++;
      exact = false;
    }
    if (
      row.parsedTransactionDate?.getTime() !== transaction.transactionDate.getTime() ||
      (row.parsedPostedDate?.getTime() ?? null) !== (transaction.postedDate?.getTime() ?? null)
    ) {
      reconciliation.dateMismatch++;
      exact = false;
    }
    if (transaction.originalDescription !== row.originalDescription) {
      reconciliation.descriptionMismatch++;
      exact = false;
    }
    if (transaction.originalAmountText !== row.originalAmountText) {
      reconciliation.originalTextMismatch++;
      exact = false;
    }
    if (transaction.sourceRowNumber !== row.rowNumber) {
      reconciliation.sourceRowMismatch++;
      exact = false;
    }
    if (exact) reconciliation.matched++;
  }
  const byAccount = accounts.map((account) => ({
    account: anonymousId(account.id),
    type: account.type,
    transactionCount: transactions.filter(
      (transaction) => transaction.accountId === account.id && transaction.affectsLedger,
    ).length,
    balanceConfidence: account.balanceConfidence,
  }));
  const active = transactions.filter(
    (transaction) => transaction.affectsLedger && !transaction.excluded,
  );
  const dates = active.map((transaction) => transaction.transactionDate.getTime());
  const report = {
    generatedAt: new Date().toISOString(),
    workspace: {
      type: identity?.workspaceType ?? "MISSING",
      identityHash: identity ? anonymousId(identity.id) : null,
    },
    databaseIntegrity: integrity.map((row) => row.integrity_check),
    csv: {
      sourceFileHashes: new Set(batches.map((batch) => batch.fileHash)).size,
      importBatches: batches.length,
      batchStatuses: countBy(batches, (batch) => batch.status),
      sourceRows: rows.length,
      batchDeclaredRows: batches.reduce((sum, batch) => sum + batch.totalRowCount, 0),
      importedTransactionCount: transactions.filter(
        (transaction) => transaction.sourceType === "CSV_IMPORT",
      ).length,
      rowDecisions: countBy(rows, (row) => row.importDecision),
      validationStatuses: countBy(rows, (row) => row.validationStatus),
      duplicateStatuses: countBy(rows, (row) => row.duplicateStatus),
      reconciliation,
    },
    ledger: {
      totalTransactions: transactions.length,
      activeTransactions: active.length,
      excludedTransactions: transactions.filter((transaction) => transaction.excluded).length,
      bySource: countBy(transactions, (transaction) => transaction.sourceType),
      byAccount,
      dateCoverage: dates.length
        ? {
            from: new Date(Math.min(...dates)).toISOString().slice(0, 10),
            to: new Date(Math.max(...dates)).toISOString().slice(0, 10),
          }
        : null,
      amounts: {
        positive: active.filter((transaction) => transaction.amountMinor > 0).length,
        negative: active.filter((transaction) => transaction.amountMinor < 0).length,
        zero: active.filter((transaction) => transaction.amountMinor === 0).length,
      },
      incomeCandidates: active.filter((transaction) =>
        ["INCOME", "CREDIT"].includes(transaction.type),
      ).length,
      payrollCandidates: active.filter(
        (transaction) => transaction.interpretationType === "PAYROLL_INCOME",
      ).length,
      refundCandidates: active.filter((transaction) => transaction.type === "REFUND").length,
      possibleDuplicates: active.filter((transaction) => transaction.possibleDuplicate).length,
      requiredReviews: active.filter(
        (transaction) =>
          transaction.reviewStatus === "NEEDS_REVIEW" || transaction.interpretationReviewRequired,
      ).length,
      automaticInterpretations: active.filter(
        (transaction) => transaction.interpretationAutoApplied,
      ).length,
      provisionalInterpretations: active.filter(
        (transaction) => transaction.interpretationConfidence === "MEDIUM",
      ).length,
    },
    transfers: Object.fromEntries(transfers.map((group) => [group.status, group._count])),
    recurring: Object.fromEntries(recurring.map((group) => [group.status, group._count])),
    forecastRules: Object.fromEntries(
      forecastRules.map((group) => [`${group.direction}:${group.state}`, group._count]),
    ),
    plaid: {
      items: countBy(plaidItems, (item) => `${item.environment}:${item.status}`),
      processedTransactions: plaidSources.length,
      byStatus: countBy(plaidSources, (source) => source.status),
      ledgerDisposition: countBy(plaidSources, (source) => source.ledgerDisposition),
      withoutLedgerReference: plaidSources.filter(
        (source) => !source.transactionId && source.status === "ACTIVE",
      ).length,
    },
  };
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
    const output = resolve(process.argv[outputIndex + 1]);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    console.log(`Reconciliation report written to ${output}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

function countBy<T>(values: T[], key: (value: T) => string) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[key(value)] = (counts[key(value)] ?? 0) + 1;
  return counts;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Reconciliation audit failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
