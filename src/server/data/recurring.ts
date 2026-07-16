import type { Prisma } from "@prisma/client";
import {
  detectRecurringCandidates,
  normalizeRecurringAmount,
  normalizeRecurringMerchant,
  type RecurringCandidate,
} from "@/domain/recurring/detection";
import {
  cancelRecurringSchema,
  manualRecurringSchema,
  recurringActionSchema,
  recurringUpdateSchema,
  selectedSavingsSchema,
} from "@/domain/recurring/schema";
import { prisma } from "@/server/db/prisma";
import { auditChange, auditFields } from "./audit";
import { AppError } from "./errors";
import { getHousehold } from "./repositories";

export async function scanRecurringExpenses(
  input: { householdId?: string; transactionIds?: string[] } = {},
) {
  const household = input.householdId
    ? await prisma.household.findUnique({ where: { id: input.householdId } })
    : await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: household.id,
    },
    include: {
      account: true,
      outgoingTransferMatches: { select: { status: true } },
      incomingTransferMatches: { select: { status: true } },
    },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
  });
  const candidates = detectRecurringCandidates(transactions);
  const created: string[] = [];
  const refreshed: string[] = [];
  const detectedKeys = new Set(candidates.map((item) => `${item.merchantKey}|${item.frequency}`));

  for (const candidate of candidates) {
    const existing = await prisma.recurringExpense.findUnique({
      where: {
        householdId_merchantKey_frequency: {
          householdId: household.id,
          merchantKey: candidate.merchantKey,
          frequency: candidate.frequency,
        },
      },
    });
    if (existing?.status === "REJECTED" && existing.detectionHash === candidate.detectionHash) {
      continue;
    }
    if (existing?.status === "CONFIRMED" || existing?.status === "CANCELED") {
      const needsReview =
        existing.status === "CONFIRMED" && recurringMateriallyChanged(existing, candidate);
      await refreshExistingRecurring(existing.id, candidate, needsReview);
      refreshed.push(existing.id);
      continue;
    }
    const record = existing
      ? await prisma.recurringExpense.update({
          where: { id: existing.id },
          data: {
            ...candidateToData(candidate),
            status: existing.status === "REJECTED" ? "NEEDS_REVIEW" : existing.status,
          },
        })
      : await prisma.recurringExpense.create({
          data: {
            householdId: household.id,
            ...candidateToData(candidate),
            status: "SUGGESTED",
          },
        });
    await replaceSupportingLinks(record.id, candidate.transactionIds, record.confidence);
    if (existing) {
      refreshed.push(record.id);
      await auditChange(prisma, {
        householdId: household.id,
        entityType: "RecurringExpense",
        entityId: record.id,
        action: "candidate_refreshed",
        field: "confidenceScore",
        newValue: record.confidenceScore,
        source: "recurring",
      });
    } else {
      created.push(record.id);
      await auditChange(prisma, {
        householdId: household.id,
        entityType: "RecurringExpense",
        entityId: record.id,
        action: "candidate_created",
        field: "confidence",
        newValue: record.confidence,
        source: "recurring",
      });
    }
  }
  const noLongerEligible = await prisma.recurringExpense.findMany({
    where: {
      householdId: household.id,
      status: "CONFIRMED",
      detectionHash: { not: { startsWith: "manual:" } },
    },
  });
  for (const existing of noLongerEligible) {
    if (detectedKeys.has(`${existing.merchantKey}|${existing.frequency}`)) continue;
    await deactivateDerivedSchedule(existing.id);
    await prisma.recurringExpense.update({
      where: { id: existing.id },
      data: { status: "NEEDS_REVIEW", nextExpectedDate: null },
    });
    await auditChange(prisma, {
      householdId: household.id,
      entityType: "RecurringExpense",
      entityId: existing.id,
      action: "confirmed_pattern_revalidation_required",
      field: "status",
      previousValue: "CONFIRMED",
      newValue: "NEEDS_REVIEW",
      reason: "Supporting transactions no longer form an eligible recurring pattern.",
      source: "recurring",
    });
    refreshed.push(existing.id);
  }
  const staleUnconfirmed = await prisma.recurringExpense.findMany({
    where: {
      householdId: household.id,
      status: { in: ["SUGGESTED", "NEEDS_REVIEW"] },
      userConfirmed: false,
      NOT: { detectionHash: { startsWith: "manual:" } },
    },
  });
  for (const existing of staleUnconfirmed) {
    if (detectedKeys.has(`${existing.merchantKey}|${existing.frequency}`)) continue;
    await prisma.recurringExpense.update({
      where: { id: existing.id },
      data: { status: "INACTIVE", nextExpectedDate: null },
    });
    await auditChange(prisma, {
      householdId: household.id,
      entityType: "RecurringExpense",
      entityId: existing.id,
      action: "candidate_inactivated",
      field: "status",
      previousValue: existing.status,
      newValue: "INACTIVE",
      reason: "Current transaction evidence no longer meets recurring-detection requirements.",
      source: "recurring",
    });
    refreshed.push(existing.id);
  }
  return {
    createdCount: created.length,
    refreshedCount: refreshed.length,
    candidateIds: [...created, ...refreshed],
    highConfidence: candidates.filter((candidate) => candidate.confidence === "HIGH").length,
    priceIncreases: candidates.filter((candidate) => candidate.priceChangeAmountMinor > 0).length,
  };
}

export async function recurringDashboard() {
  const household = await getHousehold();
  const [items, categories] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: { householdId: household.id },
      include: {
        category: true,
        _count: { select: { transactions: true } },
      },
      orderBy: [{ status: "asc" }, { confidenceScore: "desc" }, { monthlyEquivalentMinor: "desc" }],
      take: 250,
    }),
    prisma.category.findMany({
      where: { householdId: household.id, archivedAt: null },
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    }),
  ]);
  const active = items.filter(
    (item) => !["REJECTED", "CANCELED", "INACTIVE"].includes(item.status),
  );
  return {
    household,
    categories,
    items: items.map((item) => ({
      ...item,
      reasons: parseJsonArray(item.reasonsJson),
      supportCount: item._count.transactions,
      _count: undefined,
    })),
    summary: {
      monthlyTotalMinor: active.reduce((total, item) => total + item.monthlyEquivalentMinor, 0),
      annualTotalMinor: active.reduce((total, item) => total + item.annualEquivalentMinor, 0),
      essentialMinor: active
        .filter((item) => item.classification === "ESSENTIAL")
        .reduce((total, item) => total + item.monthlyEquivalentMinor, 0),
      usefulMinor: active
        .filter((item) => item.classification === "USEFUL")
        .reduce((total, item) => total + item.monthlyEquivalentMinor, 0),
      optionalMinor: active
        .filter(
          (item) =>
            item.classification === "OPTIONAL" || item.classification === "CANCELLATION_CANDIDATE",
        )
        .reduce((total, item) => total + item.monthlyEquivalentMinor, 0),
      underReview: items.filter((item) => ["SUGGESTED", "NEEDS_REVIEW"].includes(item.status))
        .length,
      priceIncreases: items.filter((item) => item.priceChangeAmountMinor > 0).length,
    },
  };
}

export async function recurringEvidence(id: string) {
  const item = await prisma.recurringExpense.findUnique({
    where: { id },
    include: {
      category: true,
      transactions: {
        include: { transaction: { include: { account: true, category: true } } },
        orderBy: { transaction: { transactionDate: "desc" } },
      },
    },
  });
  if (!item) throw new AppError("Recurring expense not found.", 404);
  return serializeRecurring(item);
}

export async function confirmRecurringExpense(id: string, input: unknown) {
  const data = recurringActionSchema.parse(input);
  const existing = await requireRecurring(id);
  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: { status: "CONFIRMED", userConfirmed: true, userNotes: data.notes ?? existing.userNotes },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "RecurringExpense",
    entityId: id,
    action: "candidate_confirmed",
    field: "status",
    previousValue: existing.status,
    newValue: "CONFIRMED",
    reason: data.notes ?? undefined,
    source: "recurring",
  });
  if (updated.nextExpectedDate) {
    const frequency =
      updated.frequency === "EVERY_TWO_WEEKS"
        ? "BIWEEKLY"
        : updated.frequency === "WEEKLY"
          ? "WEEKLY"
          : updated.frequency === "QUARTERLY"
            ? "QUARTERLY"
            : updated.frequency === "ANNUAL" || updated.frequency === "TWICE_YEARLY"
              ? "ANNUAL"
              : "MONTHLY";
    if (updated.recurringType === "INCOME") {
      const existingSchedule = await prisma.expectedIncomeSchedule.findFirst({
        where: { recurringExpenseId: id, archivedAt: null },
      });
      if (!existingSchedule)
        await prisma.expectedIncomeSchedule.create({
          data: {
            householdId: updated.householdId,
            name: updated.displayName,
            amountMinor: Math.abs(updated.typicalAmountMinor),
            frequency,
            nextExpectedDate: updated.nextExpectedDate,
            recurringExpenseId: id,
            sourceType: "CONFIRMED_RECURRING",
            confidence: updated.confidence,
            isDemo: false,
          },
        });
    } else {
      const existingSchedule = await prisma.scheduledObligation.findFirst({
        where: { recurringExpenseId: id, archivedAt: null },
      });
      if (!existingSchedule)
        await prisma.scheduledObligation.create({
          data: {
            householdId: updated.householdId,
            name: updated.displayName,
            amountMinor: Math.abs(updated.typicalAmountMinor),
            dueDate: updated.nextExpectedDate,
            frequency,
            categoryId: updated.categoryId,
            recurringExpenseId: id,
            obligationType: "SUBSCRIPTION",
            sourceType: "CONFIRMED_RECURRING",
            essentiality: updated.classification === "ESSENTIAL" ? "ESSENTIAL" : "IMPORTANT",
            confidence: updated.confidence,
            isDemo: false,
          },
        });
    }
  }
  return updated;
}

export async function rejectRecurringExpense(id: string, input: unknown) {
  const data = recurringActionSchema.parse(input);
  const existing = await requireRecurring(id);
  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: { status: "REJECTED", userNotes: data.notes ?? existing.userNotes },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "RecurringExpense",
    entityId: id,
    action: "candidate_rejected",
    field: "status",
    previousValue: existing.status,
    newValue: "REJECTED",
    reason: data.notes ?? undefined,
    source: "recurring",
  });
  return updated;
}

export async function updateRecurringExpense(id: string, input: unknown) {
  const data = recurringUpdateSchema.parse(input);
  const existing = await requireRecurring(id);
  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.householdId !== existing.householdId || category.archivedAt) {
      throw new AppError("Category is invalid for this recurring expense.", 422);
    }
  }
  const updated = await prisma.recurringExpense.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "RecurringExpense",
    entityId: id,
    action: "update",
    before: existing,
    after: updated,
    fields: Object.keys(data),
    source: "recurring",
  });
  return updated;
}

export async function createManualRecurringExpense(input: unknown) {
  const data = manualRecurringSchema.parse(input);
  const household = await prisma.household.findUnique({ where: { id: data.householdId } });
  if (!household) throw new AppError("Household not found.", 404);
  const merchantKey = normalizeRecurringMerchant(data.merchantPattern);
  const equivalents = normalizeRecurringAmount(data.typicalAmountMinor, data.frequency);
  const record = await prisma.recurringExpense.create({
    data: {
      householdId: data.householdId,
      merchantKey,
      displayName: data.displayName,
      serviceName: data.serviceName ?? null,
      categoryId: data.categoryId ?? null,
      frequency: data.frequency,
      typicalAmountMinor: data.typicalAmountMinor,
      minAmountMinor: data.typicalAmountMinor,
      maxAmountMinor: data.typicalAmountMinor,
      averageAmountMinor: data.typicalAmountMinor,
      medianAmountMinor: data.typicalAmountMinor,
      monthlyEquivalentMinor: equivalents.monthlyEquivalentMinor,
      annualEquivalentMinor: equivalents.annualEquivalentMinor,
      amountVariabilityBps: 0,
      confidence: "HIGH",
      confidenceScore: 100,
      status: "CONFIRMED",
      classification: data.classification,
      recommendation: data.recommendation,
      recurringType: data.recurringType,
      firstObservedDate: data.nextExpectedDate ?? new Date(),
      lastObservedDate: data.nextExpectedDate ?? new Date(),
      nextExpectedDate: data.nextExpectedDate ?? null,
      reasonsJson: JSON.stringify(["User manually created this recurring expense."]),
      detectionHash: `manual:${merchantKey}:${data.frequency}`,
      userConfirmed: true,
      userNotes: data.userNotes ?? null,
    },
  });
  await auditChange(prisma, {
    householdId: record.householdId,
    entityType: "RecurringExpense",
    entityId: record.id,
    action: "manual_recurring_created",
    field: "status",
    newValue: "CONFIRMED",
    source: "recurring",
  });
  return record;
}

export async function markRecurringCanceled(id: string, input: unknown) {
  const data = cancelRecurringSchema.parse(input);
  const existing = await requireRecurring(id);
  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: {
      status: "CANCELED",
      canceledAt: data.canceledAt,
      canceledNote: data.canceledNote ?? null,
      expectedFinalChargeDate: data.expectedFinalChargeDate ?? null,
      reactivateOnFutureMatch: data.reactivateOnFutureMatch,
    },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "RecurringExpense",
    entityId: id,
    action: "marked_canceled",
    field: "status",
    previousValue: existing.status,
    newValue: "CANCELED",
    reason: data.canceledNote ?? undefined,
    source: "recurring",
  });
  return updated;
}

export async function reactivateRecurringExpense(id: string, input: unknown) {
  const data = recurringActionSchema.parse(input);
  const existing = await requireRecurring(id);
  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: { status: "CONFIRMED", canceledAt: null, canceledNote: null },
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "RecurringExpense",
    entityId: id,
    action: "reactivated",
    field: "status",
    previousValue: existing.status,
    newValue: "CONFIRMED",
    reason: data.notes ?? undefined,
    source: "recurring",
  });
  return updated;
}

export async function selectedCancellationSavings(input: unknown) {
  const data = selectedSavingsSchema.parse(input);
  const items = data.ids.length
    ? await prisma.recurringExpense.findMany({ where: { id: { in: data.ids } } })
    : [];
  const monthlySavingsMinor = items.reduce((total, item) => total + item.monthlyEquivalentMinor, 0);
  const annualSavingsMinor = items.reduce((total, item) => total + item.annualEquivalentMinor, 0);
  return { monthlySavingsMinor, annualSavingsMinor, count: items.length };
}

export async function recurringDataQuality() {
  const now = new Date();
  const [
    unconfirmed,
    lowConfidence,
    withoutCategory,
    priceIncreases,
    chargesAfterCanceled,
    missingExpected,
    duplicateServices,
    unlinkedRecurringTransactions,
    inactiveStillActive,
  ] = await Promise.all([
    prisma.recurringExpense.count({ where: { status: { in: ["SUGGESTED", "NEEDS_REVIEW"] } } }),
    prisma.recurringExpense.count({ where: { confidence: "LOW", status: { not: "REJECTED" } } }),
    prisma.recurringExpense.count({
      where: { categoryId: null, status: { notIn: ["REJECTED", "CANCELED"] } },
    }),
    prisma.recurringExpense.count({
      where: { priceChangeAmountMinor: { gt: 0 }, status: { not: "REJECTED" } },
    }),
    prisma.recurringExpense.count({
      where: {
        status: "CANCELED",
        transactions: {
          some: {
            transaction: {
              transactionDate: { gt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      },
    }),
    prisma.recurringExpense.count({
      where: {
        status: "CONFIRMED",
        nextExpectedDate: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    duplicateServiceCount(),
    prisma.transaction.count({
      where: {
        amountMinor: { lt: 0 },
        recurringLinks: { none: {} },
        excluded: false,
        type: { in: ["DEBIT", "EXPENSE"] },
      },
    }),
    prisma.recurringExpense.count({ where: { status: "INACTIVE", nextExpectedDate: { gt: now } } }),
  ]);
  return {
    unconfirmed,
    lowConfidence,
    withoutCategory,
    priceIncreases,
    chargesAfterCanceled,
    missingExpected,
    duplicateServices,
    unlinkedRecurringTransactions,
    inactiveStillActive,
  };
}

async function duplicateServiceCount() {
  const services = await prisma.recurringExpense.groupBy({
    by: ["serviceName"],
    where: { serviceName: { not: null }, status: { notIn: ["REJECTED", "CANCELED"] } },
    _count: { serviceName: true },
  });
  return services.filter((service) => service._count.serviceName > 1).length;
}

export async function refreshRecurringForTransactions(transactionIds: string[]) {
  if (!transactionIds.length) return;
  const transactions = await prisma.transaction.findMany({
    where: { id: { in: transactionIds } },
    select: { householdId: true },
  });
  const householdIds = [...new Set(transactions.map((transaction) => transaction.householdId))];
  for (const householdId of householdIds) {
    await scanRecurringExpenses({ householdId }).catch(() => undefined);
  }
}

function candidateToData(candidate: RecurringCandidate) {
  return {
    merchantKey: candidate.merchantKey,
    displayName: candidate.displayName,
    categoryId: candidate.categoryId,
    frequency: candidate.frequency,
    typicalAmountMinor: candidate.typicalAmountMinor,
    minAmountMinor: candidate.minAmountMinor,
    maxAmountMinor: candidate.maxAmountMinor,
    averageAmountMinor: candidate.averageAmountMinor,
    medianAmountMinor: candidate.medianAmountMinor,
    monthlyEquivalentMinor: candidate.monthlyEquivalentMinor,
    annualEquivalentMinor: candidate.annualEquivalentMinor,
    amountVariabilityBps: candidate.amountVariabilityBps,
    confidence: candidate.confidence,
    confidenceScore: candidate.confidenceScore,
    classification: candidate.classification,
    recommendation: candidate.recommendation,
    recurringType: candidate.recurringType,
    firstObservedDate: candidate.firstObservedDate,
    lastObservedDate: candidate.lastObservedDate,
    nextExpectedDate: candidate.nextExpectedDate,
    priceChangeAmountMinor: candidate.priceChangeAmountMinor,
    priceChangeBps: candidate.priceChangeBps,
    priceChangeEffectiveDate: candidate.priceChangeEffectiveDate,
    reasonsJson: JSON.stringify(candidate.reasons),
    detectionHash: candidate.detectionHash,
  };
}

async function refreshExistingRecurring(
  id: string,
  candidate: RecurringCandidate,
  needsReview = false,
) {
  const record = await prisma.recurringExpense.update({
    where: { id },
    data: { ...candidateToData(candidate), status: needsReview ? "NEEDS_REVIEW" : undefined },
  });
  await replaceSupportingLinks(record.id, candidate.transactionIds, record.confidence);
  if (candidate.priceChangeAmountMinor) {
    await auditChange(prisma, {
      householdId: record.householdId,
      entityType: "RecurringExpense",
      entityId: record.id,
      action: "price_increase_detected",
      field: "priceChangeAmountMinor",
      newValue: candidate.priceChangeAmountMinor,
      source: "recurring",
    });
  }
  if (needsReview) {
    await deactivateDerivedSchedule(record.id);
    await auditChange(prisma, {
      householdId: record.householdId,
      entityType: "RecurringExpense",
      entityId: record.id,
      action: "confirmed_pattern_revalidation_required",
      field: "status",
      previousValue: "CONFIRMED",
      newValue: "NEEDS_REVIEW",
      reason: "Frequency, amount, or supporting evidence changed materially.",
      source: "recurring",
    });
  }
}

async function deactivateDerivedSchedule(recurringExpenseId: string) {
  await prisma.$transaction([
    prisma.expectedIncomeSchedule.updateMany({
      where: { recurringExpenseId, archivedAt: null },
      data: { active: false },
    }),
    prisma.scheduledObligation.updateMany({
      where: { recurringExpenseId, archivedAt: null },
      data: { active: false },
    }),
  ]);
}

function recurringMateriallyChanged(
  existing: {
    frequency: string;
    typicalAmountMinor: number;
    recurringType: string;
  },
  candidate: RecurringCandidate,
) {
  if (existing.frequency !== candidate.frequency) return true;
  if (existing.recurringType !== candidate.recurringType) return true;
  const baseline = Math.max(1, Math.abs(existing.typicalAmountMinor));
  return Math.abs(candidate.typicalAmountMinor - existing.typicalAmountMinor) * 100 > baseline * 20;
}

async function replaceSupportingLinks(
  recurringExpenseId: string,
  transactionIds: string[],
  confidence: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.recurringExpenseTransaction.deleteMany({ where: { recurringExpenseId } });
    if (transactionIds.length) {
      await tx.recurringExpenseTransaction.createMany({
        data: transactionIds.map((transactionId) => ({
          recurringExpenseId,
          transactionId,
          matchRole: "SUPPORTING",
          confidence,
          included: true,
        })),
      });
    }
  });
}

async function requireRecurring(id: string) {
  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) throw new AppError("Recurring expense not found.", 404);
  return existing;
}

function serializeRecurring(
  item: Prisma.RecurringExpenseGetPayload<{
    include: {
      category: true;
      transactions: { include: { transaction: { include: { account: true; category: true } } } };
    };
  }>,
) {
  return {
    ...item,
    reasons: parseJsonArray(item.reasonsJson),
    support: item.transactions.map((link) => ({
      ...link,
      transaction: link.transaction,
    })),
  };
}

function parseJsonArray(value: string) {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}
