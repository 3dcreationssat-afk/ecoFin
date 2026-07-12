# Cash Flow Engine

Explicit expected-income and obligation occurrences are authoritative future inputs. Paid/skipped occurrences are excluded; linked schedules suppress recurring, debt, and goal fallbacks.

Cash Flow is a deterministic repository projection for the configured financial month. UTC period boundaries honor `financialMonthStart`, clamp short months, and support leap years and year transitions.

Usable liquid cash includes active checking, savings, and cash accounts with anchored current ledgers. A reported balance is never substituted for a ledger. A reported available balance no more than seven days old may conservatively cap liquidity when lower than the ledger. Liabilities, credit limits, available credit, mortgages, loans, and unsupported investments are excluded.

Future income and expenses come only from confirmed persisted recurring records with an explicit next date. Debt minimums come from account terms. Goal plans are reduced by contributions already recorded in the period. Confirmed transfers and card payments affect account ledgers but never become household income or spending. Refunds reverse spending. Reconciliation adjustments affect the ledger only.

Precedence prevents double counting: recorded contributions satisfy goal plans first; actual transfers never create planned-saving deductions; debt minimums are separate from ordinary recurring obligations; unconfirmed recurring rows appear only in conservative uncertainty; duplicate candidates are reserved rather than projected.

Emergency runway uses the shared numerator, essential monthly denominator, normalization,
deduplication, and confidence rules in `emergency-fund-runway.md`. It is distinct from the
current-period Cash Flow obligation total.

Timeline events are Recorded, Scheduled, Forecast, or User assumption and retain their persisted source. The engine never fabricates paycheck dates from `incomeSchedule` or isolated history.

Allocation uses two exact integer identities:

`cash after obligations and protections - retained safety reserve = allocatable surplus`

`allocatable surplus = Recommended Safe to Save + Safe to Spend + unallocated surplus`

The retained safety reserve is a policy amount and is not also included in Safe to Spend.
