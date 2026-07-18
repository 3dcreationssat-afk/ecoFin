# Change Ledger

## 2026-07-15 — Production cash-flow intelligence

- Made the recurring price-increase count actionable: it now filters directly to affected items,
  highlights each row, shows previous/current charge, delta, percentage and detection date, and
  opens a focused evidence review.
- Added additive canonical `ForecastRule` and sparse `ForecastOccurrence` persistence with legacy
  schedule provenance, household timezone configuration, lifecycle/backup coverage, and audit logs.
- Added local payroll-pattern detection, cadence/amount confidence, exclusions, explainable
  transaction matching, automatic import reconciliation, undo cleanup, and idempotency tests.
- Rebuilt Cash Flow around four decision outcomes, Confirmed/Likely/Conservative scenarios, a daily
  balance chart, expected activity, compact attention, contextual one-time actions, rule management,
  and an answer-first Safe to Save calculation.
- Unified Cash Flow, Overview, and Decision evaluation on the canonical forecast engine and stopped
  eager persistence of future recurring rows.

## 2026-07-12

- Corrected CSV preview and validation error handling so expected file-format and import-limit failures return actionable validation messages instead of a generic server error; added near-limit and over-limit regression coverage.
- Raised the CSV import ceiling from 1,000 to 10,000 rows and staged import rows in bounded SQLite batches so normal multi-year household exports can be previewed and validated safely.
- Improved account-form validation feedback by preserving field-specific server messages and constraining debt payment and statement days to valid calendar-day values.
- Made duplicate-candidate handling explicitly user-controlled: unresolved candidates now block confirmation until each is deliberately marked Import or Skip, with matching client and server enforcement.
- Corrected CSV validation to evaluate only mapped transaction fields, preserving unused source metadata such as masked account identifiers; added centralized spreadsheet-safe CSV cell serialization for future exports.

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

- Added explicit emergency configuration, normalized account links, protected-amount modes,
  persisted amount/runway targets, goal purposes, audited Settings controls, lifecycle support, and
  target-aware warnings.

- Centralized emergency runway, corrected recurring-income and linked-mortgage double counting,
  added component explanations and deterministic Data Quality signals, and reconciled canonical
  Cash Flow and Decision values.

- Audited Decision Simulator semantics: separated upfront, recurring monthly, current-period,
  first-12-month, and bounded impacts; added exact component reconciliation, effective-date-aware
  cancellations, explicit fixed-goal affordability, and numerator/denominator emergency runway.

- Added isolated typed Decision Scenarios with audited lifecycle/component CRUD, canonical examples,
  shared Cash Flow/savings/goal/debt evaluation, comparisons, timeline, runway, deterministic risks,
  confidence, backup/reset/start-fresh integration, responsive UI, and tests.

- Added the validated deterministic Debt Payoff Engine, minimum-only/Avalanche/Snowball/Custom
  comparisons, saved audited plans, extra-payment simulation, schedules, confidence and remediation,
  Debt Planner UI, Overview summary integration, lifecycle/backup support, and tests.

- Standardized adaptive metric grids, non-wrapping tabular financial values, card and control
  geometry, table states, keyboard skip navigation, route skeletons, and responsive shell spacing;
  refined Debt placeholders and verified core pages from 390px through 2560px.

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

# 2026-07-13 — Real-data import semantics and recurring repair

- Normalized signed CSV amounts according to the selected debit convention and persisted mapping
  provenance on each newly validated batch.
- Separated exact source provenance from narrowly time-bounded fuzzy duplicate scoring. Explicit
  Import now takes precedence for ledger inclusion without clearing the review warning.
- Added a generic, aggregate-only repair inspector with account conditions, exact-count refusal,
  provenance validation, semantic ambiguity flags, auditing, and unanchored-ledger safeguards.
- Made recurring detection more conservative, advanced predictable Next dates strictly into the
  future, added Last observed, revalidated material decision changes, and lazy-loaded evidence.
- Limited Data Quality import counts to the latest actionable attempt for each account/file source.
- Household totals remain non-authoritative until anchors, categories, transfer decisions, and
  household configuration are complete.
- Added a verified undo/reimport workflow with validated-backup rollback, source-hash and batch-ID
  identity checks, immutable row decision mapping, historical batch preservation, safe editable
  intent carry-forward, and aggregate-only verification output.

# 2026-07-13 — Start Fresh canonical category correctness

- Extracted the canonical income/expense taxonomy from demonstration data into one idempotent
  default-category initializer with stable system keys and identifiers.
- Start Fresh now removes custom categories but recreates canonical defaults while keeping the
  workspace financially empty; repeated initialization and reset cannot duplicate defaults.
- Added explicit Default/Custom presentation, additive persistence metadata, exact restore
  protection, and integration/browser regressions across Categories, Transactions, Budget, and
  Reports.

# 2026-07-14 — Account duplicate prevention and safe deletion

- Account creation and identity edits now reject household duplicates using normalized institution
  and account names, including archived matches, with a structured conflict response.
- Added confirmed permanent deletion for unused accounts. Deletion is blocked when financial or
  planning records reference the account, while successful deletions retain a minimal audit event.

# 2026-07-15 — Recurring review workspace refinement

- Balanced recurring financial summaries, promoted review alerts into the action area, and made
  current/reviewable items the default view while retaining filtered access to historical statuses.
- Consolidated the recurring table into readable schedule and decision groups, added labeled row
  actions, clearer result ranges and empty-filter recovery, and preserved contained mobile overflow.

# 2026-07-15 — Conservative recurring detection

- Excluded future-dated and explicit P2P/instant-transfer rows, counted exact same-day duplicates as
  one observation, and rejected conflicting same-day merchant charges as ambiguous evidence.
- Required recent evidence and a supported cadence for automatic candidates, removing arbitrary
  irregular-gap promotion while preserving user-created irregular records.
- Inactivated stale unconfirmed suggestions and review records with audit history, while preserving
  the existing confirmed-pattern revalidation contract.

# 2026-07-15 — Transaction-first workspace and exact-overlap imports

- Moved transaction filters and the transaction ledger ahead of import history and transfer review
  so the primary workflow is visible without scrolling through secondary activity panels.
- Added content-exact overlap detection using account, date, integer minor-unit amount, and original
  description. Exact overlaps default to Skip but remain visible and require batch confirmation.
- Protected legitimate identical charges with count-aware matching: only the number already stored
  is pre-skipped, while excess same-file occurrences remain explicit review candidates.
- Added audited `NO_CHANGES` batches for overlap-only confirmations and retained individual decisions
  for fuzzy candidates.

# 2026-07-18 — Real-workspace recovery and database isolation

- Recovered the latest valid real household database from a hash-verified local backup to a stable
  absolute AppData path, preserved immutable incident evidence, applied only proven additive
  migrations, validated the restored ledger/configuration, and created a verified post-recovery
  backup.
- Added persistent workspace identity (`REAL`, `DEMO`, or `TEST`), visible Settings diagnostics,
  expected-ID startup verification, mandatory deterministic database configuration, and visible
  startup failure instead of relative-path/demo fallback behavior.
- Guarded demo seed/reset and Start Fresh by workspace identity, added automatic pre-Start-Fresh
  backup for real workspaces, required identity-preserving backup/restore, and isolated unit and
  Playwright database paths with server reuse disabled.
- Added database-path, destructive-action, migration preservation, recurring read-safety, and
  backup identity regressions. See `docs/incident-2026-07-demo-reset-recovery.md`.
- Added an accessible floating account-created confirmation with direct Import transactions and
  View account actions. The import action opens the CSV workflow with the new account selected, and
  the global header Import control now opens the implemented importer instead of remaining disabled.
  Repeated header clicks on the Transactions page reopen a dismissed importer without requiring a
  URL change or page reload.
- Simplified explicit CSV date handling: date-format choices now include plain-language ordering,
  the review screen shows one batch-level interpretation notice, and successfully parsed dates no
  longer produce repetitive row-level ambiguity warnings after the user selected a format.
- Made the recurring price-increase filter self-reversing: while active, its trigger becomes a
  clearly labeled `Exit price-increase view` action that restores the normal current-items view.
- Added an explicit web confirmation flow for import undo. Server blockers are now visible; batches
  with review-status changes only can discard those review decisions through a separately confirmed,
  audited reset and then use the existing protected undo. Categories, merchants, types, notes,
  exclusions, and confirmed transfers remain hard blockers.
