import { calculateCashFlow } from "@/domain/cash-flow/engine";
import { prisma } from "@/server/db/prisma";
import { AppError } from "./errors";
import { ensurePlanningOccurrences } from "./planning";
import { financialPeriod } from "@/domain/cash-flow/period";

export async function getCashFlowProjection(asOf = new Date()) {
  return calculateCashFlow(await getCashFlowInput(asOf));
}

export async function getCashFlowInput(asOf = new Date()) {
  const occurrenceEnd = new Date(asOf);
  occurrenceEnd.setUTCFullYear(occurrenceEnd.getUTCFullYear() + 1);
  await ensurePlanningOccurrences(occurrenceEnd);
  const household = await prisma.household.findFirst({
    include: {
      accounts: true,
      recurringExpenses: true,
      goals: { include: { contributions: true } },
      importBatches: { orderBy: { createdAt: "desc" }, take: 50 },
      expectedIncomeSchedules: { include: { occurrences: true } },
      scheduledObligations: { include: { occurrences: true } },
      emergencyFundConfiguration: { include: { accounts: true } },
      forecastRules: { include: { occurrences: true } },
    },
  });
  if (!household) throw new AppError("Household not found. Run npm run db:seed.", 404);
  const period = financialPeriod(asOf, household.financialMonthStart);
  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: household.id,
      OR: [{ transactionDate: { gte: period.start, lt: asOf } }, { possibleDuplicate: true }],
    },
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
    take: 25_000,
  });
  return {
    asOf,
    timezone: household.timezone,
    financialMonthStart: household.financialMonthStart,
    checkingBufferMinor: household.checkingBufferMinor,
    emergencyFundTargetMinor: household.emergencyFundTargetMinor,
    emergencyFundConfiguration: household.emergencyFundConfiguration,
    workspaceMode: household.workspaceMode,
    accounts: household.accounts,
    transactions,
    recurring: household.recurringExpenses,
    goals: household.goals,
    importBatches: household.importBatches,
    expectedIncomeSchedules: household.expectedIncomeSchedules,
    scheduledObligations: household.scheduledObligations,
    forecastRules: household.forecastRules,
    savingsPolicy: {
      mode: household.savingsRecommendationMode,
      targetBps: household.savingsTargetBps,
      minimumDiscretionaryReserveMinor: household.minimumDiscretionaryReserveMinor,
      extraSafetyReserveMinor: household.extraSafetyReserveMinor,
      minimumCashRetainedMinor: household.minimumCashRetainedMinor,
      includeGoalContributions: household.includeGoalContributionsInSafeToSave,
      emergencyShortfallIncreasesRecommendation:
        household.emergencyShortfallIncreasesRecommendation,
      conservativeAdjustmentBps: household.conservativeConfidenceAdjustmentBps,
    },
  };
}

export function cashAllocationSummary(
  projection: Awaited<ReturnType<typeof getCashFlowProjection>>,
) {
  return {
    cashAfterObligationsAndProtectionsMinor: projection.cashAfterObligationsAndProtectionsMinor,
    retainedSafetyReserveMinor: projection.retainedSafetyReserveMinor,
    allocatableSurplusMinor: projection.allocatableSurplusMinor,
    recommendedSafeToSaveMinor: projection.recommendedSafeToSaveMinor,
    conservativeSafeToSaveMinor: projection.conservativeSafeToSaveMinor,
    safeToSpendMinor: projection.safeToSpendMinor,
    unallocatedSurplusMinor: projection.unallocatedSurplusMinor,
    confidence: projection.confidence,
  };
}
