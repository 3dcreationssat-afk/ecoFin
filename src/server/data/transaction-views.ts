import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { AppError } from "./errors";
import {
  createSavedViewSchema,
  updateSavedViewSchema,
} from "@/domain/transactions/saved-view-schema";
import {
  financialPeriodBounds,
  parseTransactionQuery,
  serializeTransactionQuery,
  type TransactionQuery,
} from "@/domain/transactions/query";

async function householdId() {
  const household = await prisma.household.findFirst({
    select: { id: true, financialMonthStart: true },
  });
  if (!household) throw new AppError("Household not found.", 404);
  return household;
}

export async function listSavedViews() {
  const household = await householdId();
  return prisma.transactionSavedView.findMany({
    where: { householdId: household.id, isArchived: false },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function createSavedView(input: unknown) {
  const data = createSavedViewSchema.parse(input);
  const household = await householdId();
  try {
    return await prisma.transactionSavedView.create({
      data: {
        householdId: household.id,
        name: data.name,
        normalizedName: data.name.toLocaleLowerCase(),
        queryJson: JSON.stringify(Object.fromEntries(serializeTransactionQuery(data.query))),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AppError("A saved view with that name already exists.", 409);
    throw error;
  }
}

export async function updateSavedView(id: string, input: unknown) {
  const data = updateSavedViewSchema.parse(input);
  const household = await householdId();
  const existing = await prisma.transactionSavedView.findFirst({
    where: { id, householdId: household.id, isArchived: false },
  });
  if (!existing) throw new AppError("Saved view not found.", 404);
  try {
    return await prisma.$transaction(async (tx) => {
      if (data.isDefault)
        await tx.transactionSavedView.updateMany({
          where: { householdId: household.id, isDefault: true },
          data: { isDefault: false },
        });
      return tx.transactionSavedView.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name, normalizedName: data.name.toLocaleLowerCase() } : {}),
          ...(data.query
            ? {
                queryJson: JSON.stringify(
                  Object.fromEntries(serializeTransactionQuery(data.query)),
                ),
              }
            : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
          ...(data.isArchived !== undefined
            ? { isArchived: data.isArchived, isDefault: data.isArchived ? false : undefined }
            : {}),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AppError("A saved view with that name already exists.", 409);
    throw error;
  }
}

export async function defaultSavedView() {
  const household = await householdId();
  return prisma.transactionSavedView.findFirst({
    where: { householdId: household.id, isDefault: true, isArchived: false },
  });
}

export async function transactionPage(query: TransactionQuery) {
  const household = await householdId();
  const period =
    query.period === "CUSTOM"
      ? { from: query.from, to: query.to }
      : financialPeriodBounds(query.period, household.financialMonthStart);
  const where: Prisma.TransactionWhereInput = {
    householdId: household.id,
    AND: [
      ...(query.q
        ? [
            {
              OR: ["normalizedMerchant", "originalDescription", "sourceFilename"].map((field) => ({
                [field]: { contains: query.q },
              })),
            },
          ]
        : []),
      ...(query.transfer === "confirmed"
        ? [
            {
              OR: [
                { outgoingTransferMatches: { some: { status: "CONFIRMED" } } },
                { incomingTransferMatches: { some: { status: "CONFIRMED" } } },
              ],
            },
          ]
        : []),
      ...(query.transfer === "suggested"
        ? [
            {
              OR: [
                { outgoingTransferMatches: { some: { status: "SUGGESTED" } } },
                { incomingTransferMatches: { some: { status: "SUGGESTED" } } },
              ],
            },
          ]
        : []),
    ],
    ...(query.account
      ? { account: { is: { OR: [{ id: query.account }, { name: query.account }] } } }
      : {}),
    ...(query.category === "uncategorized"
      ? { categoryId: null }
      : query.category
        ? { categoryId: query.category }
        : {}),
    ...(query.status ? { reviewStatus: query.status } : {}),
    ...(query.source ? { sourceType: query.source } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.excluded !== "all" ? { excluded: query.excluded === "excluded" } : {}),
    ...(period.from || period.to
      ? {
          transactionDate: {
            ...(period.from ? { gte: new Date(`${period.from}T00:00:00.000Z`) } : {}),
            ...(period.to ? { lte: new Date(`${period.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(query.amountMin !== undefined || query.amountMax !== undefined
      ? {
          amountMinor: {
            ...(query.amountMin !== undefined ? { gte: query.amountMin } : {}),
            ...(query.amountMax !== undefined ? { lte: query.amountMax } : {}),
          },
        }
      : {}),
    ...(query.transfer === "unmatched"
      ? {
          type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] },
          outgoingTransferMatches: { none: { status: "CONFIRMED" } },
          incomingTransferMatches: { none: { status: "CONFIRMED" } },
        }
      : {}),
    ...(query.transfer === "none"
      ? {
          outgoingTransferMatches: { none: {} },
          incomingTransferMatches: { none: {} },
          type: { notIn: ["TRANSFER_IN", "TRANSFER_OUT"] },
        }
      : {}),
    ...(query.recurring === "confirmed"
      ? { recurringLinks: { some: { included: true, recurringExpense: { status: "CONFIRMED" } } } }
      : {}),
    ...(query.recurring === "suggested"
      ? { recurringLinks: { some: { included: true, recurringExpense: { status: "SUGGESTED" } } } }
      : {}),
    ...(query.recurring === "none" ? { recurringLinks: { none: { included: true } } } : {}),
  };
  const orderField =
    {
      date: "transactionDate",
      amount: "amountMinor",
      merchant: "normalizedMerchant",
      status: "reviewStatus",
      source: "sourceType",
    }[query.sort] ?? "transactionDate";
  const direction: Prisma.SortOrder = query.direction === "asc" ? "asc" : "desc";
  const orderBy: Prisma.TransactionOrderByWithRelationInput =
    query.sort === "account"
      ? { account: { name: direction } }
      : query.sort === "category"
        ? { category: { name: direction } }
        : { [orderField]: direction };
  const [items, total, all] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { account: true, category: true },
      orderBy: [orderBy, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.count({ where: { householdId: household.id } }),
  ]);
  return {
    items,
    total,
    all,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export function parseSavedViewQuery(queryJson: string) {
  try {
    return parseTransactionQuery(new URLSearchParams(JSON.parse(queryJson)));
  } catch {
    return parseTransactionQuery(new URLSearchParams());
  }
}
