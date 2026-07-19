// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-notifications.db";

let notifications: typeof import("./notifications");
let prismaModule: typeof import("@/server/db/prisma");
let householdId: string;

describe("notification center persistence", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-notifications.db" },
    });
    prismaModule = await import("@/server/db/prisma");
    notifications = await import("./notifications");
    householdId = (await prismaModule.prisma.household.findFirstOrThrow()).id;
  }, 120_000);

  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("deduplicates active events and resolves them when the condition clears", async () => {
    const item = await prismaModule.prisma.plaidItem.create({
      data: {
        householdId,
        providerItemId: "notification-test-item",
        encryptedAccessToken: null,
        environment: "sandbox",
        status: "ERROR",
        lastSyncErrorMessage: "Synthetic sync failure.",
      },
    });
    await notifications.refreshNotifications(householdId, new Date("2026-07-18T12:00:00Z"));
    await notifications.refreshNotifications(householdId, new Date("2026-07-18T12:01:00Z"));
    expect(
      await prismaModule.prisma.notification.count({
        where: { householdId, dedupeKey: `plaid-sync:${item.id}` },
      }),
    ).toBe(1);
    await prismaModule.prisma.plaidItem.update({
      where: { id: item.id },
      data: { status: "ACTIVE", lastSyncErrorMessage: null },
    });
    await notifications.refreshNotifications(householdId, new Date("2026-07-18T12:02:00Z"));
    expect(
      await prismaModule.prisma.notification.findUniqueOrThrow({
        where: { householdId_dedupeKey: { householdId, dedupeKey: `plaid-sync:${item.id}` } },
      }),
    ).toMatchObject({ resolvedAt: expect.any(Date) });
  });

  it("persists read and archive state with audit history", async () => {
    const created = await prismaModule.prisma.notification.create({
      data: {
        householdId,
        dedupeKey: "synthetic:read-state",
        type: "DATA_QUALITY",
        severity: "WARNING",
        title: "Synthetic notification",
        message: "Synthetic notification for isolated persistence coverage.",
        occurredAt: new Date(),
      },
    });
    await notifications.updateNotification(created.id, { action: "READ" });
    expect(
      await prismaModule.prisma.notification.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({ readAt: expect.any(Date), archivedAt: null });
    await notifications.updateNotification(created.id, { action: "ARCHIVE" });
    expect(
      await prismaModule.prisma.notification.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({ archivedAt: expect.any(Date) });
    expect(
      await prismaModule.prisma.auditLog.count({
        where: { entityType: "Notification", entityId: created.id },
      }),
    ).toBe(2);
  });
});
