# Product Capabilities

## Implemented Local Capabilities

- Local household, account, category, goal, contribution, transaction, CSV import, transfer review, recurring review, backup, restore, demo reset, and start-fresh persistence.
- Repository-derived Overview summaries for available cash, recorded cash flow, category spending, goal progress, and debt snapshot.
- Repository-derived Budget actuals, current-pace forecasts, remaining amounts, and status labels by category group.
- Repository-derived Cash Flow, Debt, and Reports summary values where deterministic local inputs exist.
- Empty workspace, demonstration workspace, user-data workspace, and mixed-data workspace states.

## Preliminary Signals

- Projected Month-End is current available cash plus recorded current-month net cash flow.
- Budget forecast is current-month actual spending projected at the current daily pace.
- Safe to Save and Safe to Spend are intentionally labeled preliminary until buffer, obligation, and confidence engines are implemented.

## Demonstration or Unavailable Capabilities

- Bank connectivity, automatic balance refresh, AI recommendations, advanced forecasting, decision simulation, report export, saved transaction views, merchant rules, and debt payoff simulation are not implemented.
- Disabled controls remain visible only when they identify a planned capability and do not silently perform no action.
