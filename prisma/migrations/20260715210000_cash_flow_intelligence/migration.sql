ALTER TABLE "Household" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Chicago';

CREATE TABLE "ForecastRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "accountId" TEXT,
  "recurringExpenseId" TEXT,
  "name" TEXT NOT NULL,
  "merchantKey" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "anchorDate" DATETIME NOT NULL,
  "lastObservedDate" DATETIME,
  "nextExpectedDate" DATETIME NOT NULL,
  "typicalAmountMinor" INTEGER NOT NULL,
  "minAmountMinor" INTEGER NOT NULL,
  "maxAmountMinor" INTEGER NOT NULL,
  "amountVariabilityBps" INTEGER NOT NULL DEFAULT 0,
  "dateToleranceDays" INTEGER NOT NULL DEFAULT 3,
  "amountToleranceBps" INTEGER NOT NULL DEFAULT 1500,
  "expectedWeekday" INTEGER,
  "semimonthlyDay1" INTEGER,
  "semimonthlyDay2" INTEGER,
  "confidence" TEXT NOT NULL,
  "confidenceScore" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "provenance" TEXT NOT NULL,
  "creationSource" TEXT NOT NULL,
  "sourceRecordType" TEXT,
  "sourceRecordId" TEXT,
  "effectiveStartDate" DATETIME NOT NULL,
  "endDate" DATETIME,
  "reasonsJson" TEXT NOT NULL,
  "detectionFingerprint" TEXT NOT NULL,
  "userOverridesJson" TEXT,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ForecastRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForecastRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ForecastRule_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ForecastOccurrence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "expectedDate" DATETIME NOT NULL,
  "expectedAmountMinor" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "overrideDate" DATETIME,
  "overrideAmountMinor" INTEGER,
  "matchedTransactionId" TEXT,
  "matchedAt" DATETIME,
  "dateDifferenceDays" INTEGER NOT NULL DEFAULT 0,
  "amountDifferenceMinor" INTEGER NOT NULL DEFAULT 0,
  "provenanceJson" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ForecastOccurrence_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForecastOccurrence_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ForecastRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForecastOccurrence_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ForecastRule_detectionFingerprint_key" ON "ForecastRule"("detectionFingerprint");
CREATE INDEX "ForecastRule_householdId_state_direction_idx" ON "ForecastRule"("householdId", "state", "direction");
CREATE INDEX "ForecastRule_householdId_nextExpectedDate_idx" ON "ForecastRule"("householdId", "nextExpectedDate");
CREATE INDEX "ForecastRule_accountId_state_idx" ON "ForecastRule"("accountId", "state");
CREATE INDEX "ForecastRule_sourceRecordType_sourceRecordId_idx" ON "ForecastRule"("sourceRecordType", "sourceRecordId");
CREATE UNIQUE INDEX "ForecastOccurrence_matchedTransactionId_key" ON "ForecastOccurrence"("matchedTransactionId");
CREATE UNIQUE INDEX "ForecastOccurrence_ruleId_expectedDate_key" ON "ForecastOccurrence"("ruleId", "expectedDate");
CREATE INDEX "ForecastOccurrence_householdId_status_expectedDate_idx" ON "ForecastOccurrence"("householdId", "status", "expectedDate");
CREATE INDEX "ForecastOccurrence_ruleId_status_idx" ON "ForecastOccurrence"("ruleId", "status");

INSERT INTO "ForecastRule" (
  "id", "householdId", "accountId", "recurringExpenseId", "name", "merchantKey", "direction",
  "cadence", "anchorDate", "lastObservedDate", "nextExpectedDate", "typicalAmountMinor",
  "minAmountMinor", "maxAmountMinor", "amountVariabilityBps", "dateToleranceDays",
  "amountToleranceBps", "confidence", "confidenceScore", "state", "provenance",
  "creationSource", "sourceRecordType", "sourceRecordId", "effectiveStartDate", "endDate",
  "reasonsJson", "detectionFingerprint", "archivedAt", "updatedAt"
)
SELECT lower(hex(randomblob(16))), s."householdId", s."accountId", s."recurringExpenseId", s."name",
  lower(trim(s."name")), 'INCOME', s."frequency", s."nextExpectedDate", r."lastObservedDate",
  s."nextExpectedDate", s."amountMinor", s."amountMinor", s."amountMinor", 0, 3, 1500,
  s."confidence", CASE s."confidence" WHEN 'HIGH' THEN 95 WHEN 'MEDIUM' THEN 75 ELSE 55 END,
  CASE WHEN s."archivedAt" IS NOT NULL THEN 'ARCHIVED' WHEN s."active" = 0 THEN 'PAUSED' ELSE 'CONFIRMED' END,
  'Migrated expected-income schedule', 'MIGRATED', 'ExpectedIncomeSchedule', s."id",
  s."nextExpectedDate", s."endDate", '["Migrated without changing the original schedule."]',
  'income-schedule:' || s."id", s."archivedAt", CURRENT_TIMESTAMP
FROM "ExpectedIncomeSchedule" s
LEFT JOIN "RecurringExpense" r ON r."id" = s."recurringExpenseId";

INSERT INTO "ForecastRule" (
  "id", "householdId", "accountId", "recurringExpenseId", "name", "merchantKey", "direction",
  "cadence", "anchorDate", "lastObservedDate", "nextExpectedDate", "typicalAmountMinor",
  "minAmountMinor", "maxAmountMinor", "amountVariabilityBps", "dateToleranceDays",
  "amountToleranceBps", "confidence", "confidenceScore", "state", "provenance",
  "creationSource", "sourceRecordType", "sourceRecordId", "effectiveStartDate", "reasonsJson",
  "detectionFingerprint", "archivedAt", "updatedAt"
)
SELECT lower(hex(randomblob(16))), s."householdId", s."accountId", s."recurringExpenseId", s."name",
  lower(trim(s."name")), 'EXPENSE', s."frequency", s."dueDate", r."lastObservedDate", s."dueDate",
  s."amountMinor", s."amountMinor", s."amountMinor", 0, 3, 1500, s."confidence",
  CASE s."confidence" WHEN 'HIGH' THEN 95 WHEN 'MEDIUM' THEN 75 ELSE 55 END,
  CASE WHEN s."archivedAt" IS NOT NULL THEN 'ARCHIVED' WHEN s."active" = 0 THEN 'PAUSED' ELSE 'CONFIRMED' END,
  'Migrated scheduled obligation', 'MIGRATED', 'ScheduledObligation', s."id", s."dueDate",
  '["Migrated without changing the original obligation."]', 'obligation:' || s."id", s."archivedAt",
  CURRENT_TIMESTAMP
FROM "ScheduledObligation" s
LEFT JOIN "RecurringExpense" r ON r."id" = s."recurringExpenseId";

INSERT INTO "ForecastRule" (
  "id", "householdId", "recurringExpenseId", "name", "merchantKey", "direction", "cadence",
  "anchorDate", "lastObservedDate", "nextExpectedDate", "typicalAmountMinor", "minAmountMinor",
  "maxAmountMinor", "amountVariabilityBps", "dateToleranceDays", "amountToleranceBps",
  "confidence", "confidenceScore", "state", "provenance", "creationSource", "sourceRecordType",
  "sourceRecordId", "effectiveStartDate", "reasonsJson", "detectionFingerprint", "updatedAt"
)
SELECT lower(hex(randomblob(16))), r."householdId", r."id", r."displayName", r."merchantKey",
  CASE WHEN r."recurringType" = 'INCOME' THEN 'INCOME' ELSE 'EXPENSE' END, r."frequency",
  r."lastObservedDate", r."lastObservedDate", r."nextExpectedDate", abs(r."typicalAmountMinor"),
  abs(r."minAmountMinor"), abs(r."maxAmountMinor"), r."amountVariabilityBps", 3, 1500,
  r."confidence", r."confidenceScore",
  CASE r."status" WHEN 'CONFIRMED' THEN 'CONFIRMED' WHEN 'REJECTED' THEN 'IGNORED' WHEN 'CANCELED' THEN 'ENDED' WHEN 'INACTIVE' THEN 'PAUSED' ELSE 'DETECTED' END,
  'Migrated recurring evidence without an account assumption', 'MIGRATED', 'RecurringExpense', r."id",
  r."firstObservedDate", r."reasonsJson", 'recurring:' || r."id", CURRENT_TIMESTAMP
FROM "RecurringExpense" r
WHERE r."nextExpectedDate" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ExpectedIncomeSchedule" i WHERE i."recurringExpenseId" = r."id")
  AND NOT EXISTS (SELECT 1 FROM "ScheduledObligation" o WHERE o."recurringExpenseId" = r."id");
