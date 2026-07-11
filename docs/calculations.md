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

## Demonstration Only

- Safe to Save, Safe to Spend, cash-flow projection, budget forecast, debt payoff, recurring detection, and decision simulator values shown in the UI are synthetic demonstration values.
- Cash-flow chart values are static demonstration dollar values, not a validated projection engine.

## Planned

- Validated calculation modules will be added before any screen values are presented as financially authoritative.
