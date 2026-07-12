ALTER TABLE "Goal" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'GENERAL';

CREATE TABLE "EmergencyFundConfiguration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "targetAmountMinor" INTEGER,
  "targetRunwayMonths" INTEGER NOT NULL DEFAULT 3,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "EmergencyFundConfiguration_householdId_key" ON "EmergencyFundConfiguration"("householdId");

CREATE TABLE "EmergencyFundAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "emergencyFundConfigurationId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "includedAmountMode" TEXT NOT NULL DEFAULT 'ENTIRE_BALANCE',
  "fixedProtectedAmountMinor" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("emergencyFundConfigurationId") REFERENCES "EmergencyFundConfiguration"("id") ON DELETE CASCADE,
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "EmergencyFundAccount_accountId_key" ON "EmergencyFundAccount"("accountId");
CREATE UNIQUE INDEX "EmergencyFundAccount_emergencyFundConfigurationId_accountId_key" ON "EmergencyFundAccount"("emergencyFundConfigurationId", "accountId");
CREATE INDEX "EmergencyFundAccount_emergencyFundConfigurationId_sortOrder_idx" ON "EmergencyFundAccount"("emergencyFundConfigurationId", "sortOrder");

UPDATE "Goal" SET "purpose" = 'EMERGENCY_FUND'
WHERE "isDemo" = true AND "name" = 'Emergency Fund';

INSERT INTO "EmergencyFundConfiguration" ("id", "householdId", "enabled", "targetAmountMinor", "targetRunwayMonths", "updatedAt")
SELECT 'emergency-config-' || "id", "id", true, 1500000, 3, CURRENT_TIMESTAMP
FROM "Household" WHERE "workspaceMode" = 'DEMONSTRATION';

INSERT INTO "EmergencyFundAccount" ("id", "emergencyFundConfigurationId", "accountId", "includedAmountMode", "fixedProtectedAmountMinor", "sortOrder", "updatedAt")
SELECT 'emergency-account-' || a."id", 'emergency-config-' || a."householdId", a."id", 'FIXED_AMOUNT', 840000, 0, CURRENT_TIMESTAMP
FROM "Account" a JOIN "Household" h ON h."id" = a."householdId"
WHERE h."workspaceMode" = 'DEMONSTRATION' AND a."isDemo" = true AND a."name" = 'High-Yield Savings';
