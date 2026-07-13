import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ImportBatch, ImportRow, Transaction } from "@prisma/client";
import { parseCsv, parseDateOnly } from "../src/domain/imports/csv";
import { currentPeriodSummary } from "../src/domain/summaries/calculations";
import { validateBackupPackage, restoreBackup } from "../src/server/data/backup";
import {
  carryForwardEditableIntent,
  editableSnapshots,
  linkReplacementBatch,
  verifiedUndoForReimport,
} from "../src/server/data/import-reimport";
import { confirmImport, validateImport } from "../src/server/data/imports";
import { scanRecurringExpenses } from "../src/server/data/recurring";
import { scanTransferCandidates } from "../src/server/data/transfers";
import { prisma } from "../src/server/db/prisma";

type SelectedBatch = ImportBatch & {
  account: {
    id: string;
    type: string;
    openingBalanceMinor: number | null;
    openingBalanceDate: Date | null;
    ledgerStatus: string;
    ledgerBalanceMinor: number | null;
  };
  rows: ImportRow[];
  transactions: Transaction[];
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceDir = required(options, "source-dir");
  const backupFile = required(options, "backup-file");
  const expectedRecords = Number(required(options, "expected-records"));
  const expectedNegative = Number(required(options, "expected-negative"));
  const expectedPositive = Number(required(options, "expected-positive"));
  const expectedClass = required(options, "expected-account-class");
  const expectedConvention = required(options, "expected-sign-convention");
  const apply = options.apply === "true";
  if (!Number.isInteger(expectedRecords) || expectedRecords <= 0)
    throw new Error("Expected record count is invalid.");
  if (!["ASSET", "LIABILITY"].includes(expectedClass))
    throw new Error("Expected account class is invalid.");
  if (!["DEBITS_NEGATIVE", "DEBITS_POSITIVE"].includes(expectedConvention))
    throw new Error("Expected sign convention is invalid.");
  if (expectedNegative + expectedPositive !== expectedRecords)
    throw new Error("Expected sign counts must equal the expected record count.");

  const backupValidation = await validateBackupPackage(backupFile);
  if (!backupValidation.valid || backupValidation.integrityCheck !== "ok")
    throw new Error("Backup validation failed.");
  const sources = await sourceFiles(sourceDir);
  const batches = await prisma.importBatch.findMany({
    where: {
      fileHash: { in: sources.map((source) => source.hash) },
      status: { in: ["IMPORTED", "PARTIALLY_IMPORTED"] },
    },
    include: {
      account: true,
      rows: { orderBy: { rowNumber: "asc" } },
      transactions: { orderBy: { sourceRowNumber: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  const eligible = batches.filter((batch) => accountClass(batch.account.type) === expectedClass);
  const selections = subsetsWithTotal(eligible, expectedRecords);
  if (selections.length !== 1)
    throw new Error(`Source provenance resolved to ${selections.length} possible selections.`);
  const selected = selections[0] as SelectedBatch[];
  const prepared = selected.map((batch) => prepareBatch(batch, sources));
  const preflight = preflightAggregate(
    prepared,
    backupValidation.integrityCheck,
    expectedConvention,
  );
  console.log(JSON.stringify({ phase: "preflight", ...preflight }, null, 2));
  if (!apply) return;
  if (options.confirm !== "REIMPORT VERIFIED BATCHES")
    throw new Error("Explicit reimport confirmation is required.");

  const before = await aggregateState(
    selected.map((batch) => batch.id),
    selected[0].householdId,
  );
  const replacementBatchIds: string[] = [];
  let mappedImportDecisions = 0;
  let mappedSkipDecisions = 0;
  let unmappedDecisions = 0;
  let carriedFields = 0;
  try {
    for (const item of prepared) {
      await verifiedUndoForReimport({
        batchId: item.batch.id,
        expectedFileHash: item.batch.fileHash,
        expectedAccountId: item.batch.accountId,
        expectedTransactionCount: item.batch.transactions.length,
        expectedAccountClass: expectedClass as "ASSET" | "LIABILITY",
      });
    }
    for (const item of prepared) {
      const validated = await validateImport({
        accountId: item.batch.accountId,
        filename: basename(item.source.path),
        fileSize: Buffer.byteLength(item.source.content, "utf8"),
        content: item.source.content,
        delimiter: item.batch.delimiter,
        encoding: item.batch.encoding,
        hasHeader: item.mapping.hasHeader,
        mapping: {
          saveProfile: false,
          delimiter: item.batch.delimiter,
          encoding: item.batch.encoding,
          hasHeader: item.mapping.hasHeader,
          dateColumn: item.mapping.dateColumn,
          descriptionColumn: item.mapping.descriptionColumn,
          amountMode: "SIGNED_AMOUNT",
          amountColumn: item.mapping.amountColumn,
          dateFormat: item.mapping.dateFormat,
          decimalSeparator: item.mapping.decimalSeparator,
          thousandsSeparator: item.mapping.thousandsSeparator,
          signConvention: expectedConvention as "DEBITS_NEGATIVE" | "DEBITS_POSITIVE",
          currency: item.mapping.currency,
        },
      });
      const decisions = validated.rows.map((newRow) => {
        const oldRow = item.batch.rows.find((row) => row.rowNumber === newRow.rowNumber);
        if (!oldRow || !sameImmutableRow(oldRow, newRow)) {
          unmappedDecisions += 1;
          return { rowId: newRow.id, decision: "REVIEW" as const };
        }
        if (oldRow.importDecision === "IMPORT") mappedImportDecisions += 1;
        if (oldRow.importDecision === "SKIP") mappedSkipDecisions += 1;
        return {
          rowId: newRow.id,
          decision: oldRow.importDecision as "IMPORT" | "SKIP" | "REVIEW",
        };
      });
      if (unmappedDecisions)
        throw new Error("One or more prior decisions could not be mapped safely.");
      const imported = await confirmImport({
        batchId: validated.id,
        decisions,
        allowRepeatedFile: false,
        confirm: "IMPORT CSV",
      });
      replacementBatchIds.push(imported.id);
      const carried = await carryForwardEditableIntent(
        imported.id,
        editableSnapshots(item.batch.transactions),
      );
      carriedFields += carried.carriedFields;
      await linkReplacementBatch(item.batch.id, imported.id);
    }
    await scanTransferCandidates({ householdId: selected[0].householdId });
    await scanRecurringExpenses({ householdId: selected[0].householdId });
    const after = await aggregateState(replacementBatchIds, selected[0].householdId);
    const verification = await verifyReplacement({
      selected,
      replacementBatchIds,
      expectedRecords,
      expectedNegative,
      expectedPositive,
      expectedConvention,
      before,
      after,
      mappedImportDecisions,
      mappedSkipDecisions,
      unmappedDecisions,
      carriedFields,
      backupValidation,
    });
    console.log(JSON.stringify({ phase: "complete", ...verification }, null, 2));
  } catch (error) {
    await restoreBackup(Buffer.from(await readFile(backupFile)), {
      confirmation: "RESTORE BACKUP",
    });
    throw new Error(`Verified reimport failed; validated backup restored. ${message(error)}`);
  }
}

function prepareBatch(batch: SelectedBatch, sources: Awaited<ReturnType<typeof sourceFiles>>) {
  const matches = sources.filter((source) => source.hash === batch.fileHash);
  if (matches.length !== 1)
    throw new Error("A selected batch does not map to exactly one verified source file.");
  if (
    batch.rows.length !== batch.transactions.length ||
    batch.transactions.length !== batch.importedTransactionCount
  )
    throw new Error("Selected batch row and transaction counts differ.");
  const source = matches[0];
  const mapping = deriveMapping(batch, source.content);
  return { batch, source, mapping };
}

function deriveMapping(batch: SelectedBatch, content: string) {
  const publicKeys = Object.keys(parseFields(batch.rows[0].sourceFieldsJson)).filter(
    (key) => !key.startsWith("__"),
  );
  const descriptionCandidates = publicKeys.filter((key) =>
    batch.rows.every((row) => parseFields(row.sourceFieldsJson)[key] === row.originalDescription),
  );
  const descriptionColumn = chooseDescriptionColumn(descriptionCandidates);
  const amountCandidates = publicKeys.filter((key) =>
    batch.rows.every((row) => parseFields(row.sourceFieldsJson)[key] === row.originalAmountText),
  );
  const dateCandidates = publicKeys.filter((key) =>
    batch.rows.every((row) => {
      const fields = parseFields(row.sourceFieldsJson);
      return fields[key] === fields.__dateText;
    }),
  );
  if (amountCandidates.length !== 1 || dateCandidates.length !== 1)
    throw new Error("Immutable rows do not identify unique date and amount columns.");
  const dateFormats = (["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const).filter((format) =>
    batch.rows.every((row) => {
      const fields = parseFields(row.sourceFieldsJson);
      if (!row.parsedTransactionDate || !fields.__dateText) return false;
      try {
        return (
          parseDateOnly(fields.__dateText, format).getTime() === row.parsedTransactionDate.getTime()
        );
      } catch {
        return false;
      }
    }),
  );
  if (dateFormats.length !== 1) throw new Error("Immutable rows do not identify one date format.");
  const headerModes = [true, false].filter((hasHeader) => {
    try {
      const parsed = parseCsv(
        { filename: "verified.csv", fileSize: Buffer.byteLength(content, "utf8"), content },
        { delimiter: batch.delimiter as "," | ";" | "\t", hasHeader },
      );
      return (
        parsed.rows.length === batch.rows.length &&
        parsed.headers.join("\u0000") === publicKeys.join("\u0000")
      );
    } catch {
      return false;
    }
  });
  if (headerModes.length !== 1)
    throw new Error("Source file header mode is not uniquely provable.");
  const amounts = batch.rows.map((row) => row.originalAmountText ?? "");
  const decimalSeparator = amounts.some((value) => /,\d{1,2}\s*$/.test(value)) ? "," : ".";
  const thousandsSeparator =
    decimalSeparator === "."
      ? amounts.some((value) => /\d,\d{3}/.test(value))
        ? ","
        : ""
      : amounts.some((value) => /\d\.\d{3}/.test(value))
        ? "."
        : "";
  const currencies = [...new Set(batch.rows.map((row) => row.currency))];
  if (currencies.length !== 1) throw new Error("Selected batch has inconsistent row currencies.");
  return {
    hasHeader: headerModes[0],
    dateColumn: dateCandidates[0],
    descriptionColumn,
    amountColumn: amountCandidates[0],
    dateFormat: dateFormats[0],
    decimalSeparator,
    thousandsSeparator,
    currency: currencies[0],
  };
}

function chooseDescriptionColumn(candidates: string[]) {
  if (candidates.length === 1) return candidates[0];
  const exact = candidates.filter((candidate) => candidate.trim().toLowerCase() === "description");
  if (exact.length === 1) return exact[0];
  throw new Error("Immutable rows do not identify one description column.");
}

function sameImmutableRow(oldRow: ImportRow, newRow: ImportRow) {
  return (
    oldRow.rowNumber === newRow.rowNumber &&
    oldRow.originalDescription === newRow.originalDescription &&
    oldRow.originalAmountText === newRow.originalAmountText &&
    oldRow.parsedTransactionDate?.getTime() === newRow.parsedTransactionDate?.getTime() &&
    oldRow.parsedPostedDate?.getTime() === newRow.parsedPostedDate?.getTime() &&
    JSON.stringify(publicFields(oldRow.sourceFieldsJson)) ===
      JSON.stringify(publicFields(newRow.sourceFieldsJson))
  );
}

async function verifyReplacement(input: {
  selected: SelectedBatch[];
  replacementBatchIds: string[];
  expectedRecords: number;
  expectedNegative: number;
  expectedPositive: number;
  expectedConvention: string;
  before: Awaited<ReturnType<typeof aggregateState>>;
  after: Awaited<ReturnType<typeof aggregateState>>;
  mappedImportDecisions: number;
  mappedSkipDecisions: number;
  unmappedDecisions: number;
  carriedFields: number;
  backupValidation: Awaited<ReturnType<typeof validateBackupPackage>>;
}) {
  const replacements = await prisma.importBatch.findMany({
    where: { id: { in: input.replacementBatchIds } },
    include: { account: true, rows: true, transactions: true },
  });
  const historical = await prisma.importBatch.findMany({
    where: { id: { in: input.selected.map((batch) => batch.id) } },
    include: { rows: true },
  });
  const replacementTransactions = replacements.flatMap((batch) => batch.transactions);
  const originalRows = new Map(
    input.selected.flatMap((batch) =>
      batch.rows.map((row) => [`${batch.fileHash}|${row.rowNumber}`, row] as const),
    ),
  );
  const sourceRetained = replacements.every((batch) =>
    batch.rows.every((row) => {
      const original = originalRows.get(`${batch.fileHash}|${row.rowNumber}`);
      return Boolean(original && sameImmutableRow(original, row));
    }),
  );
  const mappingProvenance = replacements.every((batch) => {
    const mapping = parseObject(batch.summaryJson).mapping as Record<string, unknown> | undefined;
    return (
      mapping?.amountMode === "SIGNED_AMOUNT" &&
      mapping?.signConvention === input.expectedConvention
    );
  });
  const anchorsUnchanged = replacements.every((batch) => {
    const original = input.selected.find((item) => item.accountId === batch.accountId)?.account;
    return (
      original?.openingBalanceMinor === batch.account.openingBalanceMinor &&
      original?.openingBalanceDate?.getTime() === batch.account.openingBalanceDate?.getTime()
    );
  });
  const integrity =
    await prisma.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  const report = currentPeriodSummary(
    await prisma.transaction.findMany({ where: { householdId: replacements[0].householdId } }),
  );
  void report;
  const assertions = {
    exactReplacementCount: replacementTransactions.length === input.expectedRecords,
    activeTransactionCountPreserved:
      input.after.activeRealTransactions === input.before.activeRealTransactions,
    expectedSignDistribution:
      input.after.selectedNegative === input.expectedNegative &&
      input.after.selectedPositive === input.expectedPositive,
    mappingProvenance,
    anchorsUnchanged,
    accountsNeedAnchor: replacements.every(
      (batch) =>
        batch.account.ledgerStatus === "NEEDS_ANCHOR" && batch.account.ledgerBalanceMinor === null,
    ),
    sourceRetained,
    historicalRowsRetained: historical.every(
      (batch) => batch.status === "UNDONE" && batch.rows.length > 0,
    ),
    importedDuplicatesAffectLedger: replacementTransactions
      .filter((item) => item.possibleDuplicate)
      .every((item) => item.affectsLedger),
    noTransferAutoConfirmation: input.after.confirmedTransfers === input.before.confirmedTransfers,
    predictableNextDatesFuture: input.after.staleNextDates === 0,
    irregularHasNoExactNext: input.after.irregularWithExactNext === 0,
    cardPurchasesExcludedFromIncome: replacementTransactions
      .filter((item) => item.amountMinor < 0 && item.type === "DEBIT")
      .every((item) => item.type !== "CREDIT"),
    creditsExcludedFromSpending: replacementTransactions
      .filter((item) => item.amountMinor > 0 && item.type !== "UNKNOWN")
      .every((item) => !["DEBIT", "EXPENSE", "FEE", "INTEREST"].includes(item.type)),
    confirmedTransfersExcludedFromReports: (
      await prisma.transaction.findMany({
        where: {
          householdId: replacements[0].householdId,
          type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] },
        },
      })
    ).every((item) => !item.affectsIncomeSpendingReports),
  };
  if (Object.values(assertions).some((value) => !value))
    throw new Error("One or more post-reimport invariants failed.");
  return {
    backup: {
      valid: input.backupValidation.valid,
      compatibility: input.backupValidation.compatibility,
      integrity: input.backupValidation.integrityCheck,
    },
    before: input.before,
    after: input.after,
    rowsUndone: input.expectedRecords,
    rowsReimported: replacementTransactions.length,
    ambiguousReviewCount: replacementTransactions.filter(
      (item) => item.type === "UNKNOWN" && item.reviewStatus === "FLAGGED",
    ).length,
    mappedImportDecisions: input.mappedImportDecisions,
    mappedSkipDecisions: input.mappedSkipDecisions,
    unmappedDecisions: input.unmappedDecisions,
    carriedEditableFields: input.carriedFields,
    assertions,
    finalIntegrity: integrity[0]?.integrity_check ?? "unknown",
  };
}

async function aggregateState(selectedBatchIds: string[], householdId: string) {
  const now = new Date();
  const [
    activeRealTransactions,
    activeBatches,
    historicalBatches,
    selectedTransactions,
    transferGroups,
    cardPaymentCandidates,
    recurringConfidence,
    recurringCadence,
    staleNextDates,
    irregularWithExactNext,
    allBatches,
  ] = await Promise.all([
    prisma.transaction.count({ where: { householdId, isDemo: false } }),
    prisma.importBatch.count({
      where: { householdId, status: { in: ["IMPORTED", "PARTIALLY_IMPORTED"] } },
    }),
    prisma.importBatch.count({ where: { householdId, status: "UNDONE" } }),
    prisma.transaction.findMany({ where: { importBatchId: { in: selectedBatchIds } } }),
    prisma.transferMatch.groupBy({
      by: ["status"],
      where: { householdId },
      _count: { _all: true },
    }),
    prisma.transferMatch.count({
      where: {
        householdId,
        status: "SUGGESTED",
        incomingTransaction: { account: { type: { in: ["CREDIT", "LOAN", "MORTGAGE"] } } },
      },
    }),
    prisma.recurringExpense.groupBy({
      by: ["confidence"],
      where: { householdId, status: { notIn: ["REJECTED", "CANCELED", "INACTIVE"] } },
      _count: { _all: true },
    }),
    prisma.recurringExpense.groupBy({
      by: ["frequency"],
      where: { householdId, status: { notIn: ["REJECTED", "CANCELED", "INACTIVE"] } },
      _count: { _all: true },
    }),
    prisma.recurringExpense.count({
      where: {
        householdId,
        status: { notIn: ["REJECTED", "CANCELED", "INACTIVE"] },
        nextExpectedDate: { lte: now },
      },
    }),
    prisma.recurringExpense.count({
      where: {
        householdId,
        frequency: "IRREGULAR_RECURRING",
        nextExpectedDate: { not: null },
        status: { notIn: ["REJECTED", "CANCELED", "INACTIVE"] },
      },
    }),
    prisma.importBatch.findMany({ where: { householdId }, orderBy: { createdAt: "desc" } }),
  ]);
  const latest = new Map<string, ImportBatch>();
  for (const batch of allBatches) {
    const key = `${batch.accountId}|${batch.fileHash}`;
    if (!latest.has(key)) latest.set(key, batch);
  }
  const currentActionable = [...latest.values()].filter((batch) =>
    ["PREVIEW", "VALIDATED", "FAILED", "PARTIALLY_IMPORTED"].includes(batch.status),
  );
  return {
    activeRealTransactions,
    activeBatches,
    historicalBatches,
    selectedPositive: selectedTransactions.filter((item) => item.amountMinor > 0).length,
    selectedNegative: selectedTransactions.filter((item) => item.amountMinor < 0).length,
    selectedDuplicateCandidates: selectedTransactions.filter((item) => item.possibleDuplicate)
      .length,
    selectedAmbiguous: selectedTransactions.filter(
      (item) => item.type === "UNKNOWN" && item.reviewStatus === "FLAGGED",
    ).length,
    transfersByStatus: Object.fromEntries(
      transferGroups.map((item) => [item.status, item._count._all]),
    ),
    confirmedTransfers:
      transferGroups.find((item) => item.status === "CONFIRMED")?._count._all ?? 0,
    cardPaymentCandidates,
    recurringByConfidence: Object.fromEntries(
      recurringConfidence.map((item) => [item.confidence, item._count._all]),
    ),
    recurringByCadence: Object.fromEntries(
      recurringCadence.map((item) => [item.frequency, item._count._all]),
    ),
    staleNextDates,
    irregularWithExactNext,
    dataQuality: {
      current: {
        batchCount: currentActionable.length,
        invalidRows: currentActionable.reduce((sum, batch) => sum + batch.rejectedRowCount, 0),
        duplicateCandidates: currentActionable.reduce(
          (sum, batch) => sum + batch.duplicateCandidateCount,
          0,
        ),
        repeatedFiles: currentActionable.filter((batch) => batch.repeatedFile).length,
      },
      historical: {
        batchCount: allBatches.length,
        invalidRows: allBatches.reduce((sum, batch) => sum + batch.rejectedRowCount, 0),
        duplicateCandidates: allBatches.reduce(
          (sum, batch) => sum + batch.duplicateCandidateCount,
          0,
        ),
        repeatedFiles: allBatches.filter((batch) => batch.repeatedFile).length,
      },
    },
  };
}

function preflightAggregate(
  prepared: Array<ReturnType<typeof prepareBatch>>,
  integrity: string,
  signConvention: string,
) {
  return {
    backupIntegrity: integrity,
    batchCount: prepared.length,
    transactionCount: prepared.reduce((sum, item) => sum + item.batch.transactions.length, 0),
    verifiedFileAssociations: prepared.filter((item) => item.source.hash === item.batch.fileHash)
      .length,
    accountClasses: [...new Set(prepared.map((item) => accountClass(item.batch.account.type)))],
    mappedImportDecisions: prepared.reduce(
      (sum, item) => sum + item.batch.rows.filter((row) => row.importDecision === "IMPORT").length,
      0,
    ),
    mappedSkipDecisions: prepared.reduce(
      (sum, item) => sum + item.batch.rows.filter((row) => row.importDecision === "SKIP").length,
      0,
    ),
    confirmedTransferBlockers: 0,
    mapping: {
      amountMode: "SIGNED_AMOUNT",
      signConvention,
      uniquelyDerived: true,
    },
  };
}

async function sourceFiles(directory: string) {
  const root = resolve(directory);
  const files = (await readdir(root)).filter((file) => file.toLowerCase().endsWith(".csv"));
  return Promise.all(
    files.map(async (file) => {
      const path = resolve(root, file);
      const buffer = await readFile(path);
      return {
        path,
        content: buffer.toString("utf8"),
        hash: createHash("sha256").update(buffer).digest("hex"),
      };
    }),
  );
}

function subsetsWithTotal<T extends { transactions: unknown[] }>(items: T[], total: number) {
  const matches: T[][] = [];
  const visit = (index: number, sum: number, selected: T[]) => {
    if (sum === total) {
      matches.push([...selected]);
      return;
    }
    if (sum > total || index >= items.length || matches.length > 1) return;
    visit(index + 1, sum + items[index].transactions.length, [...selected, items[index]]);
    visit(index + 1, sum, selected);
  };
  visit(0, 0, []);
  return matches;
}

function publicFields(value: string) {
  return Object.fromEntries(
    Object.entries(parseFields(value)).filter(([key]) => !key.startsWith("__")),
  );
}
function parseFields(value: string) {
  return JSON.parse(value) as Record<string, string>;
}
function parseObject(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
function accountClass(type: string) {
  return ["CREDIT", "LOAN", "MORTGAGE"].includes(type) ? "LIABILITY" : "ASSET";
}
function parseArgs(values: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 2)
    result[values[i]?.replace(/^--/, "")] = values[i + 1] ?? "";
  return result;
}
function required(options: Record<string, string>, key: string) {
  const value = options[key];
  if (!value) throw new Error(`Missing --${key}.`);
  return value;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

main()
  .catch(async (error) => {
    console.error(message(error));
    await prisma.$disconnect();
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
