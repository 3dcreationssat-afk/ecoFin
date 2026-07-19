import "server-only";

import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { disconnectPlaidItem } from "@/server/plaid/connections";
import { auditChange } from "./audit";
import { createLocalBackup } from "./backup";
import { AppError } from "./errors";

const resetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("TRANSACTIONS"), confirmation: z.literal("CLEAR TRANSACTIONS") }),
  z.object({ scope: z.literal("CSV_HISTORY"), confirmation: z.literal("CLEAR CSV HISTORY") }),
  z.object({ scope: z.literal("PLAID_CONNECTIONS"), confirmation: z.literal("DISCONNECT PLAID") }),
  z.object({
    scope: z.literal("HOUSEHOLD_FINANCIAL"),
    confirmation: z.literal("RESET FINANCIAL DATA"),
  }),
]);

export async function runSelectiveReset(input: unknown) {
  const data = resetSchema.parse(input);
  const [identity, household] = await Promise.all([
    prisma.workspaceMetadata.findFirst(),
    prisma.household.findFirst(),
  ]);
  if (!identity || !household) throw new AppError("Workspace identity is incomplete.", 409);
  if (identity.workspaceType === "TEST" && process.env.NODE_ENV !== "test") {
    throw new AppError(
      "Selective reset is blocked in a TEST workspace outside automated tests.",
      409,
    );
  }
  const safety = await createLocalBackup({
    preRestore: true,
    notes: `Automatic safety backup before selective reset: ${data.scope}`,
  });

  if (data.scope === "PLAID_CONNECTIONS") {
    const items = await disconnectAllPlaidItems();
    await recordReset(household.id, data.scope, items.length, safety.record.filename);
    return {
      scope: data.scope,
      removed: { connectedInstitutions: items.length },
      preserved: ["local transactions", "accounts", "classifications", "rules", "theme preference"],
      safetyBackup: safety.record.filename,
    };
  }

  if (data.scope === "HOUSEHOLD_FINANCIAL") {
    const disconnectedItems = await disconnectAllPlaidItems();
    const before = {
      accounts: await prisma.account.count({ where: { householdId: household.id } }),
      transactions: await prisma.transaction.count({ where: { householdId: household.id } }),
      goals: await prisma.goal.count({ where: { householdId: household.id } }),
      importBatches: await prisma.importBatch.count({ where: { householdId: household.id } }),
    };
    await prisma.$transaction(async (tx) => {
      await tx.decisionScenario.deleteMany({ where: { householdId: household.id } });
      await tx.debtPlan.deleteMany({ where: { householdId: household.id } });
      await tx.transactionSavedView.deleteMany({ where: { householdId: household.id } });
      await tx.merchantRule.deleteMany({ where: { householdId: household.id } });
      await tx.reconciliationAdjustment.deleteMany({ where: { householdId: household.id } });
      await tx.forecastOccurrence.deleteMany({ where: { householdId: household.id } });
      await tx.forecastRule.deleteMany({ where: { householdId: household.id } });
      await tx.expectedIncomeOccurrence.deleteMany({ where: { householdId: household.id } });
      await tx.obligationOccurrence.deleteMany({ where: { householdId: household.id } });
      await tx.expectedIncomeSchedule.deleteMany({ where: { householdId: household.id } });
      await tx.scheduledObligation.deleteMany({ where: { householdId: household.id } });
      await tx.recurringExpenseTransaction.deleteMany({
        where: { recurringExpense: { householdId: household.id } },
      });
      await tx.recurringExpense.deleteMany({ where: { householdId: household.id } });
      await tx.transferMatch.deleteMany({ where: { householdId: household.id } });
      await tx.plaidItem.deleteMany({ where: { householdId: household.id } });
      await tx.importRow.deleteMany({ where: { importBatch: { householdId: household.id } } });
      await tx.transaction.deleteMany({ where: { householdId: household.id } });
      await tx.importBatch.deleteMany({ where: { householdId: household.id } });
      await tx.importProfile.deleteMany({ where: { householdId: household.id } });
      await tx.goalContribution.deleteMany({ where: { goal: { householdId: household.id } } });
      await tx.goal.deleteMany({ where: { householdId: household.id } });
      await tx.account.deleteMany({ where: { householdId: household.id } });
      await tx.notification.deleteMany({ where: { householdId: household.id } });
      await tx.household.update({
        where: { id: household.id },
        data: {
          workspaceMode: "EMPTY",
          checkingBufferMinor: 0,
          emergencyFundTargetMinor: 0,
        },
      });
      await auditChange(tx, {
        householdId: household.id,
        entityType: "WorkspaceReset",
        entityId: data.scope,
        action: "selective_reset",
        field: "householdFinancialData",
        previousValue: before,
        newValue: { accounts: 0, transactions: 0, goals: 0, importBatches: 0 },
        reason: `Safety backup: ${safety.record.filename}`,
        source: "workspace",
      });
    });
    return {
      scope: data.scope,
      removed: { ...before, connectedInstitutions: disconnectedItems.length },
      preserved: [
        "household identity and preferences",
        "default and custom categories",
        "audit history",
        "theme preference",
        "backup files",
      ],
      safetyBackup: safety.record.filename,
    };
  }

  if (data.scope === "CSV_HISTORY") {
    const before = await prisma.importBatch.count();
    await prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { importBatchId: { not: null } },
        data: { importBatchId: null, importRowId: null },
      });
      await tx.importRow.deleteMany();
      await tx.importBatch.deleteMany();
      await tx.importProfile.deleteMany();
      await auditChange(tx, {
        householdId: household.id,
        entityType: "WorkspaceReset",
        entityId: data.scope,
        action: "selective_reset",
        field: "importBatches",
        previousValue: before,
        newValue: 0,
        reason: `Safety backup: ${safety.record.filename}`,
        source: "workspace",
      });
    });
    return {
      scope: data.scope,
      removed: { importBatches: before },
      preserved: [
        "transactions and original source fields",
        "accounts",
        "learned rules",
        "Plaid connections",
        "theme preference",
      ],
      safetyBackup: safety.record.filename,
    };
  }

  const before = await prisma.transaction.count();
  await prisma.$transaction(async (tx) => {
    await tx.importRow.updateMany({ data: { createdTransactionId: null } });
    await tx.transferMatch.deleteMany();
    await tx.recurringExpenseTransaction.deleteMany();
    await tx.plaidTransactionSource.updateMany({
      where: { transactionId: { not: null } },
      data: { transactionId: null, ledgerDisposition: "UNMAPPED" },
    });
    await tx.expectedIncomeOccurrence.updateMany({
      where: { satisfiedTransactionId: { not: null } },
      data: { satisfiedTransactionId: null, satisfiedDate: null, status: "UPCOMING" },
    });
    await tx.obligationOccurrence.updateMany({
      where: { satisfiedTransactionId: { not: null } },
      data: { satisfiedTransactionId: null, satisfiedDate: null, status: "UPCOMING" },
    });
    await tx.forecastOccurrence.updateMany({
      where: { matchedTransactionId: { not: null } },
      data: { matchedTransactionId: null, matchedAt: null, status: "EXPECTED" },
    });
    await tx.transaction.deleteMany();
    await auditChange(tx, {
      householdId: household.id,
      entityType: "WorkspaceReset",
      entityId: data.scope,
      action: "selective_reset",
      field: "transactions",
      previousValue: before,
      newValue: 0,
      reason: `Safety backup: ${safety.record.filename}`,
      source: "workspace",
    });
  });
  return {
    scope: data.scope,
    removed: { transactions: before, transferMatches: "all", recurringEvidenceLinks: "all" },
    preserved: [
      "accounts",
      "categories",
      "goals",
      "import batch metadata",
      "learned rules and schedules",
      "Plaid connections",
      "theme preference",
    ],
    safetyBackup: safety.record.filename,
  };
}

async function disconnectAllPlaidItems() {
  const items = await prisma.plaidItem.findMany({
    where: { status: { not: "DISCONNECTED" }, encryptedAccessToken: { not: null } },
    select: { id: true },
  });
  for (const item of items) {
    await disconnectPlaidItem(item.id, { confirmation: "DISCONNECT" });
  }
  return items;
}

async function recordReset(
  householdId: string,
  scope: string,
  removed: number,
  safetyBackup: string,
) {
  await auditChange(prisma, {
    householdId,
    entityType: "WorkspaceReset",
    entityId: scope,
    action: "selective_reset",
    field: "connectedInstitutions",
    previousValue: removed,
    newValue: 0,
    reason: `Safety backup: ${safetyBackup}`,
    source: "workspace",
  });
}
