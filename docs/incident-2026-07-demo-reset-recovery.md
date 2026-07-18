# Demo-reset data incident and recovery — 2026-07-18

## Status

The real household database has been recovered to the absolute path
`C:\Users\adria\AppData\Local\FinancialCompass\financial-compass.sqlite`. Its persistent workspace
identity is `fa7071ef2de27751ea07e96c3d960e7b`, type `REAL`. The overwritten demonstration database and
all recovery inputs remain preserved read-only outside the repository.

The imported ledger is recovered to its expected 1,507 transactions and six active import batches.
The newest recoverable real source is from 2026-07-13T18:09:03.065Z. There is no newer real database,
WAL, SHM, local OneDrive version, or recycle-bin copy in the accessible filesystem. Consequently,
changes made after that backup and before the reset cannot be proven recovered. The screenshots show
some recurring UI state near the incident, but they are not sufficient evidence for a speculative
record-level reconstruction.

## Exact root cause

The command used to validate the cash-flow work was:

```text
npx playwright test tests/e2e/app.spec.ts --grep "cash-flow intelligence|contextual cash-flow"
```

`playwright.config.ts` defaulted to port 3000 and set `reuseExistingServer` to true for a local run
without `E2E_PORT`. A normal development server was already running on port 3000. Playwright reused
that server rather than starting an isolated test server. No shell `DATABASE_URL` was set and no
`.env` file existed, so `src/server/db/prisma.ts` used `file:./dev.db`, which Prisma resolved to the
repository's live `prisma/dev.db`.

The first selected browser test posted `RESET DEMO DATA` to `/api/demo-reset`. The route called
`resetDemoDataWithResult`, which entered a transaction and called `seedDemoData("reset", tx)`.
`seedDemoData` deleted audit, backup, planning, forecast, recurring, transfer, import, transaction,
goal, category, account, and household records, then inserted the canonical synthetic dataset. The
database's surviving audit record anchors this operation at 2026-07-16T02:14:40.314Z
(2026-07-15 21:14:40.314 CDT).

This was not caused by application startup, migration, the recurring price-increase code, a changed
environment file, an automatic restore, a copied demo file, a missing OneDrive path, or a separated
WAL. It was a destructive E2E request sent to the live reused development server.

## Timeline

| Time (CDT)              | Event                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-13 13:09        | Latest valid real backup created (18:09:03Z).                                                                              |
| 2026-07-15 15:14–20:14  | Account, recurring, and overlap-import product commits completed.                                                          |
| 2026-07-15 before 21:14 | Additive cash-flow migration applied to the then-live real database.                                                       |
| 2026-07-15 21:14:40     | Targeted Playwright run reused port 3000 and posted `/api/demo-reset`; live real rows were deleted and demo rows inserted. |
| 2026-07-15 21:17:31     | `7118f02` cash-flow feature committed.                                                                                     |
| 2026-07-15 21:23:21     | `13d35d3` price-increase visibility fix committed.                                                                         |
| 2026-07-18 10:11        | Server stopped; read-only evidence preservation began.                                                                     |
| 2026-07-18 10:22        | Latest real backup selected and migrated successfully on a disposable copy.                                                |
| 2026-07-18 10:24        | Validated copy restored to the stable absolute database path.                                                              |
| 2026-07-18 10:28        | Persistent `REAL` workspace identity migration applied.                                                                    |
| 2026-07-18 10:39        | Recovered database backup created and validated.                                                                           |

## Evidence and candidate inventory

Evidence root: `C:\Users\adria\ecoFin-recovery-evidence-20260718T151117Z`

- `evidence-manifest.json`: 40 SQLite/WAL/SHM evidence copies plus Git/environment context.
- `raw-database-inventory.json`: exhaustive path, size, timestamps, hash, integrity, schema,
  migrations, counts, date ranges, and classification for all 40 raw candidates.
- `backup-package-inventory.json`: exhaustive metadata for 1,102 backup ZIP packages; all were
  structurally valid.
- `backup-database-inventory.json`: integrity, schema, counts, provenance, and source packages for
  561 unique embedded databases.
- `backup-database-extractions.json`: source-to-extracted-database hash map.
- `recycle-bin-evidence-manifest.json`: 18 preserved recycle-bin metadata/payload files; all nine
  decoded databases were unrelated 2025 application data.

All copied evidence was hash-verified and marked read-only. There were 40 raw app-related databases:
35 test databases and five demonstration databases. None contained the real ledger. There were 561
unique databases inside the 1,102 backup ZIPs: 557 demo databases and four real databases. No
relevant WAL/SHM pair existed. Windows Volume Shadow Copy enumeration required elevated permission
and was not available; no accessible local File History or OneDrive-history database was found.

### Real candidate comparison

| Created (UTC)            | Database SHA-256                                                   | Transactions | Active/undone batches | Categories | Recurring | Confirmed transfers | Audits | Decision                           |
| ------------------------ | ------------------------------------------------------------------ | -----------: | --------------------: | ---------: | --------: | ------------------: | -----: | ---------------------------------- |
| 2026-07-13T01:45:01.626Z | `33D4508B443C9D892FDFEAB39BC8C29897C224084293F4F2C19D31E5CB8A1635` |        1,507 |                   6/3 |          0 |        24 |                   0 |  3,371 | Older                              |
| 2026-07-13T13:04:15.609Z | `CFD727F68A2D59C8CDFE8FD8450677E7D26CAA3A0CC938FB4A61A1229B95C3BD` |        1,507 |                   6/3 |          2 |        33 |                   0 |  3,420 | Older                              |
| 2026-07-13T18:08:00.928Z | `D8620FA2AD2812FA545C14E9ABFEB68BA319A6E65A781EA23B8C5887B53CA245` |        1,507 |                   6/7 |          2 |        42 |                  32 |  3,836 | Nearly current, missing categories |
| 2026-07-13T18:09:03.065Z | `E78A50E45194E255B31012A4DB8722CA0EC733CCE309F7D9A5543D743E0409F7` |        1,507 |                   6/7 |         16 |        42 |                  32 |  3,838 | Selected                           |

Each real database existed in two byte-identical ZIP packages: the repository backup directory and a
temporary build directory. The selected source is the newest, has a clean SQLite integrity check and
foreign-key check, and uniquely preserves the expected category set along with the latest import,
recurring, transfer, emergency-fund, and audit state.

The selected database has one `USER_DATA` household, three active non-demo accounts, 1,507 non-demo
CSV transactions, 14 import batches (six imported, seven undone, one validated), 16 categories (14
system and two custom), 42 recurring records with 679 evidence links, 32 confirmed transfers, one
emergency-fund configuration, and no merchant rules or goals. Its 12 explicitly imported
`POSSIBLE` duplicate rows remain preserved; five corresponding transactions are marked possible
duplicates. Seven additional transactions retain `IMPORT_REPAIR_REVIEW`, and 98 retain
`IMPORT_ECONOMIC_DIRECTION`. Credit-account signs retain 262 negative debit records, one positive
credit record, 32 positive confirmed transfer-in records, and seven explicitly unresolved records.

## Restore procedure and hashes

1. Extracted the selected database to immutable evidence storage.
2. Copied it to `C:\Users\adria\ecoFin-recovery-work-20260718\candidate-migrated.sqlite`.
3. Applied only `20260715210000_cash_flow_intelligence` to the disposable copy after baselining the
   proven legacy schema. Integrity and foreign-key checks passed; all authoritative counts remained
   unchanged. The migration added 25 traceable `MIGRATED` forecast rules from existing recurring
   evidence.
4. Copied the validated result to the stable application path. Pre-start SHA-256:
   `5CF95A09B84302A67B9CC6ED5C08B9235E867F2E75842262AE42CA704F215B4E`.
5. Rendered Transactions, Recurring, Cash Flow, and Settings over HTTP. All returned 200 and exposed
   real-workspace content. Cash Flow deterministically detected one payroll forecast and wrote one
   audit event; no source rows changed.
6. Applied additive workspace-identity migration `20260718103000_workspace_identity`.
7. Created and validated `financial-compass-backup-20260718T153946Z-3f20er.zip`; ZIP SHA-256:
   `95B70DE551FA8DDBAF71B44F15426BA56AC1FA53CA2BDFF1F295513FBE1855E6`, SQLite integrity `ok`,
   1,507 transactions.

No database merge was performed. The forecast migration's records are derived and reproducible, so
there was no authoritative post-refactor database to merge. WAL recovery was not needed or possible.

## Before and after counts

“Before” is the preserved database that the app displayed after the accidental reset. “After” is the
recovered real database after its expected forecast detection and verified backup.

| Record                           | Before (demo) |  After (real) |
| -------------------------------- | ------------: | ------------: |
| Accounts                         |             6 |             3 |
| Transactions / active            |       20 / 20 | 1,507 / 1,507 |
| Import batches / active / undone |     0 / 0 / 0 |    14 / 6 / 7 |
| Categories                       |            14 |            16 |
| Merchant rules                   |             0 |             0 |
| Possible-duplicate transactions  |             2 |             5 |
| Suggested transfer candidates    |             0 |             0 |
| Confirmed transfers              |             0 |            32 |
| Recurring items                  |             6 |            42 |
| Forecast rules / exceptions      |        12 / 0 |        26 / 0 |
| Audit events                     |            16 |         3,841 |
| Goals                            |             4 |             0 |
| Debt accounts                    |             4 |             2 |
| Emergency-fund configurations    |             1 |             1 |
| Savings-policy configurations    |             1 |             1 |
| Demo accounts / transactions     |        6 / 20 |         0 / 0 |

## Recurrence prevention

- `DATABASE_URL` is mandatory; the implicit `file:./dev.db` fallback is removed.
- Relative SQLite URLs canonicalize against one captured project root, independent of later working
  directory changes. The recovered environment uses an absolute AppData path.
- Startup fails before Prisma import when the file is missing, requires exactly one workspace
  identity, logs the absolute path/type/ID, and verifies the expected real workspace ID.
- `WorkspaceMetadata` persists stable ID, `REAL`/`DEMO`/`TEST` type, creation source, timestamp, and
  optional name. Settings displays the identity and active path.
- Demo seed refuses real or unidentified existing workspaces. Demo reset accepts only `DEMO`.
- Start Fresh refuses `TEST`; when used on `REAL`, it creates and validates a safety backup first and
  retains the selected workspace identity.
- Unit reset requires explicit `TEST` execution and an isolated `vitest-*` or `test-results` path.
- Playwright uses port 3100, never reuses a server, always resets an isolated
  `test-results/playwright/e2e.sqlite`, and cannot inherit the real database path or expected ID.
- Backups require and preserve exactly one workspace identity; restore tests verify identity
  preservation.

## Validation commands

The following completed successfully during recovery:

- `npm run db:generate`
- `npm run db:migrate` on a disposable recovery copy and then on the recovered stable database
- focused Vitest safety, repository, backup, recurring, and demo-reset suites: 29/29 passed
- focused isolated Playwright cash-flow and recurring tests: 2/2 passed
- recovered backup creation and `npm run backup:validate`: valid, same schema, integrity `ok`
- read-only SQLite `integrity_check` and `foreign_key_check` on the selected, migrated, and recovered
  databases

Full format, lint, typecheck, unit, build, and E2E results are recorded in the final handoff after the
prevention commit.

## Remaining risks

- The latest recoverable real source predates the reset by about two days. The exact imported ledger
  baseline, import history, categories, transfer state, and configuration are recovered, but the
  absence of a newer source means post-backup manual edits or recurring decisions cannot be proven
  recovered. Do not infer or recreate them from screenshots.
- VSS could not be enumerated without elevation. OneDrive cloud version history was not accessible
  through the local filesystem. Either source could potentially contain a newer pre-reset `dev.db`.
- Backups are local, unencrypted SQLite packages and require local disk protection.
- Forecasting, recurring detection, safe-to-save, and related financial engines retain their existing
  validation/demonstration limitations; this recovery does not elevate them to financial advice.
