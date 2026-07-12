CREATE TABLE "DebtPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "extraPaymentMinor" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DebtPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DebtPlanOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "debtPlanId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "DebtPlanOrder_debtPlanId_fkey" FOREIGN KEY ("debtPlanId") REFERENCES "DebtPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DebtPlan_householdId_active_archivedAt_idx" ON "DebtPlan"("householdId", "active", "archivedAt");
CREATE INDEX "DebtPlanOrder_accountId_idx" ON "DebtPlanOrder"("accountId");
CREATE UNIQUE INDEX "DebtPlanOrder_debtPlanId_accountId_key" ON "DebtPlanOrder"("debtPlanId", "accountId");
CREATE UNIQUE INDEX "DebtPlanOrder_debtPlanId_position_key" ON "DebtPlanOrder"("debtPlanId", "position");
