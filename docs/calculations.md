# Calculations

## Implemented

- Decision scenarios apply typed in-memory overlays and reuse Cash Flow, savings policy, goal
  completion, and debt payoff engines. Metric deltas remain integer minor units.

- Debt payoff uses positive liability ledgers, integer monthly interest rounding, payments after
  interest, exact final-payment caps, a 600-month horizon, minimum-only comparison, strategy rollover,
  and deterministic confidence as documented in `debt-payoff-engine.md`.

- Expected-income and obligation occurrences satisfy explicit schedules without mutating definitions; explicit links precede debt, recurring, and goal fallbacks.
- Cash allocation reconciles exactly: cash after obligations/protections minus retained safety reserve equals allocatable surplus; allocatable surplus equals recommended saving plus Safe to Spend plus explicit unallocated surplus.

- Validated Cash Flow, projected month-end, Recommended and Conservative Safe to Save, Safe to Spend, explicit uncertainty reserves, and deterministic confidence follow `cash-flow-engine.md` and `safe-to-save.md`.

- Account ledger balance equals the explicit opening balance plus cleared, nonduplicate, ledger-affecting transaction effects after the anchor plus explicit reconciliation adjustments. Assets are positive owned amounts; liabilities are positive amounts owed.
- Institution-reported and available balances are comparison snapshots and never drive ledger calculation. Reconciliation difference is `reported - ledger`.

- Money formatting helper accepts integer minor units and formats USD display values.
- Money parsing accepts user-entered decimal strings and converts to integer minor units before persistence.
- Integer minor-unit helpers add and subtract money values.
- APR values in seeded account records use basis points, for example `2149` means `21.49%`.
- Account summaries, net worth, goal totals, goal progress, and deterministic data-quality counts derive from SQLite records.
- Available cash is derived from active checking, savings, and other cash-like accounts with positive balances.
- Current-month and prior-month income, spending, net cash flow, transfer movement, and account activity derive from stored transaction dates. Confirmed transfers remain excluded from household income and spending.
- Category budget actuals derive from current-month expense-like transactions only: debit, expense, fee, and interest rows. Transfers, income, refunds, and excluded rows are not counted as budget spending.
- Category budget forecasts use a deterministic current-pace formula: `current actual * days in month / elapsed day of month`. The forecast is a planning signal, not an advanced model.
- CSV import amount parsing converts signed amount columns and debit/credit columns to integer minor units before persistence.
- CSV import duplicate scoring is conservative and explainable: same account, transaction date, amount, original description, and source metadata raise duplicate status from `NONE` toward `POSSIBLE`, `LIKELY`, or `EXACT`.
- Data-quality counts include failed import batches, partial batches, invalid rows, duplicate candidates, repeated file attempts, imported transactions needing review, missing categories, and unknown transaction types.
- Percentage values shown in goal progress are derived from stored integer minor-unit values.
- Percentage values shown in unavailable financial engines remain marked preliminary or unavailable.
- Date and duration formatting are not centralized yet; current date and duration strings are static demonstration values.
- CSV statement dates are persisted as date-only UTC-midnight values after explicit date-format parsing.
- Transfer candidate scoring is deterministic. It requires same household, different accounts, exact opposite-sign amount, non-zero value, and date proximity within three days.
- Transfer scoring adds explainable points for exact date, one-day proximity, two-to-three-day proximity, transfer/payment language, account-name references, checking-to-savings pairing, and checking-to-credit-card payment pairing.
- Transfer confidence is `HIGH` at 85 or above, `MEDIUM` from 65 to 84, and `LOW` below 65.
- Confirmed `TRANSFER_OUT` and `TRANSFER_IN` transactions are excluded from household income, household spending, category spending, merchant spending, and budget actuals. They remain included in account activity and cash movement views.
- Credit-card payments are treated as internal transfers only after confirmation. Interest, fees, refunds, and statement credits remain expenses/refunds and are not automatic payment candidates.
- Recurring detection derives cadence, confidence, monthly equivalents, annual equivalents, amount variability, and price-change flags from local transactions only.
- Recurring monthly equivalents use integer minor-unit math: weekly x 52 / 12, every two weeks x 26 / 12, monthly as-is, every two months / 2, quarterly / 3, twice yearly / 6, and annual / 12.
- Recurring candidates exclude confirmed transfers, income, refunds, fees, card payments, zero-amount rows, and user-excluded transactions.
- Overview action items are a concise projection of existing repository signals: checking buffer shortfall, upcoming account minimums, transfer candidates, possible duplicates, uncategorized spending, recurring review, recurring price increases, stale accounts, incomplete imports, underfunded goals, high APR debt, and missing debt metadata. Items sort by severity, then payment/cash risk, transfer/duplicate/category risk, recurring review, stale data, and informational debt/goal metadata.
- Overview obligations cover the next 30 days from persisted data only. Account minimum payments take precedence over confirmed recurring records, and recurring entries that look like card payments or transfers are omitted to avoid counting credit-card payments as household spending.
- Overview category spending uses current-month expense-like transactions, excludes transfers/income/refunds/excluded rows, includes an uncategorized row when needed, and labels rows as `Over budget`, `Approaching budget`, `On track`, or `No budget`.
- Overview goal statuses are derived from target/current/planned/required monthly values and target date: completed goals are `Completed`; missing target dates or contribution plans are called out; planned monthly below required monthly is `Behind`; near-required funding is `At risk`; otherwise the goal is `On track`.
- Overview debt recommendations use active non-archived debt accounts with negative balances shown as positive debt. Avalanche recommends highest APR first, Snowball recommends lowest positive balance first, and Custom shows no recommendation because custom ordering is not persisted.

## Preliminary or Unavailable

- Overview reserved status is limited to `Planned`, `Not specifically reserved`, or `Unknown`; there is no reservation engine.

## Planned

- Validated calculation modules will be added before any screen values are presented as financially authoritative.

# Classification automation

Merchant rules are deterministic text classification, not financial calculations or AI. They do not change money, dates, transfer confirmation, recurring calculations, or source values. Conflicts resolve by documented priority and specificity.
