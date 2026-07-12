# Base44 Product-Parity Implementation Plan

This plan preserves the local-first architecture, workspace lifecycle, backup behavior, demo provenance, and completed Phase 2A-2D functionality. It intentionally avoids a single uncontrolled implementation pass.

## Delivery Rules

- No static mockup numbers may replace repository-derived values.
- New visible controls must work, be clearly unavailable, or be omitted.
- Every destructive workflow must use explicit confirmation and server-side execution.
- EMPTY workspace must avoid misleading zero-value analytical cards.
- DEMONSTRATION, USER_DATA, and MIXED workspaces must keep provenance semantics intact.
- Calculation outputs that are not fully validated must be labeled preliminary with confidence and assumptions.

## Phase 0: Audit Baseline

Status: complete in this directory.

Deliverables:

- `README.md`
- `FEATURE_PARITY_MATRIX.md`
- `IMPLEMENTATION_PLAN.md`

## Phase 1: P0 Truthfulness And Core Calculation Foundations

Goal: remove or replace production-looking static values on pages where local docs currently say calculations are demonstration-only.

Recommended commits:

1. `feat(calculations): add period cash and budget summaries`
   - Add deterministic current/prior-period transaction summaries.
   - Exclude confirmed transfers from household income/spending.
   - Exclude user-excluded transactions from analytical totals.
   - Add tests for income, spending, savings, prior-period comparison, and favorable/unfavorable deltas.

2. `feat(cash-flow): add preliminary projection engine`
   - Derive current cash from cash-like accounts only.
   - Derive remaining income/expenses from current-period known records and confirmed recurring next charges.
   - Include household checking buffer and emergency-fund protection.
   - Return confidence and reasons.
   - Clearly label safe-to-save as preliminary until more scheduling data exists.

3. `feat(overview): replace static dashboard sections`
   - Add Overview financial summary cards: Available Cash, Projected Month-End, Safe to Save, Safe to Spend, Total Debt.
   - Add repository-derived Monthly Cash Flow and prior-period comparison.
   - Add calculation links to implemented sections.
   - Preserve Empty workspace card.

4. `feat(budget): connect budget actuals to categories`
   - Replace static budget summary and fixed table with category-group calculations.
   - Derive actuals from transfer-aware current-period transactions.
   - Add a documented conservative forecast formula.
   - Keep export unavailable unless implemented.

5. `feat(debt): derive debt planner inputs`
   - Replace static debt summary values with debt account calculations.
   - Add payoff engine using integer minor units and APR basis points.
   - Enable Avalanche/Snowball only after tests pass.
   - Keep Custom disabled until ordering UI exists.

P0 exits when:

- No page shows static demo financial analysis as if it is repository-derived.
- Existing demo reset and Start fresh E2E tests still pass.
- Calculation docs describe every new formula.

## Phase 2: P0/P1 Transaction Productivity

Goal: align Transactions with the mockup while preserving import, duplicate, transfer, and audit safety.

Recommended commits:

1. `feat(transactions): add durable saved views`
   - Add `TransactionSavedView` schema and migration.
   - Persist name, filters, search, sort, page size, and default flag.
   - Add CRUD API and Settings-safe validation.

2. `feat(transactions): expand filters and sorting`
   - Add date range, amount range, excluded state, transfer state, and recurring-link state.
   - Preserve URL state.
   - Add sort field/direction.

3. `feat(transactions): add bulk review actions`
   - Multi-select rows.
   - Bulk categorize, mark reviewed, exclude, restore.
   - Audit every changed transaction.
   - Confirm destructive bulk exclusion.

P1 exits when:

- Saved views survive reload and database reset/seed behavior remains deterministic.
- Bulk operations preserve original imported fields and audit records.

## Phase 3: P1 Planning And Guidance

Goal: implement high-value product surfaces after calculation foundations exist.

Recommended commits:

1. `feat(overview): add attention and obligation queues`
   - Build action queue from data quality, transfer, recurring, imports, stale accounts, and buffer signals.
   - Add direct links to remediation destinations.
   - Add upcoming obligations from account due days and recurring next dates.

2. `feat(goals): add prioritization and savings warning`
   - Add monthly required summary and shortfall.
   - Add limited-savings warning using preliminary safe-to-save or planned savings.
   - Add priority adjustment workflow.

3. `feat(data-quality): add area confidence and remediation links`
   - Normalize issue metadata.
   - Add critical/warning/info severity counts.
   - Add confidence by area.
   - Add actionable links.

4. `feat(accounts): align manual account management`
   - Add available, credit limit, last updated, and manual update affordance.
   - Add no-bank-sync/manual-balance notice.

## Phase 4: Settings Extensions

Goal: implement settings tabs shown in the mockup without weakening import or transaction integrity.

Recommended commits:

1. `feat(settings): add import profiles management`
   - Reuse existing `ImportProfile` model and APIs.
   - Add list/edit/archive/use metadata in Settings.

2. `feat(settings): add merchant rules`
   - Add `MerchantRule` model only after rule semantics are documented.
   - Support pattern, match type, category, normalization, priority, active state, and test-rule preview.
   - Do not auto-apply rules to historical transactions without explicit review.

## Phase 5: Reports And Scenario Simulation

Goal: add higher-order outputs only after the underlying engines exist.

Recommended commits:

1. `feat(reports): add repository-derived report views`
   - Monthly summary, cash flow, spending by category, budget performance, recurring expenses, debt progress, goals progress, data quality.
   - Add CSV/HTML export where deterministic.
   - Print can use browser print when the report page is print-styled.

2. `feat(decisions): add isolated scenario engine`
   - Add scenario and component persistence.
   - Changes never mutate real financial records.
   - Inputs feed cash-flow, goal, recurring, and debt engines.
   - Add robust decimal/month formatting tests.

## Deferred P2 Polish

- Pixel-level spacing differences.
- Optional mobile card mode for every dense table.
- Report chart variety beyond the first deterministic chart.
- Custom debt payoff ordering.
- Split transactions.
- Selective backup restore and scheduled/encrypted backups.

## Validation Required Per Implementation Phase

Run after each phase:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run db:reset
npm run test:e2e
npm run build
```

For release candidates also run:

```bash
npm audit
npm audit --omit=dev
```

Manual sweeps required:

- Demonstration workspace.
- Empty workspace after Start fresh.
- User-data workspace after creating an account/import.
- Mixed workspace after modifying demo data.
- Responsive widths: 1440, 1280, 1024, 768, 390.
- Browser console and server logs for route errors.
