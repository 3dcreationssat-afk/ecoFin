CREATE TABLE "TransferMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "outgoingTransactionId" TEXT NOT NULL,
    "incomingTransactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasonsJson" TEXT NOT NULL,
    "createdBySource" TEXT NOT NULL,
    "notes" TEXT,
    "confirmedAt" DATETIME,
    "rejectedAt" DATETIME,
    "brokenAt" DATETIME,
    "previousOutgoingType" TEXT,
    "previousIncomingType" TEXT,
    "previousOutgoingReviewStatus" TEXT,
    "previousIncomingReviewStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferMatch_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferMatch_outgoingTransactionId_fkey" FOREIGN KEY ("outgoingTransactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferMatch_incomingTransactionId_fkey" FOREIGN KEY ("incomingTransactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TransferMatch_outgoingTransactionId_incomingTransactionId_key" ON "TransferMatch"("outgoingTransactionId", "incomingTransactionId");
CREATE INDEX "TransferMatch_householdId_status_confidence_idx" ON "TransferMatch"("householdId", "status", "confidence");
CREATE INDEX "TransferMatch_outgoingTransactionId_status_idx" ON "TransferMatch"("outgoingTransactionId", "status");
CREATE INDEX "TransferMatch_incomingTransactionId_status_idx" ON "TransferMatch"("incomingTransactionId", "status");
CREATE INDEX "TransferMatch_createdAt_idx" ON "TransferMatch"("createdAt");
CREATE UNIQUE INDEX "TransferMatch_confirmed_outgoing_unique" ON "TransferMatch"("outgoingTransactionId") WHERE "status" = 'CONFIRMED';
CREATE UNIQUE INDEX "TransferMatch_confirmed_incoming_unique" ON "TransferMatch"("incomingTransactionId") WHERE "status" = 'CONFIRMED';
