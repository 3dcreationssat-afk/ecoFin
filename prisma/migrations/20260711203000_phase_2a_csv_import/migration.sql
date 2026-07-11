-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "importBatchId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "importRowId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Transaction" ADD COLUMN "sourceFilename" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "sourceAccountName" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "sourceRowNumber" INTEGER;

-- CreateTable
CREATE TABLE "ImportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionName" TEXT,
    "accountType" TEXT,
    "delimiter" TEXT NOT NULL,
    "encoding" TEXT NOT NULL,
    "hasHeader" BOOLEAN NOT NULL DEFAULT true,
    "dateColumn" TEXT NOT NULL,
    "postedDateColumn" TEXT,
    "descriptionColumn" TEXT NOT NULL,
    "merchantColumn" TEXT,
    "amountMode" TEXT NOT NULL,
    "amountColumn" TEXT,
    "debitColumn" TEXT,
    "creditColumn" TEXT,
    "dateFormat" TEXT NOT NULL,
    "decimalSeparator" TEXT NOT NULL DEFAULT '.',
    "thousandsSeparator" TEXT NOT NULL DEFAULT ',',
    "signConvention" TEXT NOT NULL DEFAULT 'DEBITS_NEGATIVE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportProfile_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "encoding" TEXT NOT NULL,
    "delimiter" TEXT NOT NULL,
    "importProfileId" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "totalRowCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedRowCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "importedTransactionCount" INTEGER NOT NULL DEFAULT 0,
    "repeatedFile" BOOLEAN NOT NULL DEFAULT false,
    "summaryJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportBatch_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportBatch_importProfileId_fkey" FOREIGN KEY ("importProfileId") REFERENCES "ImportProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceFieldsJson" TEXT NOT NULL,
    "parsedTransactionDate" DATETIME,
    "parsedPostedDate" DATETIME,
    "originalDescription" TEXT,
    "originalAmountText" TEXT,
    "parsedAmountMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "suggestedCategory" TEXT,
    "duplicateStatus" TEXT NOT NULL DEFAULT 'NONE',
    "duplicateReason" TEXT,
    "validationStatus" TEXT NOT NULL,
    "validationErrorsJson" TEXT NOT NULL,
    "importDecision" TEXT NOT NULL,
    "createdTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportRow_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_importRowId_key" ON "Transaction"("importRowId");

-- CreateIndex
CREATE INDEX "Transaction_importBatchId_idx" ON "Transaction"("importBatchId");

-- CreateIndex
CREATE INDEX "ImportProfile_householdId_archivedAt_idx" ON "ImportProfile"("householdId", "archivedAt");

-- CreateIndex
CREATE INDEX "ImportBatch_householdId_createdAt_idx" ON "ImportBatch"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "ImportRow_importBatchId_rowNumber_idx" ON "ImportRow"("importBatchId", "rowNumber");
