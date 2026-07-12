CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "serviceName" TEXT,
    "categoryId" TEXT,
    "frequency" TEXT NOT NULL,
    "typicalAmountMinor" INTEGER NOT NULL,
    "minAmountMinor" INTEGER NOT NULL,
    "maxAmountMinor" INTEGER NOT NULL,
    "averageAmountMinor" INTEGER NOT NULL,
    "medianAmountMinor" INTEGER NOT NULL,
    "monthlyEquivalentMinor" INTEGER NOT NULL,
    "annualEquivalentMinor" INTEGER NOT NULL,
    "amountVariabilityBps" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "recurringType" TEXT NOT NULL,
    "firstObservedDate" DATETIME NOT NULL,
    "lastObservedDate" DATETIME NOT NULL,
    "nextExpectedDate" DATETIME,
    "priceChangeAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "priceChangeBps" INTEGER NOT NULL DEFAULT 0,
    "priceChangeEffectiveDate" DATETIME,
    "reasonsJson" TEXT NOT NULL,
    "detectionHash" TEXT NOT NULL,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "userNotes" TEXT,
    "canceledAt" DATETIME,
    "canceledNote" TEXT,
    "expectedFinalChargeDate" DATETIME,
    "reactivateOnFutureMatch" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpense_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RecurringExpenseTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurringExpenseId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "matchRole" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringExpenseTransaction_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpenseTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RecurringExpense_householdId_merchantKey_frequency_key" ON "RecurringExpense"("householdId", "merchantKey", "frequency");
CREATE INDEX "RecurringExpense_householdId_status_confidence_idx" ON "RecurringExpense"("householdId", "status", "confidence");
CREATE INDEX "RecurringExpense_householdId_classification_recommendation_idx" ON "RecurringExpense"("householdId", "classification", "recommendation");
CREATE INDEX "RecurringExpense_nextExpectedDate_idx" ON "RecurringExpense"("nextExpectedDate");
CREATE UNIQUE INDEX "RecurringExpenseTransaction_recurringExpenseId_transactionId_key" ON "RecurringExpenseTransaction"("recurringExpenseId", "transactionId");
CREATE INDEX "RecurringExpenseTransaction_transactionId_idx" ON "RecurringExpenseTransaction"("transactionId");
