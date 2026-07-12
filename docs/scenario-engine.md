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
persisted but do not change that period's Cash Flow result. Cancellation savings begin with the first
linked charge on or after the effective date; past charges remain unchanged.

## Metrics

Before/after output includes current-period net movement, cash after obligations and protections, allocatable
surplus, Recommended and Conservative Safe to Save, Safe to Spend, projected month-end, required
commitments, goal completion, debt payoff, interest, and confidence.

Each component also reports exact signed cash impacts for:

- upfront: the one-time event, excluding recurring amounts;
- ongoing monthly: one eligible monthly occurrence;
- current period: eligible events within the selected financial-period boundary;
- first 12 months: upfront events plus monthly anniversaries from the evaluation date;
- bounded total: all occurrences only when an end date or duration makes the total finite.

Current-period impact reconciles as `upfront + recurring + interaction`. The interaction is explicit
when a policy/reserve overlay changes a shared allocation result. A vehicle's upfront impact is
`trade-in - down payment`; its ongoing impact is the negative sum of payment, insurance increase,
and operating increase. Debt interest savings stay separate from current cash impact.

Emergency runway is:

`immediate explicitly linked emergency-fund balance / average monthly essential obligations`

The denominator includes essential scheduled/confirmed recurring obligations, debt minimums, and
essential scenario recurring costs. It excludes optional costs, one-time costs, and goal
contributions. A negative one-time impact reduces the numerator only when its funding account is the
explicit emergency account. No unrelated savings account is treated as an emergency fund.

## Confidence And Risks

Scenario confidence starts with Cash Flow confidence. Invalid/archived links or incomplete baseline
data produce Limited. Missing component dates or Moderate Cash Flow produce Moderate. Otherwise it is
High. Deterministic rules flag negative projected cash, reduced Safe to Spend, emergency runway below
three months, delayed goals, and improved debt cost. Every rule cites the triggering metric; no AI
advice is generated.

## Numeric Example

Adding a $200.00 monthly cost and $350.00 one-time purchase in the current period produces a
\-$350.00 upfront impact, -$200.00 ongoing monthly impact, and -$550.00 current-period impact. Its
first-12-month impact is -$2,750.00 when all 12 monthly anniversaries are eligible. The same overlay is passed through the configured savings policy, so
Safe to Save and Safe to Spend change according to existing policy rules rather than a simulator-only
formula.

## Tests

`src/domain/decisions/engine.test.ts` covers expenses, income, cancellation, vehicle assumptions,
debt and goal improvements, policy/buffer overrides, dates, duration, financial-period boundaries,
runway, risks, confidence, isolation, and integer-cent reconciliation.
