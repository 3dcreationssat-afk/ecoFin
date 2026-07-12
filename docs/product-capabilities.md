# Product Capabilities

- Expected income, obligations, occurrence satisfaction, explicit match confirmation, and household savings policy are persisted and audited.
- Cash Flow displays a cent-reconciling allocation waterfall with policy reserve, allocatable surplus, recommendation, Safe to Spend, and unallocated remainder.

- Deterministic financial-month projection, explainable Safe to Save/Safe to Spend, protection reserves, running timeline, and confidence remediation are implemented from SQLite records.

## Implemented Local Capabilities

- Local household, account, category, goal, contribution, transaction, CSV import, transfer review, recurring review, backup, restore, demo reset, and start-fresh persistence.
- Repository-derived Overview summaries for available cash, recorded cash flow, action items, upcoming obligations, category spending, goal progress/status, and debt snapshot/recommendation.
- Repository-derived Budget actuals, current-pace forecasts, remaining amounts, and status labels by category group.
- Repository-derived Cash Flow, Debt, and Reports summary values where deterministic local inputs exist.
- Empty workspace, demonstration workspace, user-data workspace, and mixed-data workspace states.
- Advanced server-side transaction filters, URL state, sorting, pagination, saved-view CRUD, and one household default saved view.
- Current-page explicit selection, audited bulk classification/review actions, and deterministic merchant-rule CRUD, preview, historical application, and CSV integration.
- Transaction-derived account ledgers with explicit opening anchors, positive-liability convention, reported snapshots, reconciliation, adjustments, and confidence.

## Preliminary Signals

- Projected Month-End is current available cash plus recorded current-month net cash flow.
- Budget forecast is current-month actual spending projected at the current daily pace.
- Safe to Save and Safe to Spend are intentionally labeled preliminary until buffer, obligation, and confidence engines are implemented.
- Overview upcoming obligations are deterministic account minimums and confirmed recurring expenses for the next 30 days; reservation labels are conservative because no reservation engine exists.

## Demonstration or Unavailable Capabilities

- Bank connectivity, automatic balance refresh, AI recommendations, advanced forecasting, decision simulation, report export, merchant rules, and debt payoff simulation are not implemented.
- Disabled controls remain visible only when they identify a planned capability and do not silently perform no action.
