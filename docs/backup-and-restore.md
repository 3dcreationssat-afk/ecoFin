# Backup And Restore

Manifest counts and validation include emergency configurations and normalized account links.
Restore preserves designation, amount modes, targets, goal purposes, and audit history.

Current-schema SQLite backups include `DebtPlan` and `DebtPlanOrder`; the manifest reports plan count.
Generated payoff schedules are recalculated and therefore are not persisted backup records.

Backups include `DecisionScenario` and `DecisionScenarioComponent`, with both counts in the manifest.
Scenario evaluation output is reproducible and is not stored in the archive.

Manifests and validation include planning schedules and occurrences; household policy fields travel with the SQLite household record.

Financial Compass Phase 2B implements local backup and restore for the active SQLite database.

## Backup Behavior

- Backups are created only from the explicitly configured local SQLite `file:` database. The active
  database may use a stable absolute path outside the repository.
- Backup packages are written to `backups/local/` and are ignored by Git.
- Each package is a ZIP file containing:
  - `database.sqlite`
  - `manifest.json`
  - `README.txt`
- The manifest records app version, schema fingerprint, creation time, table counts, database size, database SHA-256, source environment, and whether demo data is present.
- Backups are validated before being marked `READY`.
- Backup metadata is stored in the `BackupRecord` table. Backup files remain local filesystem artifacts.
- Backup creation writes audit records for requested, completed, failed, downloaded, and deleted backup actions.
- Every current backup contains exactly one persistent `WorkspaceMetadata` identity. Validation
  rejects missing or ambiguous workspace identity.

## Database Path And Identity

- `DATABASE_URL` is required. Application startup never falls back to `file:./dev.db`, creates a
  replacement database, or seeds demonstration data.
- Normal real development uses an absolute SQLite URL. A `file:./name.db` URL is accepted for
  isolated tests and resolves deterministically relative to the repository's `prisma/` directory,
  not the shell's current directory.
- Startup resolves and logs the absolute database path, reads the stable workspace ID/type, and can
  enforce `FINANCIAL_COMPASS_EXPECTED_WORKSPACE_ID` as a non-sensitive smoke assertion.
- Unit reset requires `FINANCIAL_COMPASS_WORKSPACE_TYPE=TEST` and a `vitest-*` or `test-results`
  path. Playwright uses `prisma/vitest-playwright.db` and a separately started test server; test
  artifacts use `playwright-artifacts/` and never contain the test database.

## Restore Behavior

- Restore accepts only validated backup ZIP packages with the same application version and schema fingerprint.
- Restore requires the exact confirmation phrase `RESTORE BACKUP`.
- Before replacing the active database, restore creates a mandatory pre-restore safety backup.
- The incoming database is extracted to a temporary directory, checked with SQLite `PRAGMA integrity_check`, and verified for required application tables.
- The active SQLite file is replaced only after validation passes.
- If post-replacement validation fails, the service copies the pre-restore recovery file back into place and records an automatic rollback audit entry.
- Restore source metadata is recorded in `BackupRecord` with status `RESTORED_FROM`.
- Workspace ID, type, creation source, name, and timestamp are restored with the database and
  validated after extraction.
- Transfer, recurring, forecast-rule, and sparse forecast-occurrence relationships are stored in
  SQLite and are preserved by backup and restore.

## Validation Rules

Backup validation rejects:

- corrupt or unreadable ZIP archives
- archives larger than the configured package size limit
- archives with too many files or excessive extracted size
- directories, duplicate entries, unsupported filenames, or unsafe entry paths
- missing `database.sqlite` or `manifest.json`
- unsupported backup format, app version, or schema fingerprint
- mismatched database SHA-256
- non-SQLite files or SQLite databases failing integrity checks
- databases missing required Phase 2B tables
- databases missing the Phase 2C `TransferMatch` table
- databases missing the Phase 2D recurring expense tables

## User Interfaces

- Settings contains backup creation, backup history, download, deletion, restore validation, and restore confirmation controls.
- Backup deletion requires the exact phrase `DELETE BACKUP`.
- CLI scripts are also available:
  - `npm run backup`
  - `npm run backup:list`
  - `npm run backup:validate -- <backup.zip>`
  - `RESTORE_CONFIRMATION="RESTORE BACKUP" npm run restore -- <backup.zip>`

## Security Notes

Backup packages are not encrypted by the application. They contain complete local SQLite financial data and must be treated as sensitive personal financial records.

Do not commit, upload, email, or share backup ZIP files. Store them only in a location appropriate for sensitive household financial data.

## Limitations

- Backup/restore is local-only and does not sync to cloud storage.
- Restore supports only the same application version and same committed migration fingerprint.
- Restore supports transfer and recurring relationships only for the same schema fingerprint.
- Saved transaction views are contained in SQLite backups and validated during restore. Start Fresh and demonstration reset remove them; canonical demonstration data does not seed saved views.
- Category rows, including default/custom identity and hierarchy, are restored exactly from the backup. Restore never invokes the default-category seeder. Start Fresh removes custom categories and recreates only the canonical defaults.
- Merchant rules and transaction field provenance are included in SQLite backups and schema validation. Start Fresh and demo reset remove rules; canonical demo data seeds none.
- Opening anchors, ledger/reconciliation state, and reconciliation adjustments are included in backup validation and restore. Demo reset recreates reconciled synthetic anchors; Start Fresh removes adjustments.
- Settings provides selective transaction clearing, CSV-history clearing, Plaid disconnect,
  household-financial-data reset, full workspace reset, and whole-backup restore. There is no
  selective table-level restore, merge restore, encrypted archive format, remote backup provider, or
  scheduled backup job.
- Demo reset clears backup metadata in SQLite but does not delete ZIP files already written under `backups/local/`.
