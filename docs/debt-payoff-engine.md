# Debt Payoff Engine

Financial Compass calculates debt payoff estimates from active, positive liability ledger balances.
The reported institution balance is never substituted for the authoritative ledger.

## Eligibility

Full monthly simulation requires a supported active liability (`CREDIT`, `LOAN`, or `MORTGAGE`),
a positive ledger amount owed, APR basis points, a positive minimum payment, and a monthly due day.
The minimum must exceed first-period estimated interest. Missing or non-amortizing inputs produce an
explicit issue and no fabricated payoff date. Zero APR is supported. Archived, asset, and zero-balance
accounts are excluded.

## Interest And Payment Model

For each debt and period:

1. Monthly interest is `round(balanceMinor × aprBasisPoints / 120000)`.
2. Interest is added to the starting balance.
3. The required payment is applied, capped to the amount due.
4. Strategy extra or rolled payment is applied in priority order.
5. The final payment is reduced to the exact amount due.

The calculation uses integer minor units. Interest division uses integer arithmetic and half-up cent
rounding. Every schedule period satisfies:

`starting debt + interest - payment = ending debt`

The projection stops after 600 months. A remaining balance produces `PAYOFF_HORIZON_EXCEEDED`, not
an invented date.

## Baseline And Strategies

- Minimum-only pays each debt's minimum and does not redirect a finished payment.
- Avalanche orders highest APR, lowest balance, then stable account identifier.
- Snowball orders lowest balance, highest APR, then stable account identifier.
- Custom requires every currently eligible debt exactly once. Newly eligible debts make an old custom
  order incomplete until reviewed.

Strategy plans keep the initial total payment—sum of minimums plus explicit extra—constant while
debts remain. A finished debt's freed payment rolls to the next active priority. Extra payment is never
automatically sourced from Safe to Save or Safe to Spend.

## Confidence

Confidence is deterministic. Missing setup, Limited account balance confidence, or absent
reconciliation produces Limited. Reconciliation older than 45 days or Moderate account confidence
produces Moderate. Otherwise the estimate is High. Mixed provenance is additionally disclosed in the
planner.

## Numeric Example

A $1,000.00 balance at 12.00% APR accrues $10.00 for the first modeled month. A $50.00 payment then
reduces principal by $40.00 and leaves $960.00. Actual lender results may differ because lenders can
use daily periodic rates, average daily balances, statement timing, fees, promotional terms, and
different rounding conventions.

## Tests

`src/domain/debt/payoff.test.ts` covers interest rounding, zero APR, final payments, missing terms,
negative amortization, all orderings and tie breakers, rollover, extra payments, first-month payoff,
horizon failure, date transitions, weighted APR, comparisons, and cent conservation.
