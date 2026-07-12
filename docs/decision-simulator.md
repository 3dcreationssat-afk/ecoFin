# Decision Simulator

The Decision Simulator provides durable, local-only what-if scenarios. Users can create, rename,
duplicate, archive, delete, and compare scenarios without applying them to real financial records.
Component creation, editing, and removal are audited; ordinary form keystrokes are not.

## Experience

- Saved scenario list with updated/status context
- Typed component builder and active-assumption summary
- Current-versus-scenario comparison with exact deltas and explanations
- Scenario-specific validation, positive outcomes, risks, and confidence
- Existing/scenario timeline distinctions
- Goal completion, debt payoff, and emergency-runway impact
- EMPTY workspace onboarding and canonical synthetic demonstrations

The canonical demonstration set covers a vehicle payment, recurring cancellation, debt-payment
increase, and childcare cost. Outputs are calculated at request time and are never hard-coded in the
UI.

## Isolation Contract

There is intentionally no “apply scenario” action. Scenario persistence does not create transactions,
modify ledgers, change planning schedules, cancel recurring items, edit goals, or save a DebtPlan.
Deleting a scenario deletes only its isolated components while retaining an audit record.

## Limitations

Recurring components currently contribute one modeled event per active financial period; multi-period
charts are not a full long-range cash forecast. Goal dates assume a constant monthly contribution.
Debt extra payments use the existing payoff approximation. Vehicle scenarios use only user-entered
cash assumptions and do not estimate APR, tax, depreciation, resale value, or insurance. Tax,
investment, credit-score, refinancing, AI, and real-data application workflows are out of scope.
