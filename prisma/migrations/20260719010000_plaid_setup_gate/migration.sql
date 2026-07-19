ALTER TABLE "WorkspaceMetadata"
  ADD COLUMN "plaidRealAccessConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkspaceMetadata"
  ADD COLUMN "plaidRealConnectivityEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkspaceMetadata"
  ADD COLUMN "plaidLastConfigCheckAt" DATETIME;
ALTER TABLE "WorkspaceMetadata"
  ADD COLUMN "plaidLastConfigCheckStatus" TEXT;
ALTER TABLE "WorkspaceMetadata"
  ADD COLUMN "plaidLastConfigCheckCode" TEXT;
