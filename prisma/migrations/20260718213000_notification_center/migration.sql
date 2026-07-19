CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "occurredAt" DATETIME NOT NULL,
  "readAt" DATETIME,
  "archivedAt" DATETIME,
  "resolvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Notification_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Notification_householdId_dedupeKey_key"
  ON "Notification"("householdId", "dedupeKey");
CREATE INDEX "Notification_householdId_archivedAt_resolvedAt_occurredAt_idx"
  ON "Notification"("householdId", "archivedAt", "resolvedAt", "occurredAt");
CREATE INDEX "Notification_householdId_readAt_archivedAt_idx"
  ON "Notification"("householdId", "readAt", "archivedAt");
