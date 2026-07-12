import { calculateCashFlow } from "@/domain/cash-flow/engine";
import { prisma } from "@/server/db/prisma";
import { AppError } from "./errors";

export async function getCashFlowProjection(asOf = new Date()) {
  const household = await prisma.household.findFirst({
    include: {
      accounts: true,
      transactions: true,
      recurringExpenses: true,
      goals: { include: { contributions: true } },
      importBatches: { orderBy: { createdAt: "desc" }, take: 50 },
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
  });
}
