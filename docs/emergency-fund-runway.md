# Emergency-Fund Runway

Emergency runway is a deterministic planning ratio:

`eligible emergency-fund balance ÷ essential average monthly obligations = runway months`

The shared implementation is `src/domain/planning/emergency-runway.ts`. Cash Flow and the Decision
Simulator consume the same result and component lists. Overview and Goals do not calculate a separate
runway.

## Numerator

An eligible source is an active Savings, Checking, or Cash account explicitly linked through the
household emergency configuration. General savings, liabilities, archived accounts, investments,
credit availability, and expected income are excluded. Display names never designate funds.

Each account uses `ENTIRE_BALANCE` or `FIXED_AMOUNT`. Entire balance uses its positive ledger; fixed
amount is capped by that ledger. Both are capped by the remaining household amount target.

An explicitly emergency-funded scenario withdrawal reduces the protected amount. A one-time cost
funded from another account does not change the numerator.

## Denominator And Precedence

The denominator includes normalized active essentials in this order:

1. Explicit essential scheduled obligation.
2. Debt minimum not already linked to an included scheduled obligation.
3. Confirmed essential recurring expense not already linked to an included schedule.
4. Essential scenario monthly addition or cancellation.

Confirmed income is never an obligation. Optional costs, goals, planned savings, extra debt payments,
checking buffers, data-quality reserves, transfers, one-time expenses, and duplicate linked sources
are excluded. A same-name/same-amount scheduled duplicate is excluded and reported for review.

Frequencies use integer minor units with half-up division: weekly × 52 ÷ 12, biweekly × 26 ÷ 12,
twice-monthly × 2, monthly unchanged, quarterly ÷ 3, semiannual ÷ 6, and annual ÷ 12.

## Canonical Baseline (2026-07-12)

Eligible balance:

- High-Yield Savings ledger: $14,200.00
- Fixed configured protection: $8,400.00
- Eligible amount after ledger/target caps: **$8,400.00**

Essential monthly obligations:

| Source                           | Monthly amount | Deduplication                           |
| -------------------------------- | -------------: | --------------------------------------- |
| Mortgage scheduled obligation    |      $1,650.00 | Suppresses linked mortgage debt minimum |
| Electricity scheduled obligation |        $142.00 | Suppresses linked recurring expense     |
| Water scheduled obligation       |         $68.00 | —                                       |
| Insurance scheduled obligation   |        $180.00 | —                                       |
| Chase Sapphire minimum           |         $85.00 | —                                       |
| Capital One Venture minimum      |         $45.00 | —                                       |
| Auto Loan minimum                |        $380.00 | —                                       |
| **Total**                        |  **$2,550.00** |                                         |

`$8,400.00 ÷ $2,550.00 = 3.2941 months`, displayed as **3.3 months**.

The former 0.9-month result incorrectly included $5,254.17 of recurring payroll as an obligation and
also counted the mortgage through both its schedule and debt minimum. The older approximately
7.7-month result used remaining-period obligations instead of average monthly essentials.

## Canonical Scenarios

| Scenario              | Numerator | Denominator |        Runway | Reason                                                      |
| --------------------- | --------: | ----------: | ------------: | ----------------------------------------------------------- |
| Baseline              | $8,400.00 |   $2,550.00 | 3.2941 months | Shared baseline                                             |
| Add childcare         | $8,400.00 |   $3,750.00 | 2.2400 months | Adds $1,200 essential monthly childcare                     |
| Increase debt payment | $8,400.00 |   $2,550.00 | 3.2941 months | Extra debt payment is excluded                              |
| Cancel subscription   | $8,400.00 |   $2,550.00 | 3.2941 months | Subscription is discretionary                               |
| Add vehicle           | $6,400.00 |   $3,190.00 | 2.0063 months | $2,000 emergency withdrawal and $640 essential monthly cost |

## Confidence

Runway confidence is Limited when no eligible emergency source exists, a mapping is archived or
duplicated, an essential obligation lacks required inputs, a debt minimum is missing, a possible
scheduled duplicate exists, or the denominator is zero. A zero denominator produces `Unavailable`,
not a precise ratio. Data Quality compares it with the persisted 1–24 month household target (three
months by default). Goals have explicit purposes; an emergency goal is planning metadata, never a
second cash source, and renaming it does not change runway.
