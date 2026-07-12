import { prisma } from "@/server/db/prisma";
import { bulkActionSchema, ruleTransactionTypes } from "@/domain/merchant-rules/rules";
import { AppError } from "./errors";
import { auditChange, auditFields } from "./audit";
import { reapplyRulesToSelected } from "./merchant-rules";

export async function bulkUpdateTransactions(input: unknown) {
  const data = bulkActionSchema.parse(input);
  if (data.action === "REAPPLY_RULES") return reapplyRulesToSelected(data.transactionIds);
  const household = await prisma.household.findFirst({ select: { id: true } });
  if (!household) throw new AppError("Household not found.", 404);
  const uniqueIds = [...new Set(data.transactionIds)];
  if (
    ["EXCLUDE", "RESTORE", "SET_TYPE"].includes(data.action) &&
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
        (data.action === "SET_TYPE" && confirmedTransfer) ||
        (["SET_TYPE", "NORMALIZE_MERCHANT"].includes(data.action) && confirmedRecurring)
      );
    });
    if (ineligible.length)
      throw new AppError(
        `${ineligible.length} selected transaction(s) are protected by confirmed transfer or recurring relationships. Nothing was changed.`,
        409,
      );
    const operationId = crypto.randomUUID();
    for (const transaction of transactions) {
      const update =
        data.action === "ASSIGN_CATEGORY"
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
    }
    await auditChange(tx, {
      householdId: household.id,
      entityType: "BulkTransactionOperation",
      entityId: operationId,
      action: data.action,
      field: "transactionCount",
      previousValue: 0,
      newValue: transactions.length,
      source: "bulk_user",
    });
    return {
      operationId,
      selected: uniqueIds.length,
      eligible: uniqueIds.length,
      skipped: 0,
      changed: transactions.length,
    };
  });
}
