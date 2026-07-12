# Decision Simulator

The Decision Simulator provides durable, local-only what-if scenarios. Users can create, rename,
duplicate, archive, delete, and compare scenarios without applying them to real financial records.
Component creation, editing, and removal are audited; ordinary form keystrokes are not.

## Experience

- Saved scenario list with updated/status context
- Typed component builder and active-assumption summary
- Current-versus-scenario comparison with exact deltas and explanations
- Separate upfront, ongoing monthly, current-period, first-12-month, and bounded-total impacts
- Expandable component reconciliation, including vehicle down payment, trade-in, payment, insurance,
  and operating assumptions
- Scenario-specific validation, positive outcomes, risks, and confidence
- Existing/scenario timeline distinctions
- Goal completion, debt payoff, and emergency-runway impact
- EMPTY workspace onboarding and canonical synthetic demonstrations

The canonical demonstration set covers a vehicle payment, recurring cancellation, debt-payment
increase, and childcare cost. Outputs are calculated at request time and are never hard-coded in the
UI.

## Canonical Results (2026-07-12)

| Scenario              |    Upfront |    Monthly | Current period | First 12 months | Recommended Safe to Save change | Safe to Spend change |           Runway |
| --------------------- | ---------: | ---------: | -------------: | --------------: | ------------------------------: | -------------------: | ---------------: |
| Add childcare         |      $0.00 | -$1,200.00 |     -$1,200.00 |     -$14,400.00 |                        -$600.00 |             -$600.00 | 3.3 → 2.2 months |
| Increase debt payment |      $0.00 |   -$250.00 |       -$250.00 |      -$3,000.00 |                        -$125.00 |             -$125.00 | 3.3 → 3.3 months |
| Cancel subscription   |      $0.00 |    +$15.99 |        +$15.99 |        +$191.88 |                          +$7.99 |               +$8.00 | 3.3 → 3.3 months |
| Add vehicle           | -$2,000.00 |   -$640.00 |     -$2,640.00 |      -$9,680.00 |                      -$1,320.00 |           -$1,320.00 | 3.3 → 2.0 months |

The vehicle's 60-month bounded total is -$40,400.00. The debt-payment scenario moves the modeled
debt-free date from February 2038 to October 2036 (16 months), saves $7,979.81 of modeled interest,
and treats that interest saving as a long-term debt result rather than current cash. All canonical
goals retain their explicit fixed contribution and explain why their projected date does not change.

## Isolation Contract

There is intentionally no “apply scenario” action. Scenario persistence does not create transactions,
modify ledgers, change planning schedules, cancel recurring items, edit goals, or save a DebtPlan.
Deleting a scenario deletes only its isolated components while retaining an audit record.

## Limitations

Recurring components contribute one modeled event on each eligible monthly anniversary; partial
months are not prorated. The first-12-month horizon starts at the evaluation date and includes only
eligible occurrences. Multi-period results are deterministic assumption totals, not a daily cash
forecast. Goal dates assume a constant fixed contribution unless the scenario explicitly changes it;
an unaffordable fixed plan is warned about rather than silently reduced.
Debt extra payments use the existing payoff approximation. Vehicle scenarios use only user-entered
cash assumptions and do not estimate APR, tax, depreciation, resale value, or insurance. Tax,
investment, credit-score, refinancing, AI, and real-data application workflows are out of scope.

Emergency-funded assumptions match explicit configured account IDs. Scenario warnings use the
persisted runway target and never mutate saved configuration.
