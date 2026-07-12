CREATE TABLE "TransactionSavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "queryJson" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransactionSavedView_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TransactionSavedView_householdId_normalizedName_key" ON "TransactionSavedView"("householdId", "normalizedName");
CREATE INDEX "TransactionSavedView_householdId_isArchived_isDefault_idx" ON "TransactionSavedView"("householdId", "isArchived", "isDefault");
CREATE INDEX "Transaction_householdId_transactionDate_idx" ON "Transaction"("householdId", "transactionDate");
CREATE INDEX "Transaction_householdId_reviewStatus_sourceType_idx" ON "Transaction"("householdId", "reviewStatus", "sourceType");
CREATE INDEX "Transaction_householdId_accountId_categoryId_idx" ON "Transaction"("householdId", "accountId", "categoryId");
