# Debt Planner

The Debt Planner is a local-first planning surface backed by reproducible payoff calculations.

## Temporary And Saved State

Changing strategy, custom order, or extra payment first creates a temporary scenario. Temporary
scenarios do not write SQLite, create audits, or affect Cash Flow. **Save plan** persists only strategy,
extra payment, and custom order in `DebtPlan`/`DebtPlanOrder`; generated schedules are not stored.
Material saved changes create field-level audit records.

The saved extra amount remains informational outside Debt Planner. Cash Flow continues to reserve the
existing account minimum or linked scheduled obligation exactly once. No debt-plan extra amount is
deducted from Cash Flow.

## Experience

- Six responsive summary metrics use authoritative ledger balances.
- Strategy choices explain Avalanche, Snowball, and Custom behavior.
- Extra payment accepts exact currency entry from zero through $1,000,000.
- Custom order exposes keyboard-operable up/down buttons.
- Payoff rows show balance, APR, minimum, initial extra, debt share, and estimated milestone.
- Strategy impact compares against minimum-only.
- The schedule expands in bounded twelve-month groups and includes cent-reconciling totals.
- Invalid debt metadata links directly to Accounts remediation.

EMPTY workspaces receive account/setup onboarding. DEMONSTRATION uses canonical synthetic debts.
USER_DATA uses only repository records. MIXED explicitly warns that provenance reduces confidence.

## Limitations

The engine models fixed APR and monthly payments only. Promotional APRs, expiration dates, variable
rates, balloon payments, irregular schedules, fees, lender-specific daily interest, and committed-plan
Cash Flow integration are deferred. The output is an estimate for planning support, not financial
advice or a lender statement.
