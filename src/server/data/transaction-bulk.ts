import { prisma } from "@/server/db/prisma";
import { bulkActionSchema, ruleTransactionTypes } from "@/domain/merchant-rules/rules";
import { AppError } from "./errors";
import { auditChange, auditFields } from "./audit";
import { reapplyRulesToSelected } from "./merchant-rules";
import { recommendTransactionReview } from "@/domain/transactions/review";

export async function bulkUpdateTransactions(input: unknown) {
  const data = bulkActionSchema.parse(input);
  if (data.action === "REAPPLY_RULES") return reapplyRulesToSelected(data.transactionIds);
  const household = await prisma.household.findFirst({ select: { id: true } });
  if (!household) throw new AppError("Household not found.", 404);
  const uniqueIds = [...new Set(data.transactionIds)];
  if (
    ["EXCLUDE", "RESTORE", "SET_TYPE", "APPLY_REVIEW_RECOMMENDATIONS"].includes(data.action) &&
    data.confirmation !== "CONFIRM BULK CHANGE"
  )
    throw new AppError("Confirm the reporting-impacting bulk change.", 422);
  if (data.action === "ASSIGN_CATEGORY" && !data.value)
    throw new AppError("Choose a category.", 422);
  if (data.action === "NORMALIZE_MERCHANT" && !data.value)
    throw new AppError("Enter a normalized merchant.", 422);
  if (data.action === "SET_TYPE" && !ruleTransactionTypes.includes(data.value as never))
    throw new AppError("Choose a supported safe transaction type.", 422);
  return prisma.$transaction(async (tx) => {
    const transactions = await tx.transaction.findMany({
      where: { id: { in: uniqueIds }, householdId: household.id },
      include: {
        account: { select: { type: true } },
        outgoingTransferMatches: true,
        incomingTransferMatches: true,
        recurringLinks: { include: { recurringExpense: true } },
      },
    });
    if (transactions.length !== uniqueIds.length)
      throw new AppError(
        "A selected transaction is stale, missing, or outside this household. Nothing was changed.",
        409,
      );
    if (data.action === "ASSIGN_CATEGORY") {
      const category = await tx.category.findFirst({
        where: { id: data.value, householdId: household.id, archivedAt: null },
      });
      if (!category) throw new AppError("Category is invalid or archived.", 422);
    }
    const ineligible = transactions.filter((transaction) => {
      const confirmedTransfer = [
        ...transaction.outgoingTransferMatches,
        ...transaction.incomingTransferMatches,
      ].some((match) => match.status === "CONFIRMED");
      const confirmedRecurring = transaction.recurringLinks.some(
        (link) => link.recurringExpense.status === "CONFIRMED",
      );
      return (
        (["SET_TYPE", "APPLY_REVIEW_RECOMMENDATIONS"].includes(data.action) && confirmedTransfer) ||
        (["SET_TYPE", "NORMALIZE_MERCHANT", "APPLY_REVIEW_RECOMMENDATIONS"].includes(data.action) &&
          confirmedRecurring)
      );
    });
    if (ineligible.length)
      throw new AppError(
        `${ineligible.length} selected transaction(s) are protected by confirmed transfer or recurring relationships. Nothing was changed.`,
        409,
      );
    const operationId = crypto.randomUUID();
    let changed = 0;
    let skipped = 0;
    for (const transaction of transactions) {
      const recommendation =
        data.action === "APPLY_REVIEW_RECOMMENDATIONS" && transaction.reviewStatus === "FLAGGED"
          ? recommendTransactionReview(transaction)
          : null;
      if (data.action === "APPLY_REVIEW_RECOMMENDATIONS" && !recommendation) {
        skipped += 1;
        continue;
      }
      const update = recommendation
        ? {
            type: recommendation.type,
            typeSource: "BULK_USER",
            reviewStatus: "REVIEWED",
            reviewSource: "BULK_USER",
            affectsIncomeSpendingReports: transaction.excluded
              ? false
              : recommendation.affectsIncomeSpendingReports,
          }
        : data.action === "ASSIGN_CATEGORY"
          ? { categoryId: data.value, categorySource: "BULK_USER" }
          : data.action === "MARK_REVIEWED"
            ? { reviewStatus: "REVIEWED", reviewSource: "BULK_USER" }
            : data.action === "MARK_NEEDS_REVIEW"
              ? { reviewStatus: "NEEDS_REVIEW", reviewSource: "BULK_USER" }
              : data.action === "EXCLUDE"
                ? { excluded: true, affectsIncomeSpendingReports: false }
                : data.action === "RESTORE"
                  ? { excluded: false, affectsIncomeSpendingReports: true }
                  : data.action === "SET_TYPE"
                    ? { type: data.value, typeSource: "BULK_USER" }
                    : { normalizedMerchant: data.value, merchantSource: "BULK_USER" };
      const updated = await tx.transaction.update({ where: { id: transaction.id }, data: update });
      await auditFields(tx, {
        householdId: household.id,
        entityType: "Transaction",
        entityId: transaction.id,
        action: `bulk_${data.action.toLocaleLowerCase()}`,
        before: transaction,
        after: updated,
        fields: Object.keys(update).filter((field) => !field.endsWith("Source")),
        source: "bulk_user",
      });
      changed += 1;
    }
    await auditChange(tx, {
      householdId: household.id,
      entityType: "BulkTransactionOperation",
      entityId: operationId,
      action: data.action,
      field: "transactionCount",
      previousValue: 0,
      newValue: changed,
      source: "bulk_user",
    });
    return {
      operationId,
      selected: uniqueIds.length,
      eligible: changed,
      skipped,
      changed,
    };
  });
}
