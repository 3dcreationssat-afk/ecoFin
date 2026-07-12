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

- Reconciled cash-allocation semantics so retained safety reserves are subtracted once before allocatable surplus, added mode-specific targets, transparent confidence reductions, a UI waterfall, and cent-exact invariants.

- Added expected-income and obligation schedules, satisfaction occurrences, deterministic matching, precedence, policy-based recommendations, demo inputs, lifecycle/backup support, and workflows.

- Added validated deterministic Cash Flow with financial-month boundaries, conservative liquidity, confirmed forecasts, debt/goal obligations, explicit reserves, Safe to Save/Safe to Spend, timeline, confidence remediation, Overview integration, and tests.

- Implemented Phase 2D recurring-expense detection with deterministic merchant normalization, cadence and amount scoring, confidence reasons, price-change flags, review/confirm/reject/edit/cancel/reactivate workflows, manual records, savings selection, import/edit refresh, data-quality signals, backup compatibility, and tests.
- Fixed demo data reset to run through the active Prisma database connection, return structured counts and safe database diagnostics, show pending/success/error UI feedback, clear confirmation state, preserve browser preferences, and cover reset success/failure paths with tests.
- Added workspace lifecycle states, a Start fresh workflow for empty local workspaces, empty-state screens, and clarified Restore demonstration data semantics while preserving backup ZIP files and browser preferences.
- Added the Base44 parity audit package and replaced static Overview, Cash Flow, Budget, Debt, and Reports figures with repository-derived or explicitly unavailable/preliminary values.
- Added the actionable Overview increment with repository-derived attention items, upcoming obligations, category status rows, goal statuses, debt strategy recommendation, direct drill-down links, and focused unit/e2e coverage.

# 2026-07-12 — Advanced transaction filters and saved views

- Added validated URL-authoritative advanced filtering, financial-period bounds, sorting, and server-side pagination.
- Added durable archived `TransactionSavedView` records, case-insensitive household naming, default precedence, CRUD routes, compact UI, and lifecycle/backup integration.
- Added Overview/Data Quality drill-down parameters, query and repository tests, indexes, and `docs/transaction-views.md`.

# 2026-07-12 — Transaction bulk review and merchant rules

- Added explicit page-scoped selection and audited all-or-nothing bulk category, review, reporting, safe-type, merchant, and rule-reapply actions.
- Added durable merchant rules, deterministic matching/conflicts, preview, field provenance/manual locks, Settings management, import application, lifecycle/backup integration, and data-quality signals.

# 2026-07-12 — Account ledger and reconciliation prerequisite

- Replaced ambiguous snapshot balance fields with explicit opening anchors, derived ledgers, reported snapshots, reconciliation state/confidence, and audited adjustments.
- Adopted positive liability amounts owed, separated ledger/reporting semantics, and connected CSV import/undo and transfer workflows to recalculation.
