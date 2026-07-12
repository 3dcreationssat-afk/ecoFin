CREATE TABLE "DecisionScenario" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DecisionScenario_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DecisionScenarioComponent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scenarioId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amountMinor" INTEGER,
  "secondaryAmountMinor" INTEGER,
  "frequency" TEXT,
  "startDate" DATETIME,
  "endDate" DATETIME,
  "durationMonths" INTEGER,
  "essentiality" TEXT,
  "linkedAccountId" TEXT,
  "linkedDebtAccountId" TEXT,
  "linkedGoalId" TEXT,
  "linkedRecurringId" TEXT,
  "policyMode" TEXT,
  "targetBasisPoints" INTEGER,
  "minimumDiscretionaryReserveMinor" INTEGER,
  "extraSafetyReserveMinor" INTEGER,
  "minimumCashRetainedMinor" INTEGER,
  "insuranceIncreaseMinor" INTEGER,
  "operatingIncreaseMinor" INTEGER,
  "tradeInMinor" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DecisionScenarioComponent_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DecisionScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DecisionScenario_householdId_archivedAt_updatedAt_idx" ON "DecisionScenario"("householdId", "archivedAt", "updatedAt");
CREATE INDEX "DecisionScenarioComponent_scenarioId_sortOrder_idx" ON "DecisionScenarioComponent"("scenarioId", "sortOrder");
CREATE INDEX "DecisionScenarioComponent_linkedAccountId_idx" ON "DecisionScenarioComponent"("linkedAccountId");
CREATE INDEX "DecisionScenarioComponent_linkedDebtAccountId_idx" ON "DecisionScenarioComponent"("linkedDebtAccountId");
CREATE INDEX "DecisionScenarioComponent_linkedGoalId_idx" ON "DecisionScenarioComponent"("linkedGoalId");
CREATE INDEX "DecisionScenarioComponent_linkedRecurringId_idx" ON "DecisionScenarioComponent"("linkedRecurringId");
