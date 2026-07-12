import { Prisma, PrismaClient } from "@prisma/client";
import { accountSchema } from "@/domain/accounts/schema";
import { categorySchema } from "@/domain/categories/schema";
import { goalContributionSchema, goalSchema } from "@/domain/goals/schema";
import { householdSettingsSchema } from "@/domain/household/schema";
import { transactionUpdateSchema } from "@/domain/transactions/schema";
import { prisma } from "@/server/db/prisma";
import { auditChange, auditFields } from "./audit";
import { AppError } from "./errors";
import { refreshTransferStateForTransactions } from "./transfers";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getHousehold(db: Db = prisma) {
  const household = await db.household.findFirst({
    include: {
      accounts: { orderBy: [{ archivedAt: "asc" }, { type: "asc" }, { name: "asc" }] },
      categories: { orderBy: [{ archivedAt: "asc" }, { group: "asc" }, { sortOrder: "asc" }] },
      goals: {
        include: { contributions: true, linkedAccount: true },
        orderBy: [{ priority: "asc" }],
      },
      transactions: {
        include: { account: true, category: true },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!household) throw new AppError("Household not found. Run npm run db:seed.", 404);
  return household;
}

export async function updateHousehold(input: unknown) {
  const data = householdSettingsSchema.parse(input);
  const existing = await getHousehold();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.household.update({ where: { id: existing.id }, data });
    await auditFields(tx, {
      householdId: existing.id,
      entityType: "Household",
      entityId: existing.id,
      action: "update",
      before: existing,
      after: updated,
      fields: Object.keys(data),
    });
    return updated;
  });
}

export async function createAccount(input: unknown) {
  const data = accountSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({ data });
    await auditChange(tx, {
      householdId: account.householdId,
      entityType: "Account",
      entityId: account.id,
      action: "create",
      source: "user",
    });
    return account;
  });
}

export async function updateAccount(id: string, input: unknown) {
  const data = accountSchema.partial({ householdId: true }).parse(input);
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) throw new AppError("Account not found.", 404);
  if (existing.archivedAt) throw new AppError("Restore the account before editing it.", 409);
  const updated = await prisma.$transaction(async (tx) => {
    const account = await tx.account.update({ where: { id }, data });
    await auditFields(tx, {
      householdId: existing.householdId,
      entityType: "Account",
      entityId: id,
      action: "update",
      before: existing,
      after: account,
      fields: Object.keys(data),
    });
    return account;
  });
  return updated;
}

export async function setAccountArchived(id: string, archived: boolean) {
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) throw new AppError("Account not found.", 404);
  const archivedAt = archived ? new Date() : null;
  const account = await prisma.account.update({
    where: { id },
    data: { archivedAt, status: archived ? "ARCHIVED" : "ACTIVE" },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "Account",
    entityId: id,
    action: archived ? "archive" : "restore",
    field: "archivedAt",
    previousValue: existing.archivedAt,
    newValue: archivedAt,
  });
  return account;
}

export async function validateCategoryParent(
  db: Db,
  householdId: string,
  categoryId: string | null | undefined,
  parentId: string | null | undefined,
) {
  if (!parentId) return;
  if (categoryId && parentId === categoryId)
    throw new AppError("A category cannot be its own parent.", 422);
  const parent = await db.category.findUnique({ where: { id: parentId } });
  if (!parent || parent.householdId !== householdId)
    throw new AppError("Parent category not found for household.", 422);
  let cursor = parent.parentId;
  while (cursor) {
    if (cursor === categoryId) throw new AppError("Category parent would create a cycle.", 422);
    const next = await db.category.findUnique({ where: { id: cursor } });
    cursor = next?.parentId ?? null;
  }
}

export async function createCategory(input: unknown) {
  const data = categorySchema.parse(input);
  await validateCategoryParent(prisma, data.householdId, null, data.parentId);
  const category = await prisma.category.create({ data });
  await auditChange(prisma, {
    householdId: category.householdId,
    entityType: "Category",
    entityId: category.id,
    action: "create",
  });
  return category;
}

export async function updateCategory(id: string, input: unknown) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found.", 404);
  if (existing.archivedAt) throw new AppError("Restore the category before editing it.", 409);
  const data = categorySchema.partial({ householdId: true }).parse(input);
  await validateCategoryParent(prisma, existing.householdId, id, data.parentId);
  const category = await prisma.category.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "Category",
    entityId: id,
    action: "update",
    before: existing,
    after: category,
    fields: Object.keys(data),
  });
  return category;
}

export async function setCategoryArchived(id: string, archived: boolean) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found.", 404);
  const archivedAt = archived ? new Date() : null;
  const category = await prisma.category.update({ where: { id }, data: { archivedAt } });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "Category",
    entityId: id,
    action: archived ? "archive" : "restore",
    field: "archivedAt",
    previousValue: existing.archivedAt,
    newValue: archivedAt,
  });
  return category;
}

export async function createGoal(input: unknown) {
  const data = goalSchema.parse(input);
  const goal = await prisma.goal.create({ data });
  await auditChange(prisma, {
    householdId: goal.householdId,
    entityType: "Goal",
    entityId: goal.id,
    action: "create",
  });
  return goal;
}

export async function updateGoal(id: string, input: unknown) {
  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing) throw new AppError("Goal not found.", 404);
  if (existing.archivedAt) throw new AppError("Restore the goal before editing it.", 409);
  const data = goalSchema.partial({ householdId: true }).parse(input);
  const goal = await prisma.goal.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "Goal",
    entityId: id,
    action: "update",
    before: existing,
    after: goal,
    fields: Object.keys(data),
  });
  return goal;
}

export async function contributeToGoal(id: string, input: unknown) {
  const data = goalContributionSchema.parse(input);
  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing) throw new AppError("Goal not found.", 404);
  if (existing.archivedAt) throw new AppError("Restore the goal before contributing.", 409);
  return prisma.$transaction(async (tx) => {
    const contribution = await tx.goalContribution.create({ data: { ...data, goalId: id } });
    const goal = await tx.goal.update({
      where: { id },
      data: { currentMinor: { increment: data.amountMinor } },
    });
    await auditChange(tx, {
      householdId: existing.householdId,
      entityType: "GoalContribution",
      entityId: contribution.id,
      action: "create",
      field: "amountMinor",
      newValue: data.amountMinor,
    });
    await auditChange(tx, {
      householdId: existing.householdId,
      entityType: "Goal",
      entityId: id,
      action: "contribute",
      field: "currentMinor",
      previousValue: existing.currentMinor,
      newValue: goal.currentMinor,
    });
    return { goal, contribution };
  });
}

export async function setGoalArchived(id: string, archived: boolean) {
  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing) throw new AppError("Goal not found.", 404);
  const archivedAt = archived ? new Date() : null;
  const goal = await prisma.goal.update({
    where: { id },
    data: { archivedAt, status: archived ? "ARCHIVED" : "ACTIVE" },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "Goal",
    entityId: id,
    action: archived ? "archive" : "restore",
    field: "archivedAt",
    previousValue: existing.archivedAt,
    newValue: archivedAt,
  });
  return goal;
}

export async function updateTransactionEditable(id: string, input: unknown) {
  const data = transactionUpdateSchema.parse(input);
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!existing) throw new AppError("Transaction not found.", 404);
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.householdId !== existing.householdId || category.archivedAt) {
      throw new AppError("Category is invalid for this transaction.", 422);
    }
  }
  const transaction = await prisma.transaction.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "Transaction",
    entityId: id,
    action: "normalize",
    before: existing,
    after: transaction,
    fields: ["normalizedMerchant", "categoryId", "type", "reviewStatus", "excluded", "notes"],
  });
  await refreshTransferStateForTransactions([id]);
  return transaction;
}

export async function transactionAudit(id: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "Transaction", entityId: id },
    orderBy: { createdAt: "desc" },
  });
}

export async function resetDemoData() {
  const { seedDemoData } = await import("./seed-demo");
  return seedDemoData("reset");
}
