CREATE TABLE "MerchantRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "matchField" TEXT NOT NULL,
  "matchType" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "normalizedPattern" TEXT NOT NULL,
  "normalizedMerchant" TEXT,
  "categoryId" TEXT,
  "transactionType" TEXT,
  "markReviewed" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "lastAppliedAt" DATETIME,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MerchantRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MerchantRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MerchantRule_householdId_normalizedName_key" ON "MerchantRule"("householdId", "normalizedName");
CREATE INDEX "MerchantRule_householdId_archivedAt_active_priority_idx" ON "MerchantRule"("householdId", "archivedAt", "active", "priority");
ALTER TABLE "Transaction" ADD COLUMN "merchantSource" TEXT NOT NULL DEFAULT 'IMPORT_DEFAULT';
ALTER TABLE "Transaction" ADD COLUMN "categorySource" TEXT NOT NULL DEFAULT 'IMPORT_DEFAULT';
ALTER TABLE "Transaction" ADD COLUMN "typeSource" TEXT NOT NULL DEFAULT 'IMPORT_DEFAULT';
ALTER TABLE "Transaction" ADD COLUMN "reviewSource" TEXT NOT NULL DEFAULT 'IMPORT_DEFAULT';
ALTER TABLE "Transaction" ADD COLUMN "appliedMerchantRuleId" TEXT REFERENCES "MerchantRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD COLUMN "ruleAppliedAt" DATETIME;
CREATE INDEX "Transaction_householdId_appliedMerchantRuleId_idx" ON "Transaction"("householdId", "appliedMerchantRuleId");
