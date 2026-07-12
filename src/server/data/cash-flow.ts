import { calculateCashFlow } from "@/domain/cash-flow/engine";
import { prisma } from "@/server/db/prisma";
import { AppError } from "./errors";
import { ensurePlanningOccurrences } from "./planning";

export async function getCashFlowProjection(asOf = new Date()) {
  const occurrenceEnd = new Date(asOf);
  occurrenceEnd.setUTCFullYear(occurrenceEnd.getUTCFullYear() + 1);
  await ensurePlanningOccurrences(occurrenceEnd);
  const household = await prisma.household.findFirst({
    include: {
      accounts: true,
      transactions: true,
      recurringExpenses: true,
      goals: { include: { contributions: true } },
      importBatches: { orderBy: { createdAt: "desc" }, take: 50 },
      expectedIncomeSchedules: { include: { occurrences: true } },
      scheduledObligations: { include: { occurrences: true } },
    },
  });
  if (!household) throw new AppError("Household not found. Run npm run db:seed.", 404);
  return calculateCashFlow({
    asOf,
    financialMonthStart: household.financialMonthStart,
    checkingBufferMinor: household.checkingBufferMinor,
    emergencyFundTargetMinor: household.emergencyFundTargetMinor,
    workspaceMode: household.workspaceMode,
    accounts: household.accounts,
    transactions: household.transactions,
    recurring: household.recurringExpenses,
    goals: household.goals,
    importBatches: household.importBatches,
    expectedIncomeSchedules: household.expectedIncomeSchedules,
    scheduledObligations: household.scheduledObligations,
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
  });
}

export function cashAllocationSummary(projection: Awaited<ReturnType<typeof getCashFlowProjection>>) {
  return {
    cashAfterObligationsAndProtectionsMinor:
      projection.cashAfterObligationsAndProtectionsMinor,
    retainedSafetyReserveMinor: projection.retainedSafetyReserveMinor,
    allocatableSurplusMinor: projection.allocatableSurplusMinor,
    recommendedSafeToSaveMinor: projection.recommendedSafeToSaveMinor,
    conservativeSafeToSaveMinor: projection.conservativeSafeToSaveMinor,
    safeToSpendMinor: projection.safeToSpendMinor,
    unallocatedSurplusMinor: projection.unallocatedSurplusMinor,
    confidence: projection.confidence,
  };
}
