# Transfer Matching

Phase 2C implements explainable, reversible transfer detection between accounts owned by the same household.

## Definition

An internal transfer is a movement of money between household-owned accounts. The two transaction records remain separate and are linked by a `TransferMatch` relationship.

Examples:

- checking to savings
- savings to checking
- checking to credit card
- credit-card payment from checking
- checking to cash

## Candidate Rules

Candidates are generated conservatively and are never silently confirmed.

Required:

- same household
- different accounts
- opposite signs
- exact absolute amount match in integer minor units
- non-zero amount
- date difference within the configured three-day window
- neither side excluded
- neither side already in a confirmed transfer

Unsupported automatic matches:

- transfer fees
- currency conversions
- partial transfers
- aggregated transfers
- one-to-many or many-to-one transfers
- refunds
- statement credits
- interest or card fees

## Date Handling

Date comparison uses posted date when available on a transaction. Otherwise it uses transaction date. The app never mutates dates to force a match.

Scores prefer:

- exact same date
- one-day difference
- two-to-three-day difference

Pairs beyond three days are not suggested.

## Scoring And Confidence

The scorer is deterministic and reason-based.

Signals include:

- exact opposite-sign amount
- different household-owned accounts
- date proximity
- transfer/payment language in descriptions
- account names in descriptions
- checking-to-savings pairing
- checking-to-credit-card payment pairing

Confidence:

- `HIGH`: score 85 or higher
- `MEDIUM`: score 65 to 84
- `LOW`: score below 65

Every candidate stores match reasons as JSON and displays them in review surfaces.

## Credit-Card Payments

A payment from checking or cash to an owned credit-card account is treated as an internal transfer when confirmed. It does not create new household spending because the card purchases should already be represented as spending.

Credit-card fees, interest, cash-advance fees, foreign-transaction fees, refunds, and statement credits are not automatic payment candidates.

## Manual Review

Users can:

- scan for suggestions
- confirm a suggested pair
- reject a suggestion
- create a manual pair from eligible outgoing and incoming transactions
- unmatch a confirmed pair
- add notes

Confirmation classifies the outgoing transaction as `TRANSFER_OUT` and the incoming transaction as `TRANSFER_IN`.

Unmatching keeps history, restores previous transaction type and review status when available, and changes the relationship to `UNMATCHED`.

## Reporting Behavior

Confirmed transfer transactions are excluded from household income and household spending.

Transfers remain visible in:

- transaction lists
- account activity
- transfer review
- audit history

Account balances are not changed by classification.

## Import And Undo

After CSV import confirmation, candidate generation runs for new transactions. Import completion is not blocked if transfer scanning fails; the batch summary records a recoverable warning.

Batch undo is blocked when imported transactions participate in confirmed transfers. Unmatch the transfer first.

## Backup Interaction

`TransferMatch` is included in the SQLite backup package and schema compatibility fingerprint. Restores require the same schema and preserve transfer relationships.

## Limitations

- same-currency exact amount matches only
- no one-to-many or many-to-one matching
- no transfer-fee decomposition
- no automatic confirmation
- no recurring-transfer detection
- no external bank metadata or Plaid support
- no multi-currency conversion
