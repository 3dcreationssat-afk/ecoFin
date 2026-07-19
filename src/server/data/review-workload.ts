import { createHash } from "node:crypto";
import { detectPayrollCandidates } from "@/domain/forecast/payroll-detection";
import { prisma } from "@/server/db/prisma";
import { AppError } from "./errors";

export async function reviewWorkloadReport() {
  const household = await prisma.household.findFirst({ select: { id: true } });
  if (!household) throw new AppError("Household not found.", 404);
  const transactions = await prisma.transaction.findMany({
    where: { householdId: household.id },
    select: {
      id: true,
      reviewStatus: true,
      reviewSource: true,
      typeSource: true,
      categorySource: true,
      interpretationAutoApplied: true,
      interpretationConfidence: true,
      interpretationReviewRequired: true,
      possibleDuplicate: true,
      excluded: true,
      sourceType: true,
      householdId: true,
      accountId: true,
      normalizedMerchant: true,
      originalDescription: true,
      amountMinor: true,
      transactionDate: true,
      postedDate: true,
      type: true,
      affectsLedger: true,
      clearingStatus: true,
      account: { select: { id: true, name: true, type: true } },
      outgoingTransferMatches: { select: { status: true } },
      incomingTransferMatches: { select: { status: true } },
    },
    take: 50_000,
  });
  const [
    automaticTransfers,
    recurringLinked,
    recurringPatterns,
    importBatches,
    accountDecisions,
    balanceAmbiguities,
  ] = await Promise.all([
    prisma.transferMatch.count({
      where: { householdId: household.id, status: "CONFIRMED", source: "AUTOMATIC_CONFIRMED" },
    }),
    prisma.recurringExpenseTransaction.count({
      where: { recurringExpense: { householdId: household.id }, included: true },
    }),
    prisma.recurringExpense.count({
      where: { householdId: household.id, status: { notIn: ["REJECTED", "CANCELED"] } },
    }),
    prisma.importBatch.count({ where: { householdId: household.id, status: "COMPLETED" } }),
    prisma.plaidAccount.count({
      where: {
        item: { householdId: household.id },
        matchStatus: { in: ["UNMATCHED", "PROPOSED", "DEFERRED"] },
      },
    }),
    prisma.account.count({
      where: {
        householdId: household.id,
        archivedAt: null,
        OR: [
          { ledgerStatus: { not: "RECONCILED" } },
          { reconciliationDifferenceMinor: { not: 0 } },
        ],
      },
    }),
  ]);
  const processed = transactions.length;
  const automaticallyClassified = transactions.filter(
    (transaction) =>
      transaction.interpretationAutoApplied ||
      ["INTERPRETATION", "MERCHANT_RULE", "TRANSFER"].includes(transaction.typeSource) ||
      transaction.categorySource === "MERCHANT_RULE",
  ).length;
  const provisionallyClassified = transactions.filter(
    (transaction) =>
      Boolean(transaction.interpretationConfidence) &&
      !transaction.interpretationAutoApplied &&
      transaction.interpretationReviewRequired,
  ).length;
  const latestObserved = transactions.reduce(
    (latest, transaction) =>
      Math.max(latest, (transaction.postedDate ?? transaction.transactionDate).getTime()),
    0,
  );
  const payrollCandidates = detectPayrollCandidates(
    transactions,
    latestObserved ? new Date(latestObserved + 7 * 86_400_000) : new Date(),
  );
  const payrollTransactions = new Set(
    payrollCandidates.flatMap((candidate) => candidate.transactionIds),
  ).size;
  const remaining = transactions.filter(
    (transaction) =>
      transaction.reviewStatus !== "REVIEWED" ||
      transaction.interpretationReviewRequired ||
      transaction.possibleDuplicate,
  );
  const reasons = {
    needsReview: remaining.filter((item) => item.reviewStatus === "NEEDS_REVIEW").length,
    flagged: remaining.filter((item) => item.reviewStatus === "FLAGGED").length,
    interpretationException: remaining.filter((item) => item.interpretationReviewRequired).length,
    possibleDuplicate: remaining.filter((item) => item.possibleDuplicate).length,
  };
  const baselineManualReview = processed;
  const remainingManualReview = new Set(remaining.map((item) => item.id)).size;
  const avoidedManualReview = Math.max(0, baselineManualReview - remainingManualReview);
  return {
    generatedAt: new Date(),
    processed,
    importBatches,
    sources: {
      csv: transactions.filter((item) => item.sourceType === "CSV_IMPORT").length,
      plaid: transactions.filter((item) => item.sourceType === "BANK_CONNECTION").length,
      manual: transactions.filter((item) => item.sourceType === "MANUAL").length,
    },
    baseline: { manualReviewItems: baselineManualReview },
    after: {
      automaticallyClassified,
      provisionallyClassified,
      payrollTransactionsIdentified: payrollTransactions,
      payrollPatternsIdentified: payrollCandidates.length,
      automaticallyConfirmedTransferPairs: automaticTransfers,
      recurringPatternsIdentified: recurringPatterns,
      recurringEvidenceLinks: recurringLinked,
      duplicateCandidates: transactions.filter((item) => item.possibleDuplicate).length,
      accountDecisionsRequired: accountDecisions,
      balanceAmbiguities,
      remainingManualReview,
      avoidedManualReview,
      reductionBasisPoints:
        baselineManualReview === 0
          ? 0
          : Math.round((avoidedManualReview * 10_000) / baselineManualReview),
    },
    exceptionReasons: reasons,
    mandatoryReviewCases: remaining.map((transaction) => ({
      reference: createHash("sha256").update(transaction.id).digest("hex").slice(0, 10),
      reasons: [
        ...(transaction.reviewStatus !== "REVIEWED" ? [transaction.reviewStatus] : []),
        ...(transaction.interpretationReviewRequired ? ["INTERPRETATION_EXCEPTION"] : []),
        ...(transaction.possibleDuplicate ? ["POSSIBLE_DUPLICATE"] : []),
      ],
    })),
    methodology:
      "Baseline assumes every normalized transaction required review. After counts unique transactions still not reviewed, flagged, interpretation-exception, or possible-duplicate. Transfer pairs and recurring links are reported separately to avoid double counting.",
  };
}
