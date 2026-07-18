import type { Prisma, PrismaClient } from "@prisma/client";
import {
  parseCsv,
  parseDateOnly,
  parseDebitCreditAmount,
  normalizeSignedAmount,
  scoreDuplicate,
  sha256Text,
  transactionKind,
} from "@/domain/imports/csv";
import {
  confirmImportSchema,
  importProfileSchema,
  importProfileUpdateSchema,
  previewImportSchema,
  undoImportSchema,
  validateImportSchema,
} from "@/domain/imports/schema";
import { prisma } from "@/server/db/prisma";
import { auditChange, auditFields } from "./audit";
import { applyRulesToTransaction } from "./merchant-rules";
import { recalculateAccountBalances } from "./account-balances";
import { AppError } from "./errors";
import { getHousehold, workspaceState } from "./repositories";
import { scanRecurringExpenses } from "./recurring";
import { scanTransferCandidates } from "./transfers";
import { classifySemantics } from "./import-repair";
import { reconcileForecastOccurrenceMatches, refreshForecastIntelligence } from "./forecast-rules";

type Db = PrismaClient | Prisma.TransactionClient;

type Mapping = ReturnType<typeof validateImportSchema.parse>["mapping"];

export async function importDashboard() {
  const household = await getHousehold();
  const [profiles, batches] = await Promise.all([
    prisma.importProfile.findMany({
      where: { householdId: household.id },
      orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.importBatch.findMany({
      where: { householdId: household.id },
      include: { account: true, rows: { orderBy: { rowNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  return {
    household,
    accounts: household.accounts.filter((account) => !account.archivedAt),
    categories: household.categories.filter((category) => !category.archivedAt),
    profiles,
    batches,
  };
}

export async function createImportProfile(input: unknown) {
  const data = importProfileSchema.parse(input);
  const profile = await prisma.importProfile.create({ data });
  await auditChange(prisma, {
    householdId: profile.householdId,
    entityType: "ImportProfile",
    entityId: profile.id,
    action: "create",
    source: "import",
  });
  return profile;
}

export async function updateImportProfile(id: string, input: unknown) {
  const existing = await prisma.importProfile.findUnique({ where: { id } });
  if (!existing) throw new AppError("Import profile not found.", 404);
  const data = importProfileUpdateSchema.parse(input);
  const profile = await prisma.importProfile.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "ImportProfile",
    entityId: id,
    action: "update",
    before: existing,
    after: profile,
    fields: Object.keys(data),
    source: "import",
  });
  return profile;
}

export async function setImportProfileArchived(id: string, archived: boolean) {
  const existing = await prisma.importProfile.findUnique({ where: { id } });
  if (!existing) throw new AppError("Import profile not found.", 404);
  const archivedAt = archived ? new Date() : null;
  const profile = await prisma.importProfile.update({ where: { id }, data: { archivedAt } });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "ImportProfile",
    entityId: id,
    action: archived ? "archive" : "restore",
    field: "archivedAt",
    previousValue: existing.archivedAt,
    newValue: archivedAt,
    source: "import",
  });
  return profile;
}

export async function previewImport(input: unknown) {
  const data = previewImportSchema.parse(input);
  const household = await getHousehold();
  const account = household.accounts.find((item) => item.id === data.accountId && !item.archivedAt);
  if (!account) throw new AppError("Choose an active account for the import.", 422);

  const parsed = parseImportCsv(data, {
    delimiter: data.delimiter,
    hasHeader: data.hasHeader,
  });
  const fileHash = sha256Text(data.content);
  const repeatedFile = await prisma.importBatch.findFirst({
    where: {
      householdId: household.id,
      accountId: account.id,
      fileHash,
      status: { in: ["IMPORTED", "PARTIALLY_IMPORTED"] },
    },
  });

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.importBatch.create({
      data: {
        householdId: household.id,
        accountId: account.id,
        sourceType: "CSV_IMPORT",
        originalFilename: redactFilename(data.filename),
        fileHash,
        fileSize: data.fileSize,
        encoding: parsed.encoding,
        delimiter: parsed.delimiter,
        importProfileId: data.profileId ?? null,
        status: "PREVIEW",
        totalRowCount: parsed.rows.length,
        repeatedFile: Boolean(repeatedFile),
        summaryJson: JSON.stringify({
          headers: parsed.headers,
          sampleRows: parsed.sampleRows,
          warnings: parsed.warnings,
          repeatedFileBatchId: repeatedFile?.id ?? null,
        }),
      },
    });
    const stagedRows = parsed.rows.map((row, index) => ({
      importBatchId: created.id,
      rowNumber: index + 1,
      sourceFieldsJson: JSON.stringify(rowToFields(parsed.headers, row)),
      validationStatus: "WARNING",
      validationErrorsJson: JSON.stringify(["Map columns and validate before import."]),
      importDecision: "REVIEW",
    }));
    await createImportRowsInChunks(tx, stagedRows);
    await auditChange(tx, {
      householdId: household.id,
      entityType: "ImportBatch",
      entityId: created.id,
      action: "preview",
      field: "fileHash",
      newValue: fileHash.slice(0, 12),
      source: "import",
    });
    return created;
  });

  return batchDetail(batch.id);
}

export async function validateImport(input: unknown) {
  const data = validateImportSchema.parse(input);
  const household = await getHousehold();
  const account = household.accounts.find((item) => item.id === data.accountId && !item.archivedAt);
  if (!account) throw new AppError("Choose an active account for the import.", 422);
  const parsed = parseImportCsv(data, {
    delimiter: data.delimiter,
    hasHeader: data.hasHeader,
  });
  const fileHash = sha256Text(data.content);
  const existingTransactions = await prisma.transaction.findMany({
    where: { householdId: household.id, accountId: account.id },
    include: { importBatch: { select: { fileHash: true } } },
  });
  const repeatedFile = await prisma.importBatch.findFirst({
    where: {
      householdId: household.id,
      accountId: account.id,
      fileHash,
      status: { in: ["IMPORTED", "PARTIALLY_IMPORTED"] },
    },
  });

  let profileId = data.profileId ?? null;
  const mapping = data.mapping;
  const batch = await prisma.$transaction(async (tx) => {
    if (mapping.saveProfile && mapping.name) {
      const profile = await tx.importProfile.create({
        data: {
          householdId: household.id,
          name: mapping.name,
          institutionName: null,
          accountType: account.type,
          delimiter: parsed.delimiter,
          encoding: parsed.encoding,
          hasHeader: data.hasHeader,
          dateColumn: mapping.dateColumn,
          postedDateColumn: mapping.postedDateColumn ?? null,
          descriptionColumn: mapping.descriptionColumn,
          merchantColumn: mapping.merchantColumn ?? null,
          amountMode: mapping.amountMode,
          amountColumn: mapping.amountColumn ?? null,
          debitColumn: mapping.debitColumn ?? null,
          creditColumn: mapping.creditColumn ?? null,
          dateFormat: mapping.dateFormat,
          decimalSeparator: mapping.decimalSeparator,
          thousandsSeparator: mapping.thousandsSeparator,
          signConvention: mapping.signConvention,
          currency: mapping.currency,
        },
      });
      profileId = profile.id;
      await auditChange(tx, {
        householdId: household.id,
        entityType: "ImportProfile",
        entityId: profile.id,
        action: "create",
        source: "import",
      });
    }

    const batchId = data.batchId;
    const target = batchId
      ? await tx.importBatch.update({
          where: { id: batchId },
          data: {
            importProfileId: profileId,
            status: "VALIDATED",
            encoding: parsed.encoding,
            delimiter: parsed.delimiter,
            fileHash,
            fileSize: data.fileSize,
            totalRowCount: parsed.rows.length,
            repeatedFile: Boolean(repeatedFile),
            summaryJson: JSON.stringify({
              headers: parsed.headers,
              repeatedFileBatchId: repeatedFile?.id ?? null,
              mapping: mappingSnapshot(mapping),
            }),
          },
        })
      : await tx.importBatch.create({
          data: {
            householdId: household.id,
            accountId: account.id,
            sourceType: "CSV_IMPORT",
            originalFilename: redactFilename(data.filename),
            fileHash,
            fileSize: data.fileSize,
            encoding: parsed.encoding,
            delimiter: parsed.delimiter,
            importProfileId: profileId,
            status: "VALIDATED",
            totalRowCount: parsed.rows.length,
            repeatedFile: Boolean(repeatedFile),
            summaryJson: JSON.stringify({
              headers: parsed.headers,
              repeatedFileBatchId: repeatedFile?.id ?? null,
              mapping: mappingSnapshot(mapping),
            }),
          },
        });

    await tx.importRow.deleteMany({ where: { importBatchId: target.id } });
    const validatedRows = parsed.rows.map((row, index) =>
      validateRow({
        headers: parsed.headers,
        row,
        rowNumber: index + 1,
        mapping,
        accountId: account.id,
        fileHash,
        existingTransactions,
      }),
    );
    markDuplicateDecisions(validatedRows, existingTransactions);
    const stagedRows = validatedRows.map((row) => ({
      importBatchId: target.id,
      rowNumber: row.rowNumber,
      sourceFieldsJson: JSON.stringify(row.sourceFields),
      parsedTransactionDate: row.transactionDate,
      parsedPostedDate: row.postedDate,
      originalDescription: row.originalDescription,
      originalAmountText: row.originalAmountText,
      parsedAmountMinor: row.amountMinor,
      currency: mapping.currency,
      duplicateStatus: row.duplicateStatus,
      duplicateReason: row.duplicateReason,
      validationStatus: row.validationStatus,
      validationErrorsJson: JSON.stringify(row.errors),
      importDecision: row.importDecision,
    }));
    await createImportRowsInChunks(tx, stagedRows);
    const counts = summarizeRows(validatedRows);
    const updated = await tx.importBatch.update({
      where: { id: target.id },
      data: {
        acceptedRowCount: counts.accepted,
        rejectedRowCount: counts.rejected,
        duplicateCandidateCount: counts.duplicates,
        summaryJson: JSON.stringify({
          headers: parsed.headers,
          repeatedFileBatchId: repeatedFile?.id ?? null,
          mapping: mappingSnapshot(mapping),
          warnings: repeatedFile ? ["This file was already imported for this account."] : [],
        }),
      },
    });
    await auditChange(tx, {
      householdId: household.id,
      entityType: "ImportBatch",
      entityId: updated.id,
      action: "validate",
      field: "acceptedRowCount",
      newValue: counts.accepted,
      source: "import",
    });
    return updated;
  });

  return batchDetail(batch.id);
}

export async function confirmImport(input: unknown) {
  const data = confirmImportSchema.parse(input);
  const batch = await prisma.importBatch.findUnique({
    where: { id: data.batchId },
    include: { rows: { orderBy: { rowNumber: "asc" } }, account: true },
  });
  if (!batch) throw new AppError("Import batch not found.", 404);
  if (!["VALIDATED", "PARTIALLY_IMPORTED"].includes(batch.status)) {
    throw new AppError("Validate the import before confirming it.", 409);
  }
  if (batch.repeatedFile && !data.allowRepeatedFile) {
    throw new AppError("This file was already imported. Explicit override is required.", 409);
  }
  const decisions = new Map(data.decisions.map((decision) => [decision.rowId, decision.decision]));
  const unresolvedDuplicateRows = batch.rows.filter(
    (row) =>
      row.validationStatus !== "INVALID" &&
      row.duplicateStatus !== "NONE" &&
      (decisions.get(row.id) ?? row.importDecision) === "REVIEW",
  );
  if (unresolvedDuplicateRows.length > 0) {
    throw new AppError(
      `Choose Import or Skip for every duplicate candidate before confirming. Unresolved rows: ${unresolvedDuplicateRows.map((row) => row.rowNumber).join(", ")}.`,
      422,
    );
  }
  const rowsToImport = batch.rows.filter((row) => {
    const decision = decisions.get(row.id) ?? row.importDecision;
    return row.validationStatus !== "INVALID" && decision === "IMPORT";
  });
  const validRows = batch.rows.filter((row) => row.validationStatus !== "INVALID");
  if (validRows.length === 0) throw new AppError("No valid rows are available to confirm.", 422);
  const rowsToSkip = validRows.filter(
    (row) => (decisions.get(row.id) ?? row.importDecision) === "SKIP",
  );

  const detail = await prisma.$transaction(async (tx) => {
    const importedIds: string[] = [];
    const merchantRules = await tx.merchantRule.findMany({
      where: { householdId: batch.householdId, active: true, archivedAt: null },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
    let ruleMatchedCount = 0;
    let ruleConflictCount = 0;
    let ruleMerchantNormalizedCount = 0;
    let ruleCategoryAssignedCount = 0;
    let semanticReviewCount = 0;
    for (const row of rowsToSkip) {
      await tx.importRow.update({
        where: { id: row.id },
        data: { importDecision: "SKIP", createdTransactionId: null },
      });
    }
    for (const row of rowsToImport) {
      if (
        !row.parsedTransactionDate ||
        row.parsedAmountMinor === null ||
        !row.originalDescription ||
        !row.originalAmountText
      ) {
        throw new AppError(`Row ${row.rowNumber} is missing required parsed fields.`, 422);
      }
      const sourceFields = JSON.parse(row.sourceFieldsJson) as Record<string, string>;
      const semantic = classifySemantics(
        row.originalDescription,
        sourceFields,
        row.parsedAmountMinor,
      );
      const transaction = await tx.transaction.create({
        data: {
          householdId: batch.householdId,
          accountId: batch.accountId,
          categoryId: null,
          importBatchId: batch.id,
          importRowId: row.id,
          sourceType: "CSV_IMPORT",
          sourceFilename: batch.originalFilename,
          sourceAccountName: batch.account.name,
          sourceRowNumber: row.rowNumber,
          originalDescription: row.originalDescription,
          originalAmountText: row.originalAmountText,
          originalDateText:
            sourceFields.__dateText ?? row.parsedTransactionDate.toISOString().slice(0, 10),
          normalizedMerchant: String(sourceFields.__merchant || row.originalDescription).slice(
            0,
            160,
          ),
          amountMinor: row.parsedAmountMinor,
          transactionDate: row.parsedTransactionDate,
          postedDate: row.parsedPostedDate,
          type: semantic.type,
          typeSource: semantic.source,
          reviewStatus:
            semantic.ambiguous || row.duplicateStatus !== "NONE" ? "FLAGGED" : "NEEDS_REVIEW",
          possibleDuplicate: row.duplicateStatus !== "NONE",
          affectsLedger: true,
          isDemo: false,
        },
      });
      if (semantic.ambiguous) semanticReviewCount += 1;
      const ruleResult = await applyRulesToTransaction(tx, transaction, merchantRules);
      if (ruleResult.matched) ruleMatchedCount++;
      if (ruleResult.conflict) ruleConflictCount++;
      if (ruleResult.transaction.normalizedMerchant !== transaction.normalizedMerchant)
        ruleMerchantNormalizedCount++;
      if (ruleResult.transaction.categoryId !== transaction.categoryId) ruleCategoryAssignedCount++;
      importedIds.push(transaction.id);
      await tx.importRow.update({
        where: { id: row.id },
        data: { importDecision: "IMPORT", createdTransactionId: transaction.id },
      });
      await auditChange(tx, {
        householdId: batch.householdId,
        entityType: "Transaction",
        entityId: transaction.id,
        action: "import",
        field: "importBatchId",
        newValue: batch.id,
        source: "import",
      });
    }
    const skippedCount = rowsToSkip.length;
    const invalidCount = batch.rows.filter((row) => row.validationStatus === "INVALID").length;
    const exactOverlapSkippedCount = rowsToSkip.filter(
      (row) => row.duplicateStatus === "EXACT_OVERLAP",
    ).length;
    if (importedIds.length > 0) {
      await recalculateAccountBalances([batch.accountId], tx);
      const currentState = await workspaceState(tx);
      await tx.household.update({
        where: { id: batch.householdId },
        data: { workspaceMode: currentState === "DEMONSTRATION" ? "MIXED" : "USER_DATA" },
      });
    }
    const status =
      importedIds.length === 0
        ? "NO_CHANGES"
        : skippedCount > 0 || invalidCount > 0
          ? "PARTIALLY_IMPORTED"
          : "IMPORTED";
    const updated = await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status,
        completedAt: new Date(),
        importedTransactionCount: importedIds.length,
        acceptedRowCount: rowsToImport.length,
        rejectedRowCount: invalidCount,
        summaryJson: JSON.stringify({
          ...parseSummary(batch.summaryJson),
          importedIds,
          skippedCount,
          exactOverlapSkippedCount,
          invalidCount,
          ruleMatchedCount,
          ruleConflictCount,
          ruleMerchantNormalizedCount,
          ruleCategoryAssignedCount,
          stillNeedsReview: rowsToImport.length - ruleMatchedCount,
          semanticReviewCount,
        }),
      },
    });
    await auditChange(tx, {
      householdId: batch.householdId,
      entityType: "ImportBatch",
      entityId: batch.id,
      action: "confirm",
      field: "importedTransactionCount",
      newValue: importedIds.length,
      source: "import",
    });
    return batchDetail(updated.id, tx);
  });
  if (detail.transactions.length === 0) return detail;
  try {
    const scan = await scanTransferCandidates({
      householdId: batch.householdId,
      transactionIds: detail.transactions.map((transaction) => transaction.id),
    });
    const summary = parseSummary(detail.summaryJson);
    await prisma.importBatch.update({
      where: { id: detail.id },
      data: {
        summaryJson: JSON.stringify({
          ...summary,
          transferCandidatesFound: scan.createdCount + scan.refreshedCount,
          highConfidenceTransferCandidates: scan.highConfidence,
          creditCardPaymentCandidates: scan.creditCardPaymentCandidates,
          transferReviewHref: "/transactions",
        }),
      },
    });
    await auditChange(prisma, {
      householdId: batch.householdId,
      entityType: "ImportBatch",
      entityId: batch.id,
      action: "transfer_candidate_scan_completed",
      field: "transferCandidatesFound",
      newValue: scan.createdCount + scan.refreshedCount,
      source: "transfer",
    });
  } catch (error) {
    const summary = parseSummary(detail.summaryJson);
    await prisma.importBatch.update({
      where: { id: detail.id },
      data: {
        summaryJson: JSON.stringify({
          ...summary,
          transferCandidateWarning:
            error instanceof Error ? error.message : "Transfer candidate scan failed.",
        }),
      },
    });
  }
  try {
    const scan = await scanRecurringExpenses({
      householdId: batch.householdId,
      transactionIds: detail.transactions.map((transaction) => transaction.id),
    });
    const forecast = await refreshForecastIntelligence(
      batch.householdId,
      detail.transactions.map((transaction) => transaction.id),
    );
    const refreshed = await batchDetail(detail.id);
    const summary = parseSummary(refreshed.summaryJson);
    await prisma.importBatch.update({
      where: { id: detail.id },
      data: {
        summaryJson: JSON.stringify({
          ...summary,
          recurringCandidatesFound: scan.createdCount + scan.refreshedCount,
          highConfidenceRecurringCandidates: scan.highConfidence,
          recurringPriceIncreases: scan.priceIncreases,
          recurringReviewHref: "/recurring",
          payrollPatternsDetected: forecast.detection.payrollCandidates,
          forecastOccurrencesMatched: forecast.matching.createdCount,
        }),
      },
    });
    await auditChange(prisma, {
      householdId: batch.householdId,
      entityType: "ImportBatch",
      entityId: batch.id,
      action: "recurring_candidate_scan_completed",
      field: "recurringCandidatesFound",
      newValue: scan.createdCount + scan.refreshedCount,
      source: "recurring",
    });
  } catch (error) {
    const refreshed = await batchDetail(detail.id);
    const summary = parseSummary(refreshed.summaryJson);
    await prisma.importBatch.update({
      where: { id: detail.id },
      data: {
        summaryJson: JSON.stringify({
          ...summary,
          recurringCandidateWarning:
            error instanceof Error ? error.message : "Recurring candidate scan failed.",
        }),
      },
    });
  }
  return batchDetail(detail.id);
}

export async function undoImportBatch(id: string, input: unknown) {
  undoImportSchema.parse(input);
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    include: { transactions: true },
  });
  if (!batch) throw new AppError("Import batch not found.", 404);
  if (!["IMPORTED", "PARTIALLY_IMPORTED"].includes(batch.status)) {
    throw new AppError("Only imported batches can be undone.", 409);
  }
  const confirmedTransfers = await prisma.transferMatch.count({
    where: {
      status: "CONFIRMED",
      OR: [
        { outgoingTransactionId: { in: batch.transactions.map((transaction) => transaction.id) } },
        { incomingTransactionId: { in: batch.transactions.map((transaction) => transaction.id) } },
      ],
    },
  });
  if (confirmedTransfers) {
    throw new AppError(
      "Undo is blocked because imported transactions participate in confirmed transfers. Unmatch transfers first.",
      409,
    );
  }
  const changed = batch.transactions.filter((transaction) => {
    return (
      transaction.notes ||
      transaction.excluded ||
      [
        transaction.reviewSource,
        transaction.categorySource,
        transaction.merchantSource,
        transaction.typeSource,
      ].some((source) => source === "USER" || source === "BULK_USER")
    );
  });
  if (changed.length) {
    throw new AppError(
      "Undo is blocked because imported transactions were materially edited.",
      409,
    );
  }
  return prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { importBatchId: id } });
    await reconcileForecastOccurrenceMatches(tx);
    await recalculateAccountBalances(
      [...new Set(batch.transactions.map((transaction) => transaction.accountId))],
      tx,
    );
    const updated = await tx.importBatch.update({
      where: { id },
      data: { status: "UNDONE", completedAt: new Date() },
    });
    await auditChange(tx, {
      householdId: batch.householdId,
      entityType: "ImportBatch",
      entityId: id,
      action: "undo",
      field: "importedTransactionCount",
      previousValue: batch.importedTransactionCount,
      newValue: 0,
      source: "import",
    });
    return batchDetail(updated.id, tx);
  });
}

export async function batchDetail(id: string, db: Db = prisma) {
  const batch = await db.importBatch.findUnique({
    where: { id },
    include: {
      account: true,
      importProfile: true,
      rows: { orderBy: { rowNumber: "asc" } },
      transactions: { orderBy: { transactionDate: "desc" } },
    },
  });
  if (!batch) throw new AppError("Import batch not found.", 404);
  return batch;
}

function validateRow(input: {
  headers: string[];
  row: string[];
  rowNumber: number;
  mapping: Mapping;
  accountId: string;
  fileHash: string;
  existingTransactions: Array<{
    accountId: string;
    transactionDate: Date;
    postedDate: Date | null;
    amountMinor: number;
    originalDescription: string;
    normalizedMerchant: string;
    importBatchId: string | null;
    sourceRowNumber: number | null;
    importBatch: { fileHash: string } | null;
  }>;
}) {
  const sourceFields = rowToFields(input.headers, input.row);
  const errors: string[] = [];
  const dateText = getColumn(sourceFields, input.mapping.dateColumn);
  const postedDateText = input.mapping.postedDateColumn
    ? getColumn(sourceFields, input.mapping.postedDateColumn)
    : "";
  const description = getColumn(sourceFields, input.mapping.descriptionColumn);
  const merchant = input.mapping.merchantColumn
    ? getColumn(sourceFields, input.mapping.merchantColumn)
    : description;
  const amountText =
    input.mapping.amountMode === "SIGNED_AMOUNT"
      ? getColumn(sourceFields, input.mapping.amountColumn ?? "")
      : `${getColumn(sourceFields, input.mapping.debitColumn ?? "") || ""}${getColumn(sourceFields, input.mapping.creditColumn ?? "") || ""}`;
  let transactionDate: Date | null = null;
  let postedDate: Date | null = null;
  let amountMinor: number | null = null;

  if (!description.trim()) errors.push("Description is required.");
  if (!dateText.trim()) errors.push("Transaction date is required.");
  try {
    transactionDate = parseDateOnly(dateText, input.mapping.dateFormat);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Transaction date is invalid.");
  }
  if (postedDateText.trim()) {
    try {
      postedDate = parseDateOnly(postedDateText, input.mapping.dateFormat);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Posted date is invalid.");
    }
  }
  try {
    amountMinor =
      input.mapping.amountMode === "SIGNED_AMOUNT"
        ? normalizeSignedAmount(
            getColumn(sourceFields, input.mapping.amountColumn ?? ""),
            input.mapping,
          )
        : parseDebitCreditAmount(
            getColumn(sourceFields, input.mapping.debitColumn ?? ""),
            getColumn(sourceFields, input.mapping.creditColumn ?? ""),
            input.mapping,
          );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Amount is invalid.");
  }
  sourceFields.__dateText = dateText;
  sourceFields.__merchant = merchant;
  sourceFields.__kind = amountMinor === null ? "Unknown" : transactionKind(amountMinor);
  const semantic =
    amountMinor === null ? null : classifySemantics(description, sourceFields, amountMinor);
  if (semantic?.ambiguous) {
    sourceFields.__semanticWarning =
      "Transaction semantics require review; source context may represent a payment, refund, credit, fee, reward, adjustment, reversal, or chargeback.";
  }

  const duplicate =
    transactionDate && amountMinor !== null
      ? scoreDuplicate(
          {
            accountId: input.accountId,
            transactionDate,
            postedDate,
            amountMinor,
            originalDescription: description,
            normalizedMerchant: merchant,
            fileHash: input.fileHash,
            rowNumber: input.rowNumber,
          },
          input.existingTransactions.map((transaction) => ({
            ...transaction,
            fileHash: transaction.importBatch?.fileHash ?? null,
            rowNumber: transaction.sourceRowNumber,
          })),
        )
      : { status: "NONE" as const, reason: "" };
  const warning = duplicate.status !== "NONE" || Boolean(sourceFields.__semanticWarning);
  return {
    rowNumber: input.rowNumber,
    sourceFields,
    transactionDate,
    postedDate,
    originalDescription: description || null,
    originalAmountText: amountText || null,
    amountMinor,
    duplicateStatus: duplicate.status,
    duplicateReason: duplicate.reason || null,
    validationStatus: errors.length ? "INVALID" : warning ? "WARNING" : "VALID",
    errors: errors.length
      ? errors
      : warning
        ? [duplicate.reason || sourceFields.__semanticWarning]
        : [],
    importDecision: errors.length
      ? "SKIP"
      : duplicate.status === "NONE"
        ? "IMPORT"
        : duplicate.status === "EXACT_OVERLAP"
          ? "SKIP"
          : "REVIEW",
  };
}

function rowToFields(headers: string[], row: string[]) {
  const fields: Record<string, string> = {};
  headers.forEach((header, index) => {
    fields[header] = row[index] ?? "";
  });
  return fields;
}

function parseImportCsv(
  input: Parameters<typeof parseCsv>[0],
  options: Parameters<typeof parseCsv>[1],
) {
  try {
    return parseCsv(input, options);
  } catch (error) {
    if (error instanceof Error) throw new AppError(error.message, 422);
    throw error;
  }
}

async function createImportRowsInChunks(
  tx: Prisma.TransactionClient,
  rows: Prisma.ImportRowCreateManyInput[],
) {
  const chunkSize = 250;
  for (let index = 0; index < rows.length; index += chunkSize) {
    await tx.importRow.createMany({ data: rows.slice(index, index + chunkSize) });
  }
}

function getColumn(fields: Record<string, string>, column: string) {
  if (!column) return "";
  return fields[column] ?? "";
}

function summarizeRows(rows: ReturnType<typeof validateRow>[]) {
  return {
    accepted: rows.filter((row) => row.importDecision === "IMPORT").length,
    rejected: rows.filter((row) => row.validationStatus === "INVALID").length,
    duplicates: rows.filter((row) => row.duplicateStatus !== "NONE").length,
  };
}

function markDuplicateDecisions(
  rows: ReturnType<typeof validateRow>[],
  existingTransactions: Array<{
    transactionDate: Date;
    amountMinor: number;
    originalDescription: string;
  }>,
) {
  const existingCounts = new Map<string, number>();
  existingTransactions.forEach((transaction) => {
    const key = exactContentKey(transaction);
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  });
  const matchedExistingCounts = new Map<string, number>();
  const seen = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.transactionDate || row.amountMinor === null || !row.originalDescription) return;
    const key = exactContentKey({
      transactionDate: row.transactionDate,
      amountMinor: row.amountMinor,
      originalDescription: row.originalDescription,
    });
    const first = seen.get(key);
    const matchedCount = matchedExistingCounts.get(key) ?? 0;
    const existingCount = existingCounts.get(key) ?? 0;
    if (row.duplicateStatus === "EXACT_OVERLAP" && matchedCount < existingCount) {
      matchedExistingCounts.set(key, matchedCount + 1);
      row.duplicateReason =
        "Same account, transaction date, amount, and original description already exist.";
      row.importDecision = "SKIP";
    } else if (first) {
      row.duplicateStatus = "LIKELY";
      row.duplicateReason = `Same file row ${first} has the same date, amount, and description.`;
      if (row.validationStatus === "VALID") row.validationStatus = "WARNING";
      row.errors = [row.duplicateReason];
      row.importDecision = "REVIEW";
    } else {
      seen.set(key, row.rowNumber);
    }
    if (!first) seen.set(key, row.rowNumber);
  });
}

function exactContentKey(input: {
  transactionDate: Date;
  amountMinor: number;
  originalDescription: string;
}) {
  return [
    input.transactionDate.toISOString().slice(0, 10),
    input.amountMinor,
    input.originalDescription.trim().toLowerCase().replace(/\s+/g, " "),
  ].join("|");
}

function redactFilename(filename: string) {
  const clean = filename.replace(/[/\\]/g, "").trim();
  if (clean.length <= 64) return clean;
  const dot = clean.lastIndexOf(".");
  const extension = dot >= 0 ? clean.slice(dot) : "";
  return `${clean.slice(0, 24)}...${extension}`;
}

function parseSummary(value: string | null | undefined) {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function actionableImportBatches(householdId: string) {
  const batches = await prisma.importBatch.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
  });
  const latestBySource = new Map<string, (typeof batches)[number]>();
  for (const batch of batches) {
    const key = `${batch.accountId}|${batch.fileHash}`;
    if (!latestBySource.has(key)) latestBySource.set(key, batch);
  }
  return [...latestBySource.values()].filter((batch) =>
    ["PREVIEW", "VALIDATED", "FAILED", "PARTIALLY_IMPORTED"].includes(batch.status),
  );
}

function mappingSnapshot(mapping: Mapping) {
  return {
    amountMode: mapping.amountMode,
    signConvention: mapping.signConvention,
    dateFormat: mapping.dateFormat,
    amountColumn: mapping.amountColumn ?? null,
    debitColumn: mapping.debitColumn ?? null,
    creditColumn: mapping.creditColumn ?? null,
  };
}
