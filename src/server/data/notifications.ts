import "server-only";

import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { auditChange } from "./audit";
import { AppError } from "./errors";
import { getHousehold } from "./repositories";

const MANAGED_TYPES = [
  "PLAID_SYNC",
  "PLAID_REAUTH",
  "STALE_BALANCE",
  "IMPORT_FAILURE",
  "DATA_QUALITY",
  "UPCOMING_OBLIGATION",
  "MISSING_PAYROLL",
  "BACKUP_FAILURE",
  "OPERATION_RESULT",
] as const;

type Candidate = {
  dedupeKey: string;
  type: (typeof MANAGED_TYPES)[number];
  severity: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  title: string;
  message: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  occurredAt: Date;
};

const notificationActionSchema = z.object({
  action: z.enum(["READ", "UNREAD", "ARCHIVE"]),
});

export async function notificationDashboard() {
  const household = await getHousehold();
  await refreshNotifications(household.id);
  const notifications = await prisma.notification.findMany({
    where: { householdId: household.id, archivedAt: null, resolvedAt: null },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return {
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      href: notification.href,
      occurredAt: notification.occurredAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
    })),
  };
}

export async function updateNotification(id: string, input: unknown) {
  const data = notificationActionSchema.parse(input);
  const household = await getHousehold();
  const notification = await prisma.notification.findFirst({
    where: { id, householdId: household.id },
  });
  if (!notification) throw new AppError("Notification not found.", 404);
  const now = new Date();
  const updated = await prisma.notification.update({
    where: { id },
    data:
      data.action === "ARCHIVE"
        ? { archivedAt: now, readAt: notification.readAt ?? now }
        : { readAt: data.action === "READ" ? now : null },
  });
  await auditChange(prisma, {
    householdId: household.id,
    entityType: "Notification",
    entityId: id,
    action: data.action.toLowerCase(),
    field: data.action === "ARCHIVE" ? "archivedAt" : "readAt",
    newValue: data.action === "UNREAD" ? null : now,
    source: "user",
  });
  return { id: updated.id, action: data.action };
}

export async function markAllNotificationsRead() {
  const household = await getHousehold();
  const result = await prisma.notification.updateMany({
    where: {
      householdId: household.id,
      archivedAt: null,
      resolvedAt: null,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

export async function refreshNotifications(householdId: string, now = new Date()) {
  const candidates = await collectCandidates(householdId, now);
  const keys = candidates.map((candidate) => candidate.dedupeKey);
  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      await tx.notification.upsert({
        where: { householdId_dedupeKey: { householdId, dedupeKey: candidate.dedupeKey } },
        create: { householdId, ...candidate },
        update: {
          type: candidate.type,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          href: candidate.href,
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          occurredAt: candidate.occurredAt,
          resolvedAt: null,
        },
      });
    }
    await tx.notification.updateMany({
      where: {
        householdId,
        type: { in: [...MANAGED_TYPES] },
        resolvedAt: null,
        ...(keys.length ? { dedupeKey: { notIn: keys } } : {}),
      },
      data: { resolvedAt: now },
    });
  });
}

async function collectCandidates(householdId: string, now: Date): Promise<Candidate[]> {
  const staleBefore = new Date(now.getTime() - 3 * 86_400_000);
  const upcomingThrough = new Date(now.getTime() + 7 * 86_400_000);
  const recentOperationAfter = new Date(now.getTime() - 30 * 86_400_000);
  const [
    plaidItems,
    staleAccounts,
    failedImports,
    reviewCount,
    upcomingObligations,
    missingIncome,
    failedBackups,
    operationResults,
  ] = await Promise.all([
    prisma.plaidItem.findMany({
      where: {
        householdId,
        status: { in: ["ERROR", "REAUTHENTICATION_REQUIRED"] },
        disconnectedAt: null,
      },
    }),
    prisma.plaidAccount.findMany({
      where: {
        item: { householdId, disconnectedAt: null },
        archivedAt: null,
        OR: [{ balanceAsOf: null }, { balanceAsOf: { lt: staleBefore } }],
      },
      include: { item: true },
    }),
    prisma.importBatch.findMany({
      where: { householdId, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.transaction.count({
      where: {
        householdId,
        reviewStatus: { in: ["NEEDS_REVIEW", "FLAGGED"] },
        affectsLedger: true,
      },
    }),
    prisma.obligationOccurrence.findMany({
      where: {
        householdId,
        status: "UPCOMING",
        expectedDate: { gte: now, lte: upcomingThrough },
      },
      include: { obligation: true },
      take: 25,
    }),
    prisma.expectedIncomeOccurrence.findMany({
      where: { householdId, status: "UPCOMING", expectedDate: { lt: now } },
      include: { schedule: true },
      take: 25,
    }),
    prisma.backupRecord.findMany({
      where: { householdId, status: "FAILED", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: {
        householdId,
        createdAt: { gte: recentOperationAfter },
        action: {
          in: [
            "restore_completed",
            "automatic_rollback_completed",
            "demo_reset",
            "workspace_start_fresh",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const candidates: Candidate[] = [];
  for (const item of plaidItems) {
    const reauth = item.reauthenticationRequired || item.status === "REAUTHENTICATION_REQUIRED";
    candidates.push({
      dedupeKey: `${reauth ? "plaid-reauth" : "plaid-sync"}:${item.id}`,
      type: reauth ? "PLAID_REAUTH" : "PLAID_SYNC",
      severity: reauth ? "ERROR" : "WARNING",
      title: reauth ? "Institution needs attention" : "Institution sync failed",
      message: reauth
        ? "Reconnect this institution to resume updates."
        : (item.lastSyncErrorMessage ?? "The latest institution synchronization did not complete."),
      href: "/accounts",
      entityType: "PlaidItem",
      entityId: item.id,
      occurredAt: item.updatedAt,
    });
  }
  for (const account of staleAccounts) {
    candidates.push({
      dedupeKey: `stale-balance:${account.id}`,
      type: "STALE_BALANCE",
      severity: "WARNING",
      title: "Connected balance is stale",
      message: "Sync the connected institution to refresh this account balance.",
      href: "/accounts",
      entityType: "PlaidAccount",
      entityId: account.id,
      occurredAt: account.balanceAsOf ?? account.updatedAt,
    });
  }
  for (const batch of failedImports) {
    candidates.push({
      dedupeKey: `import-failure:${batch.id}`,
      type: "IMPORT_FAILURE",
      severity: "ERROR",
      title: "Import did not complete",
      message: "Review the staged import and validation errors before trying again.",
      href: "/transactions?import=1",
      entityType: "ImportBatch",
      entityId: batch.id,
      occurredAt: batch.updatedAt,
    });
  }
  if (reviewCount > 0) {
    candidates.push({
      dedupeKey: "data-quality:material-review",
      type: "DATA_QUALITY",
      severity: "WARNING",
      title: "Material transactions need review",
      message: `${reviewCount} ledger transaction${reviewCount === 1 ? "" : "s"} require attention.`,
      href: "/data-quality",
      occurredAt: now,
    });
  }
  for (const occurrence of upcomingObligations) {
    candidates.push({
      dedupeKey: `obligation:${occurrence.id}`,
      type: "UPCOMING_OBLIGATION",
      severity: "INFO",
      title: "Upcoming obligation",
      message: `${occurrence.obligation.name} is expected ${formatRelativeDate(occurrence.expectedDate, now)}.`,
      href: "/cash-flow",
      entityType: "ObligationOccurrence",
      entityId: occurrence.id,
      occurredAt: occurrence.expectedDate,
    });
  }
  for (const occurrence of missingIncome) {
    candidates.push({
      dedupeKey: `missing-income:${occurrence.id}`,
      type: "MISSING_PAYROLL",
      severity: "ERROR",
      title: "Expected income may be missing",
      message: `${occurrence.schedule.name} was expected ${formatRelativeDate(occurrence.expectedDate, now)}.`,
      href: "/cash-flow",
      entityType: "ExpectedIncomeOccurrence",
      entityId: occurrence.id,
      occurredAt: occurrence.expectedDate,
    });
  }
  for (const backup of failedBackups) {
    candidates.push({
      dedupeKey: `backup-failure:${backup.id}`,
      type: "BACKUP_FAILURE",
      severity: "ERROR",
      title: "Backup failed",
      message: "The local backup was not completed. Review Backup & Data settings.",
      href: "/settings#backup",
      entityType: "BackupRecord",
      entityId: backup.id,
      occurredAt: backup.updatedAt,
    });
  }
  for (const result of operationResults) {
    const labels: Record<string, [string, string, Candidate["severity"]]> = {
      restore_completed: [
        "Restore completed",
        "The local workspace was restored successfully.",
        "SUCCESS",
      ],
      automatic_rollback_completed: [
        "Restore rolled back safely",
        "The attempted restore failed and the previous database was restored.",
        "WARNING",
      ],
      demo_reset: [
        "Demonstration data restored",
        "The demonstration workspace reset completed.",
        "SUCCESS",
      ],
      workspace_start_fresh: [
        "Start Fresh completed",
        "The new empty workspace is ready.",
        "SUCCESS",
      ],
    };
    const [title, message, severity] = labels[result.action];
    candidates.push({
      dedupeKey: `operation:${result.id}`,
      type: "OPERATION_RESULT",
      severity,
      title,
      message,
      href: "/settings#backup",
      entityType: result.entityType,
      entityId: result.entityId,
      occurredAt: result.createdAt,
    });
  }
  return candidates;
}

function formatRelativeDate(date: Date, now: Date) {
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 1 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}
