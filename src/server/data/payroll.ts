import "server-only";

import { detectPayrollCandidates } from "@/domain/forecast/payroll-detection";
import { financialPeriodBounds } from "@/domain/transactions/query";
import { prisma } from "@/server/db/prisma";
import { AppError } from "./errors";

export async function payrollDashboard(asOf = new Date()) {
  const household = await prisma.household.findFirst({
    select: { id: true, financialMonthStart: true },
  });
  if (!household) throw new AppError("Household not found.", 404);
  const transactions = await prisma.transaction.findMany({
    where: { householdId: household.id },
    include: {
      account: { select: { id: true, name: true } },
      outgoingTransferMatches: { select: { status: true } },
      incomingTransferMatches: { select: { status: true } },
    },
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
    take: 25_000,
  });
  const candidates = detectPayrollCandidates(transactions, asOf);
  const primary = candidates[0] ?? null;
  const payrollIds = new Set(candidates.flatMap((candidate) => candidate.transactionIds));
  const period = financialPeriodBounds("CURRENT_MONTH", household.financialMonthStart, asOf);
  const from = period.from ? new Date(`${period.from}T00:00:00.000Z`) : new Date(0);
  const to = period.to ? new Date(`${period.to}T23:59:59.999Z`) : asOf;
  const currentIncome = transactions.filter(
    (transaction) =>
      transaction.amountMinor > 0 &&
      transaction.transactionDate >= from &&
      transaction.transactionDate <= to &&
      transaction.affectsIncomeSpendingReports &&
      transaction.affectsLedger &&
      !transaction.excluded &&
      !transaction.possibleDuplicate &&
      !["TRANSFER_IN", "REFUND"].includes(transaction.type),
  );
  const currentPayroll = currentIncome.filter((transaction) => payrollIds.has(transaction.id));
  const primaryTransactions = primary
    ? transactions.filter((transaction) => primary.transactionIds.includes(transaction.id))
    : [];
  const unusualPayroll = primary
    ? primaryTransactions.filter(
        (transaction) =>
          (Math.abs(transaction.amountMinor - primary.typicalAmountMinor) * 10_000) /
            Math.max(1, primary.typicalAmountMinor) >
          primary.amountToleranceBps,
      )
    : [];
  const unusualIncome = currentIncome.filter(
    (transaction) =>
      !payrollIds.has(transaction.id) || unusualPayroll.some((item) => item.id === transaction.id),
  );
  const mostRecent = primaryTransactions.at(-1) ?? null;
  return {
    asOf,
    currentMonth: { from, to },
    currentMonthIncomeMinor: sum(currentIncome.map((item) => item.amountMinor)),
    currentMonthIncomeCount: currentIncome.length,
    payrollIncomeMinor: sum(currentPayroll.map((item) => item.amountMinor)),
    payrollIncomeCount: currentPayroll.length,
    typicalPaycheckMinor: primary?.typicalAmountMinor ?? null,
    normalizedMonthlyPayrollMinor: primary
      ? normalizedMonthly(primary.cadence, primary.typicalAmountMinor)
      : null,
    nextExpectedPaycheck: primary?.nextExpectedDate ?? null,
    mostRecentPaycheck: mostRecent
      ? {
          id: mostRecent.id,
          date: mostRecent.postedDate ?? mostRecent.transactionDate,
          amountMinor: mostRecent.amountMinor,
        }
      : null,
    unusualIncomeMinor: sum(unusualIncome.map((item) => item.amountMinor)),
    unusualIncomeCount: unusualIncome.length,
    confidence: primary?.confidence ?? "LIMITED",
    confidenceScore: primary?.confidenceScore ?? 0,
    warnings: primary
      ? [
          ...(primary.confidence === "HIGH"
            ? []
            : ["Payroll evidence is incomplete and should be reviewed."]),
          ...(unusualPayroll.length
            ? [
                `${unusualPayroll.length} payroll amount${unusualPayroll.length === 1 ? " is" : "s are"} outside the expected range.`,
              ]
            : []),
        ]
      : ["No payroll pattern meets the cadence and amount-evidence requirements."],
    reasons: primary?.reasons ?? [],
    primary: primary
      ? {
          merchantKey: primary.merchantKey,
          displayName: primary.displayName,
          cadence: primary.cadence,
          minAmountMinor: primary.minAmountMinor,
          maxAmountMinor: primary.maxAmountMinor,
          contributingTransactions: primaryTransactions.map((transaction) => ({
            id: transaction.id,
            date: transaction.postedDate ?? transaction.transactionDate,
            amountMinor: transaction.amountMinor,
            merchant: transaction.normalizedMerchant || transaction.originalDescription,
            accountName: transaction.account.name,
            sourceType: transaction.sourceType,
            unusual: unusualPayroll.some((item) => item.id === transaction.id),
          })),
        }
      : null,
  };
}

function normalizedMonthly(cadence: string, amountMinor: number) {
  const annualPayments = { WEEKLY: 52, BIWEEKLY: 26, SEMIMONTHLY: 24, MONTHLY: 12 }[cadence] ?? 0;
  return Math.round((amountMinor * annualPayments) / 12);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
