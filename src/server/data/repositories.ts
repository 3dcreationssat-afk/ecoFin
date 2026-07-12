import { createHash } from "node:crypto";
import { basename } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { accountSchema } from "@/domain/accounts/schema";
import { activeSqlitePath } from "@/domain/backup/backup";
import { categorySchema } from "@/domain/categories/schema";
import { DEMO_RESET_CONFIRMATION, demoResetSchema } from "@/domain/demo-reset/schema";
import { goalContributionSchema, goalSchema } from "@/domain/goals/schema";
import { householdSettingsSchema } from "@/domain/household/schema";
import { transactionUpdateSchema } from "@/domain/transactions/schema";
import {
  START_FRESH_CONFIRMATION,
  startFreshSchema,
  type WorkspaceState,
} from "@/domain/workspace/schema";
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
    const account = await tx.account.create({ data: { ...data, isDemo: false } });
    await markWorkspaceUserData(tx, account.householdId);
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
  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.category.create({ data: { ...data, isDemo: false } });
    await markWorkspaceUserData(tx, created.householdId);
    await auditChange(tx, {
      householdId: created.householdId,
      entityType: "Category",
      entityId: created.id,
      action: "create",
    });
    return created;
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
  const goal = await prisma.$transaction(async (tx) => {
    const created = await tx.goal.create({ data: { ...data, isDemo: false } });
    await markWorkspaceUserData(tx, created.householdId);
    await auditChange(tx, {
      householdId: created.householdId,
      entityType: "Goal",
      entityId: created.id,
      action: "create",
    });
    return created;
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
  const { refreshRecurringForTransactions } = await import("./recurring");
  await refreshRecurringForTransactions([id]);
  return transaction;
}

export async function transactionAudit(id: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "Transaction", entityId: id },
    orderBy: { createdAt: "desc" },
  });
}

export async function resetDemoData() {
  return resetDemoDataWithResult({ confirmation: DEMO_RESET_CONFIRMATION });
}

export async function resetDemoDataWithResult(input: unknown) {
  const data = demoResetSchema.parse(input);
  if (data.confirmation !== DEMO_RESET_CONFIRMATION) {
    throw new AppError("Type RESET DEMO DATA to confirm the single-household demo reset.", 422);
  }
  if (data.simulateFailure && process.env.NODE_ENV !== "test") {
    throw new AppError("Reset failure simulation is only available in tests.", 403);
  }
  if (data.simulateFailure) {
    throw new AppError("Simulated demo reset failure.", 500);
  }
  const { seedDemoData } = await import("./seed-demo");
  const result = await prisma.$transaction(async (tx) => {
    const household = await seedDemoData("reset", tx);
    await auditChange(tx, {
      householdId: household.id,
      entityType: "Household",
      entityId: household.id,
      action: "demo_reset",
      field: "demoData",
      newValue: "canonical synthetic dataset",
      source: "reset",
    });
    const counts = await demoResetCounts(tx);
    return { household, counts };
  });
  return {
    ok: true,
    message: "Demonstration data was reset.",
    ...result,
    database: activeDatabaseDiagnostic(),
    resetAt: new Date().toISOString(),
  };
}

export async function startFreshWorkspace(input: unknown) {
  const data = startFreshSchema.parse(input);
  if (data.confirmation !== START_FRESH_CONFIRMATION) {
    throw new AppError("Type START FRESH to confirm removing the sample workspace.", 422);
  }
  if (data.simulateFailure && process.env.NODE_ENV !== "test") {
    throw new AppError("Start-fresh failure simulation is only available in tests.", 403);
  }
  if (data.simulateFailure) throw new AppError("Simulated start-fresh failure.", 500);

  return prisma.$transaction(async (tx) => {
    const before = await demoResetCounts(tx);
    await tx.auditLog.deleteMany();
    await tx.recurringExpenseTransaction.deleteMany();
    await tx.recurringExpense.deleteMany();
    await tx.transferMatch.deleteMany();
    await tx.importRow.deleteMany();
    await tx.transaction.deleteMany();
    await tx.importBatch.deleteMany();
    await tx.importProfile.deleteMany();
    await tx.goalContribution.deleteMany();
    await tx.goal.deleteMany();
    await tx.category.deleteMany();
    await tx.account.deleteMany();
    await tx.household.deleteMany();
    const household = await tx.household.create({
      data: {
        name: "My Household",
        currency: "USD",
        financialMonthStart: 1,
        incomeSchedule: "BI_WEEKLY",
        checkingBufferMinor: 0,
        emergencyFundTargetMinor: 0,
        debtStrategy: "AVALANCHE",
        workspaceMode: "EMPTY",
      },
    });
    await auditChange(tx, {
      householdId: household.id,
      entityType: "Household",
      entityId: household.id,
      action: "workspace_start_fresh",
      field: "workspaceMode",
      newValue: "EMPTY",
      source: "workspace",
    });
    const after = await demoResetCounts(tx);
    return {
      ok: true,
      message: "Fresh workspace is ready.",
      household,
      before,
      after,
      workspaceState: "EMPTY" as WorkspaceState,
      database: activeDatabaseDiagnostic(),
      resetAt: new Date().toISOString(),
    };
  });
}

export async function demoResetCounts(db: Db = prisma) {
  const [
    households,
    accounts,
    categories,
    goals,
    goalContributions,
    transactions,
    importBatches,
    transferMatches,
    recurringExpenses,
    recurringLinks,
    auditEvents,
  ] = await Promise.all([
    db.household.count(),
    db.account.count(),
    db.category.count(),
    db.goal.count(),
    db.goalContribution.count(),
    db.transaction.count(),
    db.importBatch.count(),
    db.transferMatch.count(),
    db.recurringExpense.count(),
    db.recurringExpenseTransaction.count(),
    db.auditLog.count(),
  ]);
  return {
    households,
    accounts,
    categories,
    goals,
    goalContributions,
    transactions,
    importBatches,
    transferMatches,
    recurringExpenses,
    recurringLinks,
    auditEvents,
  };
}

export async function workspaceState(db: Db = prisma): Promise<WorkspaceState> {
  const household = await db.household.findFirst();
  if (!household) return "EMPTY";
  const [demoRecords, userRecords, meaningfulRecords] = await Promise.all([
    countProvenanceRecords(db, true),
    countProvenanceRecords(db, false),
    countMeaningfulFinancialRecords(db),
  ]);
  if (demoRecords > 0 && userRecords > 0) return "MIXED";
  if (demoRecords > 0 && userRecords === 0 && household.workspaceMode === "DEMONSTRATION") {
    return "DEMONSTRATION";
  }
  if (meaningfulRecords === 0) return "EMPTY";
  return "USER_DATA";
}

async function markWorkspaceUserData(db: Db, householdId: string) {
  const demoRecords = await countProvenanceRecords(db, true);
  await db.household.update({
    where: { id: householdId },
    data: { workspaceMode: demoRecords > 0 ? "MIXED" : "USER_DATA" },
  });
}

async function countProvenanceRecords(db: Db, isDemo: boolean) {
  const [accounts, categories, goals, transactions] = await Promise.all([
    db.account.count({ where: { isDemo } }),
    db.category.count({ where: { isDemo } }),
    db.goal.count({ where: { isDemo } }),
    db.transaction.count({ where: { isDemo } }),
  ]);
  return accounts + categories + goals + transactions;
}

async function countMeaningfulFinancialRecords(db: Db) {
  const [accounts, categories, goals, transactions, imports, transfers, recurring] =
    await Promise.all([
      db.account.count(),
      db.category.count(),
      db.goal.count(),
      db.transaction.count(),
      db.importBatch.count(),
      db.transferMatch.count(),
      db.recurringExpense.count(),
    ]);
  return accounts + categories + goals + transactions + imports + transfers + recurring;
}

function activeDatabaseDiagnostic() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const path = activeSqlitePath(databaseUrl);
  return {
    provider: "sqlite",
    filename: basename(path),
    urlHash: createHash("sha256").update(databaseUrl).digest("hex").slice(0, 12),
  };
}
