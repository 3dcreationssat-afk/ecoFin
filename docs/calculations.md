# Calculations

## Implemented

- Money formatting helper accepts integer minor units and formats USD display values.
- Money parsing accepts user-entered decimal strings and converts to integer minor units before persistence.
- Integer minor-unit helpers add and subtract money values.
- APR values in seeded account records use basis points, for example `2149` means `21.49%`.
- Account summaries, net worth, goal totals, goal progress, and deterministic data-quality counts derive from SQLite records.
- Percentage values shown in goal progress are derived from stored integer minor-unit values.
- Percentage values shown in demonstration-only financial engines remain synthetic display values.
- Date and duration formatting are not centralized yet; current date and duration strings are static demonstration values.

## Demonstration Only

- Safe to Save, Safe to Spend, cash-flow projection, budget forecast, debt payoff, recurring detection, and decision simulator values shown in the UI are synthetic demonstration values.
- Cash-flow chart values are static demonstration dollar values, not a validated projection engine.

## Planned

- Validated calculation modules will be added before any screen values are presented as financially authoritative.
