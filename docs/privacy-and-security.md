# Privacy And Security

Financial Compass is local-first.

## Implemented

- No telemetry, analytics, ads, remote financial-data storage, or bank connectivity.
- SQLite is configured for local persistence.
- `.gitignore` excludes local databases, exports, imports, statements, backups, and environment files.
- Demonstration data is synthetic.
- Browser local storage is used only for UI preferences such as navigation state. Household financial settings are stored in SQLite.
- `npm run db:reset` is restricted to SQLite `file:` URLs under the repository `prisma/` directory.
- The in-app demonstration reset requires explicit confirmation and runs server-side against the synthetic single-household dataset.
- Demonstration reset uses the active application database connection, replaces local synthetic database records with canonical seed records, preserves browser UI preferences, does not delete backup ZIP files, and returns only safe database diagnostics such as provider, filename, and a short URL hash.
- Start fresh uses the active application database connection, requires `START FRESH`, clears local financial/import/transfer/recurring/audit records, creates an empty household workspace, preserves browser UI preferences, preserves backup ZIP files, and returns structured before/after counts.
- Remove demo records only and Delete all local financial data are intentionally not implemented. They must not be treated as synonyms for Start fresh, Restore demonstration data, or Restore backup.
- Audit records store field-level values for material manual changes and must not be used for secrets or complete object snapshots.
- CSV import is local-only. File contents are parsed through the local application server and are not sent to external services.
- Uploaded CSV file contents are not permanently stored. Import batches store file hash, redacted filename, size, encoding, delimiter, row status, and bounded serialized source fields needed for traceability.
- CSV validation rejects unsupported extensions, oversized files, empty files, binary content, malformed quoting, duplicate headers, overly long fields, invalid dates, invalid amounts, and formula-like non-amount values.
- Local backup packages are created under `backups/local/`, are ignored by Git, and contain complete unencrypted SQLite financial data.
- Restore validation rejects corrupt, oversized, unsupported, unsafe, hash-mismatched, schema-mismatched, and SQLite-integrity-failing packages before replacement.
- Restore creates a mandatory pre-restore safety backup and attempts automatic rollback if the active database fails post-restore validation.
- Transfer matching is local deterministic logic. It does not use external bank APIs, remote AI, telemetry, or cloud services.
- Transfer audit records store relationship identifiers, status changes, reasons, and bounded notes rather than full transaction snapshots.
- Recurring detection is local deterministic logic. It does not use external bank APIs, remote AI, email access, merchant APIs, telemetry, cloud services, or cancellation services.
- Recurring audit records store bounded status/classification changes and notes rather than full transaction snapshots.

## Prohibited Data

Do not store bank usernames, bank passwords, card PINs, MFA secrets, security-question answers, complete payment-card numbers, real account identifiers, real statements, or secret tokens.

Do not commit real bank CSV exports. Use only synthetic fixtures for tests and documentation.

Do not commit backup ZIP files. Treat backup packages as sensitive personal financial records.

Do not commit screenshots or UAT artifacts containing personal names, account details, transaction descriptions, or financial amounts that may reflect real data.

## Dependency Audit

As of the Phase 1 audit, the Prisma high-severity advisory was remediated by upgrading Prisma packages to `6.19.3`. A moderate Next/PostCSS advisory remains unresolved because npm only offers a semver-major downgrade path that is not a safe remediation for this app.

- Saved transaction views store validated filter preferences and explicitly saved search text, never transaction snapshots, uploads, credentials, or account secrets.
