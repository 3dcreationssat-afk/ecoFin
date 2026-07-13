import { currentPeriodSummary } from "@/domain/summaries/calculations";
import { prisma } from "@/server/db/prisma";
import { auditChange } from "./audit";
import { recalculateAccountBalances } from "./account-balances";
import { scanRecurringExpenses } from "./recurring";
import { refreshTransferStateForTransactions } from "./transfers";

export type ExpectedAccountCondition =
  { kind: "CLASS"; value: "ASSET" | "LIABILITY" } | { kind: "TYPE"; value: string };

export type ImportRepairRequest = {
  batchIds: string[];
  expectedRecordCount: number;
  expectedAccount: ExpectedAccountCondition;
  expectedSignConvention: "DEBITS_NEGATIVE" | "DEBITS_POSITIVE";
};

export type ImportRepairInspection = {
  safeToApply: boolean;
  eligibleRecordCount: number;
  batchCount: number;
  batches: Array<{
    ordinal: number;
    recordCount: number;
    amountMode: string | null;
    signConvention: string | null;
    provenance: "BATCH_SNAPSHOT" | "PROFILE" | "UNPROVEN";
  }>;
  ambiguousSemanticCount: number;
  projectedNegativeCount: number;
  projectedPositiveCount: number;
  accountStates: Array<{ accountClass: "ASSET" | "LIABILITY"; ledgerStatus: string }>;
  reportChecks: {
    purchasesExcludedFromIncome: boolean;
    creditsExcludedFromSpending: boolean;
    confirmedTransfersExcluded: boolean;
    currentMonthRecomputed: boolean;
    authoritative: false;
    limitation: string;
  };
  issues: string[];
};

export async function inspectImportSemanticsRepair(
  request: ImportRepairRequest,
): Promise<ImportRepairInspection> {
  const uniqueBatchIds = [...new Set(request.batchIds)];
  const batches = await prisma.importBatch.findMany({
    where: { id: { in: uniqueBatchIds } },
    include: {
      account: true,
      importProfile: true,
      rows: { orderBy: { rowNumber: "asc" } },
      transactions: {
        include: {
          outgoingTransferMatches: { select: { status: true } },
          incomingTransferMatches: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const issues: string[] = [];
  if (batches.length !== uniqueBatchIds.length)
    issues.push("One or more selected batches do not exist.");
  const inspected = batches.map((batch, index) => {
    const mapping = persistedMapping(batch.summaryJson, batch.importProfile);
    if (!["IMPORTED", "PARTIALLY_IMPORTED"].includes(batch.status))
      issues.push(`Batch ${index + 1} is not an active imported batch.`);
    if (!matchesExpectedAccount(batch.account.type, request.expectedAccount))
      issues.push(`Batch ${index + 1} does not satisfy the expected account safety condition.`);
    if (mapping.amountMode !== "SIGNED_AMOUNT")
      issues.push(`Batch ${index + 1} was not proven to use signed-amount import mode.`);
    if (mapping.signConvention !== request.expectedSignConvention)
      issues.push(`Batch ${index + 1} does not prove the expected sign convention.`);
    if (batch.transactions.length !== batch.importedTransactionCount)
      issues.push(`Batch ${index + 1} transaction count no longer matches its import audit count.`);
    for (const transaction of batch.transactions) {
      const row = batch.rows.find((item) => item.id === transaction.importRowId);
      if (!row || row.createdTransactionId !== transaction.id || row.importDecision !== "IMPORT")
        issues.push(
          `Batch ${index + 1} contains an unsupported transaction-to-row provenance state.`,
        );
    }
    return {
      ordinal: index + 1,
      recordCount: batch.transactions.length,
      amountMode: mapping.amountMode,
      signConvention: mapping.signConvention,
      provenance: mapping.provenance,
    };
  });
  const transactions = batches.flatMap((batch) => batch.transactions);
  if (transactions.length !== request.expectedRecordCount)
    issues.push(
      `Eligible record count is ${transactions.length}; expected ${request.expectedRecordCount}.`,
    );
  const projected = transactions.map((transaction) => ({
    ...transaction,
    amountMinor: canonicalRepairAmount(transaction.amountMinor, request.expectedSignConvention),
    semantic: classifySemantics(
      transaction.originalDescription,
      {},
      canonicalRepairAmount(transaction.amountMinor, request.expectedSignConvention),
    ),
  }));
  const householdIds = [...new Set(transactions.map((item) => item.householdId))];
  if (householdIds.length !== 1) issues.push("Selected batches span more than one household.");
  const allTransactions = householdIds.length
    ? await prisma.transaction.findMany({ where: { householdId: householdIds[0] } })
    : [];
  const projectedById = new Map(projected.map((item) => [item.id, item]));
  const projectedHousehold = allTransactions.map((transaction) => {
    const replacement = projectedById.get(transaction.id);
    return replacement
      ? {
          ...transaction,
          amountMinor: replacement.amountMinor,
          type: replacement.semantic.type,
          reviewStatus: replacement.semantic.ambiguous ? "FLAGGED" : transaction.reviewStatus,
          affectsLedger: true,
        }
      : transaction;
  });
  currentPeriodSummary(projectedHousehold);
  const purchases = projected.filter((item) => item.amountMinor < 0 && !item.semantic.ambiguous);
  const credits = projected.filter((item) => item.amountMinor > 0 && !item.semantic.ambiguous);
  const confirmedTransfers = projectedHousehold.filter((item) =>
    ["TRANSFER_IN", "TRANSFER_OUT"].includes(item.type),
  );
  return {
    safeToApply: issues.length === 0,
    eligibleRecordCount: transactions.length,
    batchCount: batches.length,
    batches: inspected,
    ambiguousSemanticCount: projected.filter((item) => item.semantic.ambiguous).length,
    projectedNegativeCount: projected.filter((item) => item.amountMinor < 0).length,
    projectedPositiveCount: projected.filter((item) => item.amountMinor > 0).length,
    accountStates: [
      ...new Map(batches.map((batch) => [batch.account.id, batch.account])).values(),
    ].map((account) => ({
      accountClass: accountClass(account.type),
      ledgerStatus: account.ledgerStatus,
    })),
    reportChecks: {
      purchasesExcludedFromIncome: purchases.every((item) => item.semantic.type !== "CREDIT"),
      creditsExcludedFromSpending: credits.every((item) => item.semantic.type !== "DEBIT"),
      confirmedTransfersExcluded: confirmedTransfers.every(
        (item) => item.affectsIncomeSpendingReports === false,
      ),
      currentMonthRecomputed: true,
      authoritative: false,
      limitation:
        "Totals remain non-authoritative until account anchors, categories, and household configuration are complete.",
    },
    issues: [...new Set(issues)],
  };
}

export async function applyImportSemanticsRepair(
  request: ImportRepairRequest,
  confirmation: "APPLY IMPORT SEMANTICS REPAIR",
) {
  if (confirmation !== "APPLY IMPORT SEMANTICS REPAIR")
    throw new Error("Explicit confirmation required.");
  const inspection = await inspectImportSemanticsRepair(request);
  if (!inspection.safeToApply) throw new Error(`Repair refused: ${inspection.issues.join(" ")}`);
  const batches = await prisma.importBatch.findMany({
    where: { id: { in: request.batchIds } },
    include: { rows: true, transactions: true },
  });
  const transactionIds: string[] = [];
  const accountIds = new Set<string>();
  const householdIds = new Set<string>();
  await prisma.$transaction(async (tx) => {
    for (const batch of batches) {
      const rows = new Map(batch.rows.map((row) => [row.id, row]));
      for (const transaction of batch.transactions) {
        const row = rows.get(transaction.importRowId!);
        if (!row || row.parsedAmountMinor === null)
          throw new Error("Import provenance changed after dry run.");
        const sourceFields = parseObject(row.sourceFieldsJson);
        const amountMinor = canonicalRepairAmount(
          transaction.amountMinor,
          request.expectedSignConvention,
        );
        const semantic = classifySemantics(
          transaction.originalDescription,
          sourceFields,
          amountMinor,
        );
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            amountMinor,
            type: semantic.type,
            typeSource: semantic.source,
            reviewStatus: semantic.ambiguous ? "FLAGGED" : transaction.reviewStatus,
            affectsLedger: true,
          },
        });
        await tx.importRow.update({
          where: { id: row.id },
          data: {
            parsedAmountMinor: canonicalRepairAmount(
              row.parsedAmountMinor,
              request.expectedSignConvention,
            ),
          },
        });
        await auditChange(tx, {
          householdId: transaction.householdId,
          entityType: "Transaction",
          entityId: transaction.id,
          action: "import_semantics_repaired",
          field: "amountMinor",
          previousValue: transaction.amountMinor,
          newValue: amountMinor,
          reason: "Canonical economic sign normalized from persisted import convention.",
          source: "import_repair",
        });
        await auditChange(tx, {
          householdId: transaction.householdId,
          entityType: "ImportRow",
          entityId: row.id,
          action: "parsed_amount_repaired",
          field: "parsedAmountMinor",
          previousValue: row.parsedAmountMinor,
          newValue: canonicalRepairAmount(row.parsedAmountMinor, request.expectedSignConvention),
          source: "import_repair",
        });
        transactionIds.push(transaction.id);
        accountIds.add(transaction.accountId);
        householdIds.add(transaction.householdId);
      }
    }
    await recalculateAccountBalances([...accountIds], tx);
  });
  await refreshTransferStateForTransactions(transactionIds);
  for (const householdId of householdIds) await scanRecurringExpenses({ householdId });
  return { repairedCount: transactionIds.length, accountCount: accountIds.size };
}

export function canonicalRepairAmount(
  amountMinor: number,
  sourceConvention: "DEBITS_NEGATIVE" | "DEBITS_POSITIVE",
) {
  return sourceConvention === "DEBITS_POSITIVE" ? amountMinor * -1 : amountMinor;
}

export function classifySemantics(
  description: string,
  sourceFields: Record<string, unknown>,
  canonicalAmountMinor: number,
) {
  const explicit = Object.entries(sourceFields).find(([key]) =>
    ["type", "transactiontype", "transaction type"].includes(key.trim().toLowerCase()),
  )?.[1];
  const normalized =
    typeof explicit === "string" ? explicit.trim().toUpperCase().replace(/[ -]+/g, "_") : null;
  const reliable: Record<string, string> = {
    PURCHASE: "DEBIT",
    SALE: "DEBIT",
    DEBIT: "DEBIT",
    REFUND: "REFUND",
    CREDIT: "CREDIT",
    FEE: "FEE",
    INTEREST: "INTEREST",
  };
  const reliableType = normalized ? reliable[normalized] : null;
  const reliableDirectionMatches = reliableType
    ? ["DEBIT", "FEE", "INTEREST"].includes(reliableType)
      ? canonicalAmountMinor < 0
      : canonicalAmountMinor > 0
    : false;
  if (reliableType && reliableDirectionMatches)
    return { type: reliableType, source: "IMPORT_SOURCE", ambiguous: false };
  const ambiguous =
    Boolean(
      normalized &&
      ["PAYMENT", "ADJUSTMENT", "REWARD", "REVERSAL", "CHARGEBACK"].includes(normalized),
    ) ||
    Boolean(reliableType && !reliableDirectionMatches) ||
    /\b(payment|refund|credit|fee|reward|adjustment|reversal|chargeback)\b/i.test(description);
  return {
    type: ambiguous ? "UNKNOWN" : canonicalAmountMinor < 0 ? "DEBIT" : "CREDIT",
    source: ambiguous ? "IMPORT_REPAIR_REVIEW" : "IMPORT_ECONOMIC_DIRECTION",
    ambiguous,
  };
}

function persistedMapping(
  summaryJson: string | null,
  profile: { amountMode: string; signConvention: string } | null,
) {
  const summary = parseObject(summaryJson);
  const mapping =
    summary.mapping && typeof summary.mapping === "object"
      ? (summary.mapping as Record<string, unknown>)
      : null;
  if (mapping)
    return {
      amountMode: typeof mapping.amountMode === "string" ? mapping.amountMode : null,
      signConvention: typeof mapping.signConvention === "string" ? mapping.signConvention : null,
      provenance: "BATCH_SNAPSHOT" as const,
    };
  if (profile)
    return {
      amountMode: profile.amountMode,
      signConvention: profile.signConvention,
      provenance: "PROFILE" as const,
    };
  return { amountMode: null, signConvention: null, provenance: "UNPROVEN" as const };
}

function matchesExpectedAccount(type: string, expected: ExpectedAccountCondition) {
  return expected.kind === "TYPE" ? type === expected.value : accountClass(type) === expected.value;
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
