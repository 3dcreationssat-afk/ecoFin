# Cash Flow Engine

`ForecastRule` is the canonical repeating-income and repeating-expense contract. The engine generates
occurrences in memory and persists only exceptions or matches in `ForecastOccurrence`. Migrated
expected-income schedules and scheduled obligations remain readable provenance records and are
suppressed when their canonical rule is present.

Cash Flow is a deterministic repository projection for the configured financial month. UTC period boundaries honor `financialMonthStart`, clamp short months, and support leap years and year transitions.

Usable liquid cash includes active checking, savings, and cash accounts with anchored current ledgers. A reported balance is never substituted for a ledger. A reported available balance no more than seven days old may conservatively cap liquidity when lower than the ledger. Liabilities, credit limits, available credit, mortgages, loans, and unsupported investments are excluded.

Confirmed rules feed the Confirmed scenario. High-confidence detected rules also feed Likely;
Conservative includes confirmed income and detected expense risk. Debt minimums come from account
terms. Goal plans are reduced by contributions already recorded in the period. Confirmed transfers
and card payments affect account ledgers but never become household income or spending. Refunds
reverse spending. Reconciliation adjustments affect the ledger only.

Precedence prevents double counting: recorded contributions satisfy goal plans first; actual transfers never create planned-saving deductions; debt minimums are separate from ordinary recurring obligations; unconfirmed recurring rows appear only in conservative uncertainty; duplicate candidates are reserved rather than projected.

Emergency runway uses the shared numerator, essential monthly denominator, normalization,
deduplication, and confidence rules in `emergency-fund-runway.md`. It is distinct from the
current-period Cash Flow obligation total. Eligibility, protected amount, amount target, and runway
target come only from explicit persisted configuration.

Timeline events retain their rule, confidence, provenance, and state. Posted transactions matched to
an expected occurrence remove that virtual occurrence so payroll and bills are never counted twice.
Ambiguous matches remain unmatched. Payroll dates may be inferred only from a qualifying series of
at least three eligible positive deposits; a label or isolated deposit is never sufficient.

Allocation uses two exact integer identities:

`cash after obligations and protections - retained safety reserve = allocatable surplus`

`allocatable surplus = Recommended Safe to Save + Safe to Spend + unallocated surplus`

The retained safety reserve is a policy amount and is not also included in Safe to Spend.
