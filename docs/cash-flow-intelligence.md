# Cash-Flow Intelligence Architecture

## Design review

The pre-refactor application had strong ledger, planning, recurring, emergency-fund, and savings
policy boundaries, but no canonical forecast-rule layer. `RecurringExpense` detected expenses only,
confirmation copied selected records into separate income or obligation schedules, and the planner
persisted every generated occurrence for a full year. Cash Flow then mixed those records with debt
and goal fallbacks. This created duplicate-source risk and made payroll dependent on manual entry.

The production forecast contract uses:

- `RecurringExpense` as retained detection evidence and the existing subscription-review surface.
- `ForecastRule` as the canonical confirmed or detected rule for both income and expenses.
- `ForecastOccurrence` only for a match, skip, override, exception, miss, cancellation, or other
  durable lifecycle event. Ordinary future occurrences are generated deterministically.
- The existing expected-income and scheduled-obligation tables as preserved legacy/manual inputs.
  Migrated rows point to a forecast rule through provenance and are suppressed by the canonical
  forecast adapter, preventing double counting.
- One server-side forecast service for Cash Flow, Overview/Decisions adapters, Safe to Save, Safe to
  Spend, structured explanations, and confidence inputs.

## Migration risks and decisions

- The migration is additive. Existing transaction, recurring, schedule, occurrence, transfer,
  import, goal, debt, emergency-fund, policy, and audit rows are not rewritten or deleted.
- Existing schedules are deterministically backfilled as forecast rules with source-record
  provenance. Existing recurring rows without a derived schedule are backfilled as detected or
  confirmed rules. Ambiguous account links remain null and are surfaced for review.
- Existing eagerly generated occurrences remain historical records. New forecast rules generate
  ordinary occurrences in memory; only stateful exceptions and matches persist.
- Household dates use the configured IANA timezone. Persisted financial dates remain UTC-midnight
  date-only values; recurrence arithmetic uses UTC date components to avoid DST drift.
- Exact holiday calendars are not inferred. Observed early-deposit behavior is tolerated by rule
  date windows, while a specific holiday adjustment requires an occurrence override.

## Scenario policy

- **Confirmed:** posted ledger position plus confirmed rules and explicit one-time items.
- **Likely:** confirmed activity plus high-confidence detected rules, labeled inferred.
- **Conservative:** confirmed income only; confirmed expenses plus high-confidence inferred expense
  risk and configured protections/reserves.

All money uses integer minor units. Forecast results expose component lists rather than requiring
React components to rebuild formulas.
