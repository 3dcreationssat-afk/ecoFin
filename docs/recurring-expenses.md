# Recurring Expenses

Phase 2D implements local, deterministic recurring-expense and subscription detection.

## Scope

The detector reviews local transactions already stored in SQLite. It does not connect to banks, call external AI, read email, cancel services, contact merchants, or forecast future cash flow beyond the next expected charge date for a detected pattern.

## Eligibility

Recurring candidates are built only from household expense transactions. The detector excludes:

- positive income or credit rows
- refunds
- confirmed transfers
- transfer-like or card-payment-like rows
- interest and fees
- excluded transactions
- zero-amount transactions

Credit-card purchases can still be detected as subscriptions. Credit-card payments are excluded.

## Frequencies

Supported deterministic cadence classes:

- weekly
- every two weeks
- monthly
- every two months
- quarterly
- twice a year
- annual

The detector uses date-gap tolerance windows and requires enough observations for the cadence. Monthly patterns require at least three observations. Longer cadence patterns can be suggested from two observations when the dates and amounts are consistent enough.

## Amounts

Amounts are stored as integer minor units. Monthly and annual equivalents are derived from the detected cadence:

- weekly: amount x 52 / 12
- every two weeks: amount x 26 / 12
- monthly: amount
- every two months: amount / 2
- quarterly: amount / 3
- twice a year: amount / 6
- annual: amount / 12

Variable bills can be detected when date cadence is strong and amount variability remains explainable.

## Confidence And Explanation

Each candidate stores:

- normalized merchant key
- display name
- frequency
- typical amount, min, max, average, and median
- monthly and annual equivalents
- confidence and score
- explanation reasons
- linked supporting transactions
- classification and recommendation

Candidates are never confirmed automatically. Users can confirm, reject, edit, cancel, or reactivate records.

## Price Changes

The service flags a price change when the most recent charge is materially different from the previous charge and the historical amount pattern is not highly variable. Small rounding-level changes are ignored.

## Import And Edit Interaction

After CSV import confirmation, recurring detection runs locally and records candidate counts or a recoverable warning in the import batch summary. Transaction normalization edits trigger a recurring refresh for the household.

Undoing an import deletes imported transactions. Recurring transaction links cascade with the deleted transactions; recurring expense records remain as reviewable historical records.

## Backup Interaction

Recurring expense records and recurring transaction links are included in backup table counts and protected by the schema fingerprint used for restore compatibility.

## Limitations

- No bank connectivity or provider metadata.
- No AI categorization.
- No automatic service cancellation.
- No one-click merchant contact.
- No advanced forecasting engine.
- No multi-currency handling.
- No household-to-household recurring sharing.
