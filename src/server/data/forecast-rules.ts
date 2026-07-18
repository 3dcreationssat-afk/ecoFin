import type { Prisma } from "@prisma/client";
import { detectPayrollCandidates } from "@/domain/forecast/payroll-detection";
import { matchForecastTransactions } from "@/domain/forecast/matching";
import {
  forecastOccurrenceActionSchema,
  forecastRuleActionSchema,
  forecastRuleUpdateSchema,
} from "@/domain/forecast/schema";
import { prisma } from "@/server/db/prisma";
import { auditChange, auditFields } from "./audit";
import { AppError } from "./errors";
import { getHousehold } from "./repositories";

type Db = typeof prisma | Prisma.TransactionClient;

const AUTO_PAUSED_PROVENANCE =
  "Automatically paused because current transactions no longer support this detected pattern.";

export async function detectForecastRules(householdId?: string, asOf = new Date()) {
  const household = householdId
    ? await prisma.household.findUnique({ where: { id: householdId } })
    : await getHousehold();
  if (!household) throw new AppError("Household not found.", 404);
  const transactions = await prisma.transaction.findMany({
    where: { householdId: household.id },
    include: {
      outgoingTransferMatches: { select: { status: true } },
      incomingTransferMatches: { select: { status: true } },
    },
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
    take: 25_000,
  });
  const payroll = detectPayrollCandidates(transactions, asOf);
  let createdCount = 0;
  let refreshedCount = 0;
  const createdRuleIds: string[] = [];
  const refreshedRuleIds: string[] = [];
  const detectedFingerprints = new Set(payroll.map((candidate) => candidate.fingerprint));
  for (const candidate of payroll) {
    const existing = await prisma.forecastRule.findUnique({
      where: { detectionFingerprint: candidate.fingerprint },
    });
    const data = {
      householdId: candidate.householdId,
      accountId: candidate.accountId,
      name: `${candidate.displayName} payroll`,
      merchantKey: candidate.merchantKey,
      direction: "INCOME",
      cadence: candidate.cadence,
      anchorDate: candidate.firstObservedDate,
      lastObservedDate: candidate.lastObservedDate,
      nextExpectedDate: candidate.nextExpectedDate,
      typicalAmountMinor: candidate.typicalAmountMinor,
      minAmountMinor: candidate.minAmountMinor,
      maxAmountMinor: candidate.maxAmountMinor,
      amountVariabilityBps: candidate.amountVariabilityBps,
      dateToleranceDays: candidate.dateToleranceDays,
      amountToleranceBps: candidate.amountToleranceBps,
      expectedWeekday: candidate.expectedWeekday,
      semimonthlyDay1: candidate.semimonthlyDay1,
      semimonthlyDay2: candidate.semimonthlyDay2,
      confidence: candidate.confidence,
      confidenceScore: candidate.confidenceScore,
      provenance: `Detected from ${candidate.transactionIds.length} eligible imported deposits.`,
      creationSource: "DETECTED",
      effectiveStartDate: candidate.firstObservedDate,
      reasonsJson: JSON.stringify(candidate.reasons),
    };
    if (!existing) {
      const created = await prisma.forecastRule.create({
        data: { ...data, state: "DETECTED", detectionFingerprint: candidate.fingerprint },
      });
      await auditChange(prisma, {
        householdId: household.id,
        entityType: "ForecastRule",
        entityId: created.id,
        action: "payroll_pattern_detected",
        field: "confidence",
        newValue: candidate.confidence,
        source: "forecast",
      });
      createdCount += 1;
      createdRuleIds.push(created.id);
    } else {
      const wasAutomaticallyPaused =
        existing.state === "PAUSED" && existing.provenance === AUTO_PAUSED_PROVENANCE;
      const material =
        existing.nextExpectedDate.getTime() !== candidate.nextExpectedDate.getTime() ||
        existing.typicalAmountMinor !== candidate.typicalAmountMinor ||
        existing.confidence !== candidate.confidence ||
        wasAutomaticallyPaused;
      await prisma.forecastRule.update({
        where: { id: existing.id },
        data: { ...data, ...(wasAutomaticallyPaused ? { state: "DETECTED" } : {}) },
      });
      if (material) {
        await auditChange(prisma, {
          householdId: household.id,
          entityType: "ForecastRule",
          entityId: existing.id,
          action: "detected_pattern_refreshed",
          field: "nextExpectedDate",
          previousValue: existing.nextExpectedDate,
          newValue: candidate.nextExpectedDate,
          source: "forecast",
        });
        refreshedCount += 1;
        refreshedRuleIds.push(existing.id);
      }
    }
  }
  const staleDetectedRules = await prisma.forecastRule.findMany({
    where: {
      householdId: household.id,
      state: "DETECTED",
      creationSource: "DETECTED",
      recurringExpenseId: null,
      sourceRecordType: null,
    },
  });
  for (const rule of staleDetectedRules) {
    if (detectedFingerprints.has(rule.detectionFingerprint)) continue;
    await prisma.forecastRule.update({
      where: { id: rule.id },
      data: { state: "PAUSED", provenance: AUTO_PAUSED_PROVENANCE },
    });
    await auditChange(prisma, {
      householdId: household.id,
      entityType: "ForecastRule",
      entityId: rule.id,
      action: "detected_pattern_inactivated",
      field: "state",
      previousValue: "DETECTED",
      newValue: "PAUSED",
      reason: "Current transactions no longer meet payroll-pattern detection requirements.",
      source: "forecast",
    });
    refreshedCount += 1;
    refreshedRuleIds.push(rule.id);
  }
  await syncRecurringForecastRules(household.id);
  return {
    createdCount,
    refreshedCount,
    createdRuleIds,
    refreshedRuleIds,
    payrollCandidates: payroll.length,
  };
}

export async function syncRecurringForecastRules(householdId: string) {
  const recurring = await prisma.recurringExpense.findMany({
    where: { householdId, nextExpectedDate: { not: null } },
    include: {
      expectedIncomeSchedules: { where: { archivedAt: null }, take: 1 },
      scheduledObligations: { where: { archivedAt: null }, take: 1 },
      transactions: {
        where: { included: true },
        include: { transaction: { select: { accountId: true } } },
      },
    },
    take: 500,
  });
  for (const item of recurring) {
    const fingerprint = `recurring:${item.id}`;
    const accountId = mostCommon(item.transactions.map((link) => link.transaction.accountId));
    const detectedState =
      item.status === "CONFIRMED"
        ? "CONFIRMED"
        : item.status === "REJECTED"
          ? "IGNORED"
          : item.status === "CANCELED"
            ? "ENDED"
            : item.status === "INACTIVE"
              ? "PAUSED"
              : "DETECTED";
    const incomeSchedule = item.expectedIncomeSchedules[0];
    const obligation = item.scheduledObligations[0];
    const sourceRecordType = incomeSchedule
      ? "ExpectedIncomeSchedule"
      : obligation
        ? "ScheduledObligation"
        : "RecurringExpense";
    const sourceRecordId = incomeSchedule?.id ?? obligation?.id ?? item.id;
    const existing = await prisma.forecastRule.findFirst({
      where: {
        householdId,
        OR: [
          { recurringExpenseId: item.id },
          { sourceRecordType, sourceRecordId },
          { detectionFingerprint: fingerprint },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    const state =
      existing && ["PAUSED", "ENDED", "ARCHIVED"].includes(existing.state)
        ? existing.state
        : detectedState;
    const data = {
      accountId,
      recurringExpenseId: item.id,
      name: item.displayName,
      merchantKey: item.merchantKey,
      direction: item.recurringType === "INCOME" ? "INCOME" : "EXPENSE",
      cadence: item.frequency,
      anchorDate: item.lastObservedDate,
      lastObservedDate: item.lastObservedDate,
      nextExpectedDate: item.nextExpectedDate!,
      typicalAmountMinor: Math.abs(item.typicalAmountMinor),
      minAmountMinor: Math.abs(item.minAmountMinor),
      maxAmountMinor: Math.abs(item.maxAmountMinor),
      amountVariabilityBps: item.amountVariabilityBps,
      confidence: item.confidence,
      confidenceScore: item.confidenceScore,
      state,
      sourceRecordType,
      sourceRecordId,
      reasonsJson: item.reasonsJson,
    };
    if (existing) {
      await prisma.forecastRule.update({ where: { id: existing.id }, data });
      continue;
    }
    await prisma.forecastRule.create({
      data: {
        householdId,
        ...data,
        provenance: "Synchronized from recurring detection evidence.",
        creationSource: "DETECTED",
        effectiveStartDate: item.firstObservedDate,
        detectionFingerprint: fingerprint,
      },
    });
  }
}

export async function forecastRuleDashboard() {
  const household = await getHousehold();
  const [rules, accounts] = await Promise.all([
    prisma.forecastRule.findMany({
      where: { householdId: household.id, archivedAt: null },
      include: { account: true, occurrences: { orderBy: { expectedDate: "asc" } } },
      orderBy: [{ state: "asc" }, { confidenceScore: "desc" }, { nextExpectedDate: "asc" }],
      take: 500,
    }),
    prisma.account.findMany({ where: { householdId: household.id, archivedAt: null } }),
  ]);
  return { household, rules: rules.map(serializeRule), accounts };
}

export async function updateForecastRule(id: string, input: unknown) {
  const data = forecastRuleUpdateSchema.parse(input);
  const existing = await requireRule(id);
  if (data.accountId) {
    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account || account.householdId !== existing.householdId || account.archivedAt)
      throw new AppError("Forecast account is invalid.", 422);
  }
  const updated = await prisma.forecastRule.update({ where: { id }, data });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "ForecastRule",
    entityId: id,
    action: "forecast_rule_updated",
    before: existing,
    after: updated,
    fields: Object.keys(data),
    source: "forecast",
  });
  return serializeRule(updated);
}

export async function actOnForecastRule(id: string, input: unknown) {
  const data = forecastRuleActionSchema.parse(input);
  const existing = await requireRule(id);
  const state = {
    CONFIRM: "CONFIRMED",
    IGNORE: "IGNORED",
    PAUSE: "PAUSED",
    RESUME: "CONFIRMED",
    END: "ENDED",
    ARCHIVE: "ARCHIVED",
  }[data.action];
  const updated = await prisma.forecastRule.update({
    where: { id },
    data: { state, archivedAt: data.action === "ARCHIVE" ? new Date() : existing.archivedAt },
  });
  if (existing.recurringExpenseId && ["CONFIRM", "IGNORE"].includes(data.action)) {
    await prisma.recurringExpense.update({
      where: { id: existing.recurringExpenseId },
      data:
        data.action === "CONFIRM"
          ? { status: "CONFIRMED", userConfirmed: true }
          : { status: "REJECTED", userConfirmed: false },
    });
  }
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "ForecastRule",
    entityId: id,
    action: `forecast_rule_${data.action.toLowerCase()}`,
    field: "state",
    previousValue: existing.state,
    newValue: state,
    reason: data.notes ?? undefined,
    source: "forecast",
  });
  return serializeRule(updated);
}

export async function actOnForecastOccurrence(input: unknown) {
  const data = forecastOccurrenceActionSchema.parse(input);
  const rule = await requireRule(data.ruleId);
  const status = { SKIP: "SKIPPED", CHANGE: "CHANGED", CANCEL: "CANCELLED", RESTORE: "EXPECTED" }[
    data.action
  ];
  const occurrence = await prisma.forecastOccurrence.upsert({
    where: { ruleId_expectedDate: { ruleId: rule.id, expectedDate: data.expectedDate } },
    create: {
      householdId: rule.householdId,
      ruleId: rule.id,
      expectedDate: data.expectedDate,
      expectedAmountMinor: rule.typicalAmountMinor,
      status,
      overrideDate: data.action === "CHANGE" ? data.overrideDate : null,
      overrideAmountMinor: data.action === "CHANGE" ? data.overrideAmountMinor : null,
      provenanceJson: JSON.stringify({ source: "user", action: data.action }),
      notes: data.notes,
    },
    update: {
      status,
      overrideDate: data.action === "CHANGE" ? data.overrideDate : null,
      overrideAmountMinor: data.action === "CHANGE" ? data.overrideAmountMinor : null,
      provenanceJson: JSON.stringify({ source: "user", action: data.action }),
      notes: data.notes,
    },
  });
  await auditChange(prisma, {
    householdId: rule.householdId,
    entityType: "ForecastOccurrence",
    entityId: occurrence.id,
    action: `occurrence_${data.action.toLowerCase()}`,
    field: "status",
    newValue: status,
    reason: data.notes ?? undefined,
    source: "forecast",
  });
  return occurrence;
}

export async function matchForecastOccurrences(
  input: { householdId?: string; transactionIds?: string[] } = {},
) {
  const household = input.householdId
    ? await prisma.household.findUnique({ where: { id: input.householdId } })
    : await getHousehold();
  if (!household) throw new AppError("Household not found.", 404);
  const [rules, transactions] = await Promise.all([
    prisma.forecastRule.findMany({
      where: { householdId: household.id, state: "CONFIRMED", archivedAt: null },
      include: { occurrences: true },
      take: 250,
    }),
    prisma.transaction.findMany({
      where: {
        householdId: household.id,
        ...(input.transactionIds?.length ? { id: { in: input.transactionIds } } : {}),
      },
      include: {
        outgoingTransferMatches: { select: { status: true } },
        incomingTransferMatches: { select: { status: true } },
      },
      orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
      take: input.transactionIds?.length ? 10_000 : 1_000,
    }),
  ]);
  const alreadyMatchedTransactionIds = new Set(
    rules.flatMap((rule) =>
      rule.occurrences
        .map((occurrence) => occurrence.matchedTransactionId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const matches = matchForecastTransactions(
    rules,
    transactions.filter((transaction) => !alreadyMatchedTransactionIds.has(transaction.id)),
  );
  let createdCount = 0;
  for (const match of matches) {
    const existing = await prisma.forecastOccurrence.findUnique({
      where: { ruleId_expectedDate: { ruleId: match.ruleId, expectedDate: match.expectedDate } },
    });
    if (existing?.matchedTransactionId === match.transactionId && existing.status === "MATCHED")
      continue;
    const rule = rules.find((item) => item.id === match.ruleId)!;
    const occurrence = await prisma.forecastOccurrence.upsert({
      where: { ruleId_expectedDate: { ruleId: match.ruleId, expectedDate: match.expectedDate } },
      create: {
        householdId: household.id,
        ruleId: match.ruleId,
        expectedDate: match.expectedDate,
        expectedAmountMinor: rule.typicalAmountMinor,
        status: "MATCHED",
        matchedTransactionId: match.transactionId,
        matchedAt: new Date(),
        dateDifferenceDays: match.dateDifferenceDays,
        amountDifferenceMinor: match.amountDifferenceMinor,
        provenanceJson: JSON.stringify({ score: match.score, reasons: match.reasons }),
      },
      update: {
        status: "MATCHED",
        matchedTransactionId: match.transactionId,
        matchedAt: new Date(),
        dateDifferenceDays: match.dateDifferenceDays,
        amountDifferenceMinor: match.amountDifferenceMinor,
        provenanceJson: JSON.stringify({ score: match.score, reasons: match.reasons }),
      },
    });
    await auditChange(prisma, {
      householdId: household.id,
      entityType: "ForecastOccurrence",
      entityId: occurrence.id,
      action: "transaction_auto_matched",
      field: "matchedTransactionId",
      newValue: match.transactionId,
      source: "forecast",
    });
    createdCount += 1;
  }
  return { createdCount, matches };
}

export async function reconcileForecastOccurrenceMatches(db: Db = prisma) {
  const broken = await db.forecastOccurrence.findMany({
    where: { status: "MATCHED", matchedTransactionId: null },
  });
  for (const item of broken) {
    await db.forecastOccurrence.delete({ where: { id: item.id } });
    await auditChange(db, {
      householdId: item.householdId,
      entityType: "ForecastOccurrence",
      entityId: item.id,
      action: "automatic_match_removed",
      field: "matchedTransactionId",
      previousValue: "deleted transaction",
      source: "forecast",
    });
  }
  return broken.length;
}

export async function refreshForecastIntelligence(householdId: string, transactionIds?: string[]) {
  const matching = await matchForecastOccurrences({ householdId, transactionIds });
  const detection = await detectForecastRules(householdId);
  return { detection, matching };
}

function serializeRule<T extends { reasonsJson: string }>(rule: T) {
  return { ...rule, reasons: parseReasons(rule.reasonsJson) };
}
function parseReasons(value: string) {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}
function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
async function requireRule(id: string) {
  const rule = await prisma.forecastRule.findUnique({ where: { id } });
  if (!rule) throw new AppError("Forecast rule not found.", 404);
  return rule;
}
