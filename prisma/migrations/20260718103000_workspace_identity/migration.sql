CREATE TABLE "WorkspaceMetadata" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceType" TEXT NOT NULL,
  "databaseCreationSource" TEXT NOT NULL,
  "workspaceName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

INSERT INTO "WorkspaceMetadata" (
  "id", "workspaceType", "databaseCreationSource", "workspaceName", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))),
  CASE
    WHEN EXISTS (SELECT 1 FROM "Household" WHERE "workspaceMode" = 'DEMONSTRATION') THEN 'DEMO'
    ELSE 'REAL'
  END,
  'EXISTING_DATABASE_MIGRATION',
  (SELECT "name" FROM "Household" ORDER BY "createdAt" LIMIT 1),
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Household");
