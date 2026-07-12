ALTER TABLE "Account" ADD COLUMN "openingBalanceMinor" INTEGER;
ALTER TABLE "Account" ADD COLUMN "openingBalanceDate" DATETIME;
ALTER TABLE "Account" ADD COLUMN "openingBalanceSource" TEXT;
ALTER TABLE "Account" ADD COLUMN "reportedBalanceMinor" INTEGER;
ALTER TABLE "Account" ADD COLUMN "reportedAvailableMinor" INTEGER;
ALTER TABLE "Account" ADD COLUMN "reportedBalanceAsOf" DATETIME;
ALTER TABLE "Account" ADD COLUMN "ledgerBalanceMinor" INTEGER;
ALTER TABLE "Account" ADD COLUMN "ledgerCalculatedAt" DATETIME;
ALTER TABLE "Account" ADD COLUMN "ledgerStatus" TEXT NOT NULL DEFAULT 'NEEDS_ANCHOR';
ALTER TABLE "Account" ADD COLUMN "lastReconciledAt" DATETIME;
ALTER TABLE "Account" ADD COLUMN "reconciliationStatus" TEXT NOT NULL DEFAULT 'NEEDS_SETUP';
ALTER TABLE "Account" ADD COLUMN "reconciliationDifferenceMinor" INTEGER;
ALTER TABLE "Account" ADD COLUMN "balanceConfidence" TEXT NOT NULL DEFAULT 'LIMITED';
ALTER TABLE "Transaction" ADD COLUMN "affectsLedger" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Transaction" ADD COLUMN "affectsIncomeSpendingReports" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Transaction" ADD COLUMN "clearingStatus" TEXT NOT NULL DEFAULT 'CLEARED';
CREATE TABLE "ReconciliationAdjustment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "effectiveDate" DATETIME NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationAdjustment_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReconciliationAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReconciliationAdjustment_accountId_effectiveDate_idx" ON "ReconciliationAdjustment"("accountId", "effectiveDate");
ALTER TABLE "Account" DROP COLUMN "balanceMinor";
ALTER TABLE "Account" DROP COLUMN "availableMinor";
