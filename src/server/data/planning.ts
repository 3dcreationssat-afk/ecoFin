import { Prisma } from "@prisma/client";
import {
  expectedIncomeSchema,
  expectedIncomeUpdateSchema,
  obligationSchema,
  obligationUpdateSchema,
  occurrenceActionSchema,
  savingsPolicySchema,
} from "@/domain/planning/schema";
import { occurrenceDates } from "@/domain/planning/occurrences";
import { prisma } from "@/server/db/prisma";
import { auditChange, auditFields } from "./audit";
import { AppError } from "./errors";

type Db = typeof prisma | Prisma.TransactionClient;
async function validateLinks(
  db: Db,
  householdId: string,
  links: {
    accountId?: string | null;
    categoryId?: string | null;
    recurringExpenseId?: string | null;
    debtAccountId?: string | null;
    goalId?: string | null;
  },
) {
  for (const [model, id] of Object.entries(links)) {
    if (!id) continue;
    const record =
      model === "categoryId"
        ? await db.category.findUnique({ where: { id } })
        : model === "goalId"
          ? await db.goal.findUnique({ where: { id } })
          : model === "recurringExpenseId"
            ? await db.recurringExpense.findUnique({ where: { id } })
            : await db.account.findUnique({ where: { id } });
    if (!record || record.householdId !== householdId)
      throw new AppError(`${model} is invalid for this household.`, 422);
  }
}
export async function ensurePlanningOccurrences(end: Date, db: Db = prisma) {
  const incomes = await db.expectedIncomeSchedule.findMany({
    where: { active: true, archivedAt: null, nextExpectedDate: { lt: end } },
  });
  for (const item of incomes)
    for (const date of occurrenceDates(
      item.nextExpectedDate,
      item.frequency,
      end,
      item.twiceMonthlyDay1,
      item.twiceMonthlyDay2,
      item.endDate,
    ))
      await db.expectedIncomeOccurrence.upsert({
        where: { scheduleId_expectedDate: { scheduleId: item.id, expectedDate: date } },
        create: {
          householdId: item.householdId,
          scheduleId: item.id,
          expectedDate: date,
          expectedAmountMinor: item.amountMinor,
        },
        update: {},
      });
  const obligations = await db.scheduledObligation.findMany({
    where: { active: true, archivedAt: null, dueDate: { lt: end } },
  });
  for (const item of obligations)
    for (const date of occurrenceDates(item.dueDate, item.frequency, end))
      await db.obligationOccurrence.upsert({
        where: { obligationId_expectedDate: { obligationId: item.id, expectedDate: date } },
        create: {
          householdId: item.householdId,
          obligationId: item.id,
          expectedDate: date,
          expectedAmountMinor: item.amountMinor,
        },
        update: {},
      });
}
export async function planningDashboard(asOf = new Date()) {
  const end = new Date(asOf);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  await ensurePlanningOccurrences(end);
  const household = await prisma.household.findFirst({
    include: {
      accounts: true,
      categories: true,
      goals: true,
      recurringExpenses: true,
      expectedIncomeSchedules: {
        include: { occurrences: { orderBy: { expectedDate: "asc" } } },
        orderBy: { nextExpectedDate: "asc" },
      },
      scheduledObligations: {
        include: { occurrences: { orderBy: { expectedDate: "asc" } } },
        orderBy: { dueDate: "asc" },
      },
    },
  });
  if (!household) throw new AppError("Household not found.", 404);
  return household;
}
export async function createExpectedIncome(input: unknown) {
  const data = expectedIncomeSchema.parse(input);
  await validateLinks(prisma, data.householdId, {
    accountId: data.accountId,
    recurringExpenseId: data.recurringExpenseId,
  });
  const record = await prisma.expectedIncomeSchedule.create({ data: { ...data, isDemo: false } });
  await auditChange(prisma, {
    householdId: data.householdId,
    entityType: "ExpectedIncomeSchedule",
    entityId: record.id,
    action: "create",
    source: "user",
  });
  return record;
}
export async function updateExpectedIncome(id: string, input: unknown) {
  const existing = await prisma.expectedIncomeSchedule.findUnique({ where: { id } });
  if (!existing) throw new AppError("Expected income not found.", 404);
  const data = expectedIncomeUpdateSchema.parse(input);
  await validateLinks(prisma, existing.householdId, {
    accountId: data.accountId,
    recurringExpenseId: data.recurringExpenseId,
  });
  const updated = await prisma.expectedIncomeSchedule.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "ExpectedIncomeSchedule",
    entityId: id,
    action: "update",
    before: existing,
    after: updated,
    fields: Object.keys(data),
    source: "user",
  });
  return updated;
}
export async function setExpectedIncomeState(id: string, action: "PAUSE" | "RESUME" | "ARCHIVE") {
  const existing = await prisma.expectedIncomeSchedule.findUnique({ where: { id } });
  if (!existing) throw new AppError("Expected income not found.", 404);
  const updated = await prisma.expectedIncomeSchedule.update({
    where: { id },
    data: {
      active: action === "RESUME",
      archivedAt: action === "ARCHIVE" ? new Date() : existing.archivedAt,
    },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "ExpectedIncomeSchedule",
    entityId: id,
    action: action.toLowerCase(),
    source: "user",
  });
  return updated;
}
export async function createObligation(input: unknown) {
  const data = obligationSchema.parse(input);
  await validateLinks(prisma, data.householdId, {
    accountId: data.accountId,
    categoryId: data.categoryId,
    recurringExpenseId: data.recurringExpenseId,
    debtAccountId: data.debtAccountId,
    goalId: data.goalId,
  });
  const record = await prisma.scheduledObligation.create({ data: { ...data, isDemo: false } });
  await auditChange(prisma, {
    householdId: data.householdId,
    entityType: "ScheduledObligation",
    entityId: record.id,
    action: "create",
    source: "user",
  });
  return record;
}
export async function updateObligation(id: string, input: unknown) {
  const existing = await prisma.scheduledObligation.findUnique({ where: { id } });
  if (!existing) throw new AppError("Obligation not found.", 404);
  const data = obligationUpdateSchema.parse(input);
  await validateLinks(prisma, existing.householdId, {
    accountId: data.accountId,
    categoryId: data.categoryId,
    recurringExpenseId: data.recurringExpenseId,
    debtAccountId: data.debtAccountId,
    goalId: data.goalId,
  });
  const updated = await prisma.scheduledObligation.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "ScheduledObligation",
    entityId: id,
    action: "update",
    before: existing,
    after: updated,
    fields: Object.keys(data),
    source: "user",
  });
  return updated;
}
export async function setObligationState(id: string, action: "PAUSE" | "RESUME" | "ARCHIVE") {
  const existing = await prisma.scheduledObligation.findUnique({ where: { id } });
  if (!existing) throw new AppError("Obligation not found.", 404);
  const updated = await prisma.scheduledObligation.update({
    where: { id },
    data: {
      active: action === "RESUME",
      archivedAt: action === "ARCHIVE" ? new Date() : existing.archivedAt,
    },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "ScheduledObligation",
    entityId: id,
    action: action.toLowerCase(),
    source: "user",
  });
  return updated;
}
export async function actOnOccurrence(kind: "income" | "obligation", id: string, input: unknown) {
  const data = occurrenceActionSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing =
      kind === "income"
        ? await tx.expectedIncomeOccurrence.findUnique({ where: { id } })
        : await tx.obligationOccurrence.findUnique({ where: { id } });
    if (!existing) throw new AppError("Occurrence not found.", 404);
    if (data.transactionId) {
      const txRecord = await tx.transaction.findUnique({ where: { id: data.transactionId } });
      if (!txRecord || txRecord.householdId !== existing.householdId)
        throw new AppError("Transaction is invalid.", 422);
      const [incomeUse, obligationUse] = await Promise.all([
        tx.expectedIncomeOccurrence.findFirst({
          where: { satisfiedTransactionId: data.transactionId, NOT: { id } },
        }),
        tx.obligationOccurrence.findFirst({
          where: { satisfiedTransactionId: data.transactionId, NOT: { id } },
        }),
      ]);
      if (incomeUse || obligationUse)
        throw new AppError("Transaction already satisfies another occurrence.", 409);
    }
    const status = data.action === "RECEIVED" ? "RECEIVED" : data.action;
    const received = data.amountMinor ?? existing.expectedAmountMinor;
    const update = {
      status,
      satisfiedDate: data.action === "SKIPPED" ? null : (data.satisfiedDate ?? new Date()),
      satisfiedTransactionId: data.transactionId ?? null,
      amountDifferenceMinor: received - existing.expectedAmountMinor,
      notes: data.notes,
    };
    const updated =
      kind === "income"
        ? await tx.expectedIncomeOccurrence.update({ where: { id }, data: update })
        : await tx.obligationOccurrence.update({ where: { id }, data: update });
    await auditChange(tx, {
      householdId: existing.householdId,
      entityType: kind === "income" ? "ExpectedIncomeOccurrence" : "ObligationOccurrence",
      entityId: id,
      action: status.toLowerCase(),
      field: "status",
      previousValue: existing.status,
      newValue: status,
      source: "user",
    });
    return updated;
  });
}
export async function updateSavingsPolicy(input: unknown) {
  const data = savingsPolicySchema.parse(input);
  const existing = await prisma.household.findFirst();
  if (!existing) throw new AppError("Household not found.", 404);
  const updated = await prisma.household.update({ where: { id: existing.id }, data });
  await auditFields(prisma, {
    householdId: existing.id,
    entityType: "Household",
    entityId: existing.id,
    action: "update_savings_policy",
    before: existing,
    after: updated,
    fields: Object.keys(data),
    source: "user",
  });
  return updated;
}

export async function matchSuggestions() {
  const dashboard = await planningDashboard();
  const transactions = await prisma.transaction.findMany({
    where: { householdId: dashboard.id, clearingStatus: "CLEARED", possibleDuplicate: false },
    orderBy: { transactionDate: "desc" },
    take: 100,
  });
  const income = dashboard.expectedIncomeSchedules.flatMap((s) =>
    s.occurrences
      .filter((o) => o.status === "UPCOMING")
      .flatMap((o) =>
        transactions
          .filter(
            (t) =>
              ["INCOME", "CREDIT"].includes(t.type) &&
              Math.abs(t.amountMinor - o.expectedAmountMinor) <= 100 &&
              Math.abs(t.transactionDate.getTime() - o.expectedDate.getTime()) <= 3 * 86400000,
          )
          .map((t) => ({
            kind: "income" as const,
            occurrenceId: o.id,
            transactionId: t.id,
            label: s.name,
            confidence: t.amountMinor === o.expectedAmountMinor ? "HIGH" : "MODERATE",
            amountDifferenceMinor: t.amountMinor - o.expectedAmountMinor,
            dateDifferenceDays: Math.round(
              (t.transactionDate.getTime() - o.expectedDate.getTime()) / 86400000,
            ),
          })),
      ),
  );
  const obligations = dashboard.scheduledObligations.flatMap((s) =>
    s.occurrences
      .filter((o) => o.status === "UPCOMING")
      .flatMap((o) =>
        transactions
          .filter(
            (t) =>
              t.amountMinor < 0 &&
              Math.abs(Math.abs(t.amountMinor) - o.expectedAmountMinor) <= 100 &&
              Math.abs(t.transactionDate.getTime() - o.expectedDate.getTime()) <= 3 * 86400000,
          )
          .map((t) => ({
            kind: "obligation" as const,
            occurrenceId: o.id,
            transactionId: t.id,
            label: s.name,
            confidence: Math.abs(t.amountMinor) === o.expectedAmountMinor ? "HIGH" : "MODERATE",
            amountDifferenceMinor: Math.abs(t.amountMinor) - o.expectedAmountMinor,
            dateDifferenceDays: Math.round(
              (t.transactionDate.getTime() - o.expectedDate.getTime()) / 86400000,
            ),
          })),
      ),
  );
  return [...income, ...obligations];
}
