# Change Ledger

## 2026-07-11

- Initialized Financial Compass as a Next.js, TypeScript, Tailwind, Prisma, SQLite application.
- Added governance files and local-first privacy rules.
- Added Prisma schema and synthetic seed data for households, accounts, and categories.
- Added screenshot-inspired app shell and Phase 1 demonstration screens.
- Added local API route foundations for household settings, accounts, and categories.
- Added Vitest, Playwright, ESLint, and Prettier configuration.
- Added Phase 1 audit corrections: required package scripts, committed SQLite migration SQL, deterministic local database reset, disabled planned controls, collapsible desktop navigation, mobile navigation drawer, drawer Escape handling, stronger e2e tests, and dependency audit documentation.
- Upgraded Prisma packages to `6.19.3` to remediate the high-severity transitive `effect` advisory.
- Refined the collapsible navigation enhancement with reusable shell pieces, visible collapsed-state tooltips, focus-return drawer behavior, backdrop close, non-color active markers, and responsive shell tests.
- Restored expanded governance guardrails and README product scope for Phase 1.5.
- Added SQLite-backed household settings, account, category, goal, contribution, transaction, audit, and demo reset persistence foundations.
- Added repository-derived overview, account, transaction, goal, settings, and data-quality screen data.
- Added tests for money parsing, summaries, data-quality rules, repository persistence, audit records, goal contributions, and original transaction preservation.
- Implemented Phase 2A CSV import with import profiles, durable import batches/rows, file validation, preview, mapping, explicit date and amount parsing, duplicate review, repeated-file blocking, atomic transaction creation, audit logging, safe undo, data-quality integration, synthetic fixtures, and import workflow tests.
- Implemented Phase 2B local backup and restore with backup metadata, manifest and hash validation, same-schema compatibility checks, mandatory pre-restore safety backups, rollback on failed restore, Settings UI controls, CLI scripts, audit records, and unit/integration/e2e coverage.
- Implemented Phase 2C transfer matching with explainable candidate scoring, manual confirmation/rejection, manual matching, unmatching, credit-card payment handling, transfer-aware import undo protection, data-quality signals, reporting exclusion for confirmed transfers, backup compatibility, and tests.

## 2026-07-12

- Implemented Phase 2D recurring-expense detection with deterministic merchant normalization, cadence and amount scoring, confidence reasons, price-change flags, review/confirm/reject/edit/cancel/reactivate workflows, manual records, savings selection, import/edit refresh, data-quality signals, backup compatibility, and tests.
- Fixed demo data reset to run through the active Prisma database connection, return structured counts and safe database diagnostics, show pending/success/error UI feedback, clear confirmation state, preserve browser preferences, and cover reset success/failure paths with tests.
