-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "countsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "isRestoreSource" BOOLEAN NOT NULL DEFAULT false,
    "isPreRestore" BOOLEAN NOT NULL DEFAULT false,
    "validationJson" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BackupRecord_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");

-- CreateIndex
CREATE INDEX "BackupRecord_status_idx" ON "BackupRecord"("status");
