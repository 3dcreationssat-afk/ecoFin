-- Add durable system-category identity without changing existing category records.
ALTER TABLE "Category" ADD COLUMN "systemKey" TEXT;
ALTER TABLE "Category" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Category_householdId_systemKey_key"
ON "Category"("householdId", "systemKey");

CREATE INDEX "Category_householdId_isSystem_idx"
ON "Category"("householdId", "isSystem");
