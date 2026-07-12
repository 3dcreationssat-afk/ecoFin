# Calculations

## Implemented

- Money formatting helper accepts integer minor units and formats USD display values.
- Money parsing accepts user-entered decimal strings and converts to integer minor units before persistence.
- Integer minor-unit helpers add and subtract money values.
- APR values in seeded account records use basis points, for example `2149` means `21.49%`.
- Account summaries, net worth, goal totals, goal progress, and deterministic data-quality counts derive from SQLite records.
- CSV import amount parsing converts signed amount columns and debit/credit columns to integer minor units before persistence.
- CSV import duplicate scoring is conservative and explainable: same account, transaction date, amount, original description, and source metadata raise duplicate status from `NONE` toward `POSSIBLE`, `LIKELY`, or `EXACT`.
- Data-quality counts include failed import batches, partial batches, invalid rows, duplicate candidates, repeated file attempts, imported transactions needing review, missing categories, and unknown transaction types.
- Percentage values shown in goal progress are derived from stored integer minor-unit values.
- Percentage values shown in demonstration-only financial engines remain synthetic display values.
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

## Demonstration Only

- Safe to Save, Safe to Spend, cash-flow projection, budget forecast, debt payoff, and decision simulator values shown in the UI are synthetic demonstration values.
- Cash-flow chart values are static demonstration dollar values, not a validated projection engine.

## Planned

- Validated calculation modules will be added before any screen values are presented as financially authoritative.
