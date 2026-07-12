# Base44 Product-Parity Implementation Plan

Date: 2026-07-12

This plan follows the parity matrix in this directory. The Base44 screenshots define product direction, but implementation must preserve Financial Compass's local-first architecture, SQLite source of truth, workspace lifecycle, auditability, and existing CSV import, transfer, recurring, backup, restore, and start-fresh workflows.

## Delivery Boundary

Do not implement every parity gap in one pass. Large capabilities that require new schema, new financial engines, or broad workflow contracts must be delivered in separate focused increments with tests and documentation.

Every visible control must either work, be explicitly disabled/unavailable, or be omitted.

## Increment 1: Stabilize Misleading Static Analytics

Status: complete for the first recovery increment

Scope:

- Replace static Overview summary cards with repository-derived available cash, projected month-end, and total debt where deterministic inputs exist.
- Keep Safe to Save and Safe to Spend marked preliminary until buffer, obligation, and confidence engines are implemented.
- Replace static Overview cash-flow bars and prior-period comparison with transfer-aware transaction summaries.
- Add Overview spending by category, goals snapshot, and debt snapshot using persisted records.
- Replace static Budget actuals and forecasts with category and transaction-derived values.
- Replace static Cash Flow summary values with current cash plus recorded current-month net flow, clearly labeled preliminary.
- Replace static Debt summary values and payoff order with persisted debt account data; keep payoff-date, interest, and strategy impact unavailable until a validated payoff engine exists.
- Replace static Reports KPIs and spending bars with current-period transaction/category values; keep exports disabled until implemented.
- Update calculations documentation and product-capability notes.

Validation:

- Unit tests for account, period, and category budget calculations.
- Existing e2e shell, workspace, import, transfer, recurring, backup, and reset workflows must keep passing.
- Desktop and mobile route smoke checks must show no console errors, failed requests, or document-level horizontal overflow.

## Increment 2: Actionable Overview

Status: complete for the actionable Overview recovery increment

Scope:

- Repository-derived Needs Your Attention queue.
- Upcoming obligations from debt due dates, recurring records, and household settings.
- Direct remediation links with URL-backed filters.
- Confidence indicators by calculation area.
- Current-period category status rows, active goal statuses, and debt next-payment recommendation.

Dependencies:

- Structured data-quality issue metadata.
- Obligation model that avoids double counting scheduled and recorded activity.
- No schema change was required; category period filtering and persisted custom debt order remain deferred.

## Increment 3: Transaction Management Parity

Status: Cash Flow and Safe to Save complete; debt payoff and decision scenarios deferred

Scope:

- Notes and amount search.
- Date, amount, excluded, transfer-state, and recurring-link filters.
- URL-backed sorting and page size.
- SQLite-backed saved views.
- Row selection and confirmed bulk actions.
- Drawer parity for implemented actions only.

Dependencies:

- Saved-view schema and migration.
- Bulk edit service with audit records and validation.

## Increment 4: Validated Financial Engines

Status: deferred

Scope:

- Explainable Safe to Save and Safe to Spend.
- Scheduled cash-flow projection with recurring obligations and buffers.
- Debt payoff simulator with avalanche, snowball, custom order, extra payments, interest, payoff date, and six-month schedule.
- Isolated decision scenario engine.

Dependencies:

- Documented formulas using integer minor units or precise decimal arithmetic.
- Calculation confidence and data-quality impacts.
- Focused unit and e2e coverage before presenting recommendations as actionable.

## Increment 5: Reports, Settings, Accounts, and Goal Parity

Status: deferred

Scope:

- Configurable reports and CSV/HTML/print export.
- Merchant rules.
- Import profile management in Settings.
- Account list parity for available balance, credit limit, last-updated, and manual-update messaging.
- Goal target-date/status display, contribution shortcuts, prioritization, and limited-savings warnings.

Dependencies:

- Merchant-rule schema and normalization implications.
- Export serialization helpers.
- Goal prioritization service and validation.

## Documentation Requirements

Each increment must update:

- `docs/calculations.md` for calculation behavior and limits.
- `docs/known-issues.md` for deferred or unavailable capabilities.
- `docs/change-ledger.md` for meaningful product, architecture, persistence, calculation, or design changes.
- `docs/product-capabilities.md` for implemented and preliminary capabilities.
- `docs/release-readiness.md` when validation status or release-facing limits change.

## Commit Strategy

Use focused conventional commits and do not rewrite history:

- `docs(parity): audit base44 product gaps`
- `feat(overview): add repository-derived dashboard signals`
- `feat(budget): connect forecasts to persisted data`
- `test(parity): cover base44-aligned workflows`

Do not push from this recovery pass.

# Completed increment: transaction filters and saved views (2026-07-12)

Advanced URL filters, server-side pagination, durable saved views/default precedence, and Overview/Data Quality drill-down compatibility are implemented. Splits and new import formats remain deferred.

## Completed increment: bulk review and merchant rules (2026-07-12)

Explicit page-scoped bulk review, deterministic merchant rule persistence/preview/Settings management, manual override provenance, CSV application, audit, backup, reset, and data-quality integration are implemented. Transaction splitting and non-CSV formats remain deferred.
