# Scenario Engine

The Decision Simulator evaluates typed assumptions against an in-memory clone of the validated
planning input. It never writes the overlay back to accounts, transactions, income schedules,
obligations, recurring records, goals, savings policy, debt plans, Overview, Cash Flow, or reports.

## Overlay Architecture

`getCashFlowInput` builds the same repository-derived input used by Cash Flow. The scenario engine
deep-clones its mutable collections, applies active scenario components, and calls
`calculateCashFlow`. Goal contribution changes call the shared goal completion projection. Debt
changes call the existing payoff engine with a temporary extra-payment amount. No cash-flow, savings,
goal, or debt formula is duplicated in the simulator.

Only `DecisionScenario` and typed `DecisionScenarioComponent` definitions persist. Generated results,
timelines, comparisons, risks, and schedules are reproducible and are not stored.

## Supported Components

- Recurring or one-time expense
- Recurring income increase or reduction, and one-time income
- Confirmed recurring-item cancellation
- Vehicle payment with down payment, trade-in, insurance, and operating-cost assumptions
- Temporary debt extra payment
- Fixed goal savings change
- Savings-policy mode, target, and reserve overrides
- Checking-buffer override

Amounts are net integer minor-unit assumptions. Dates are UTC date-only boundaries. A duration ends a
component at the corresponding month boundary. Components outside the active financial period remain
persisted but do not change that period's Cash Flow result.

## Metrics

Before/after output includes monthly net movement, cash after obligations and protections, allocatable
surplus, Recommended and Conservative Safe to Save, Safe to Spend, projected month-end, required
commitments, goal completion, debt payoff, interest, and confidence.

Emergency runway is:

`explicitly linked emergency-fund balance / (essential obligations + debt minimums in the period)`

No unrelated savings account is treated as an emergency fund.

## Confidence And Risks

Scenario confidence starts with Cash Flow confidence. Invalid/archived links or incomplete baseline
data produce Limited. Missing component dates or Moderate Cash Flow produce Moderate. Otherwise it is
High. Deterministic rules flag negative projected cash, reduced Safe to Spend, emergency runway below
three months, delayed goals, and improved debt cost. Every rule cites the triggering metric; no AI
advice is generated.

## Numeric Example

Adding a $200.00 monthly cost and $350.00 one-time purchase in the current period reduces projected
month-end by exactly $550.00. The same overlay is passed through the configured savings policy, so
Safe to Save and Safe to Spend change according to existing policy rules rather than a simulator-only
formula.

## Tests

`src/domain/decisions/engine.test.ts` covers expenses, income, cancellation, vehicle assumptions,
debt and goal improvements, policy/buffer overrides, dates, duration, financial-period boundaries,
runway, risks, confidence, isolation, and integer-cent reconciliation.
