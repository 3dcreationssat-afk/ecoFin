ALTER TABLE "Transaction" ADD COLUMN "interpretationType" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "interpretationConfidence" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "interpretationReason" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "interpretationEvidenceJson" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "interpretationAutoApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "interpretationReviewRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PlaidUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaidUser_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PlaidItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "providerItemId" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "encryptedAccessToken" TEXT,
    "tokenKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "consentExpiresAt" DATETIME,
    "syncCursor" TEXT,
    "syncLockedAt" DATETIME,
    "lastSyncStartedAt" DATETIME,
    "lastSuccessfulSyncAt" DATETIME,
    "lastSyncErrorCode" TEXT,
    "lastSyncErrorMessage" TEXT,
    "reauthenticationRequired" BOOLEAN NOT NULL DEFAULT false,
    "disconnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaidItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PlaidAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plaidItemId" TEXT NOT NULL,
    "localAccountId" TEXT,
    "providerAccountId" TEXT NOT NULL,
    "persistentAccountId" TEXT,
    "officialName" TEXT,
    "displayName" TEXT NOT NULL,
    "mask" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "currency" TEXT,
    "currentBalanceMinor" INTEGER,
    "availableBalanceMinor" INTEGER,
    "limitBalanceMinor" INTEGER,
    "balanceAsOf" DATETIME,
    "selectedForImport" BOOLEAN NOT NULL DEFAULT true,
    "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchConfidence" TEXT,
    "matchEvidenceJson" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaidAccount_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaidAccount_localAccountId_fkey" FOREIGN KEY ("localAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PlaidTransactionSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plaidAccountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "providerTransactionId" TEXT NOT NULL,
    "pendingProviderTransactionId" TEXT,
    "authorizedDate" DATETIME,
    "postedDate" DATETIME NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT,
    "rawName" TEXT NOT NULL,
    "merchantName" TEXT,
    "providerCategoryPrimary" TEXT,
    "providerCategoryDetailed" TEXT,
    "providerTransactionCode" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ledgerDisposition" TEXT NOT NULL DEFAULT 'UNMAPPED',
    "reconciliationEvidenceJson" TEXT,
    "removedAt" DATETIME,
    "providerModifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaidTransactionSource_plaidAccountId_fkey" FOREIGN KEY ("plaidAccountId") REFERENCES "PlaidAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaidTransactionSource_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PlaidSyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plaidItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "cursorBefore" TEXT,
    "cursorAfter" TEXT,
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "modifiedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "PlaidSyncRun_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlaidUser_providerUserId_key" ON "PlaidUser"("providerUserId");
CREATE UNIQUE INDEX "PlaidUser_householdId_environment_key" ON "PlaidUser"("householdId", "environment");
CREATE UNIQUE INDEX "PlaidItem_providerItemId_key" ON "PlaidItem"("providerItemId");
CREATE INDEX "PlaidItem_householdId_status_idx" ON "PlaidItem"("householdId", "status");
CREATE UNIQUE INDEX "PlaidAccount_providerAccountId_key" ON "PlaidAccount"("providerAccountId");
CREATE UNIQUE INDEX "PlaidAccount_plaidItemId_persistentAccountId_key" ON "PlaidAccount"("plaidItemId", "persistentAccountId");
CREATE INDEX "PlaidAccount_plaidItemId_archivedAt_idx" ON "PlaidAccount"("plaidItemId", "archivedAt");
CREATE INDEX "PlaidAccount_localAccountId_idx" ON "PlaidAccount"("localAccountId");
CREATE UNIQUE INDEX "PlaidTransactionSource_transactionId_key" ON "PlaidTransactionSource"("transactionId");
CREATE UNIQUE INDEX "PlaidTransactionSource_providerTransactionId_key" ON "PlaidTransactionSource"("providerTransactionId");
CREATE INDEX "PlaidTransactionSource_plaidAccountId_postedDate_idx" ON "PlaidTransactionSource"("plaidAccountId", "postedDate");
CREATE INDEX "PlaidTransactionSource_pendingProviderTransactionId_idx" ON "PlaidTransactionSource"("pendingProviderTransactionId");
CREATE INDEX "PlaidSyncRun_plaidItemId_startedAt_idx" ON "PlaidSyncRun"("plaidItemId", "startedAt");
