# Recurring Expenses

Phase 2D implements local, deterministic recurring-expense and subscription detection.

## Scope

The detector reviews local transactions already stored in SQLite. Its durable evidence synchronizes
to the canonical forecast-rule layer, which generates future occurrences without writing a year of
rows. It does not connect to banks, call external AI, read email, cancel services, or contact
merchants.

## Eligibility

Recurring candidates are built only from household expense transactions. The detector excludes:

- positive income or credit rows
- refunds
- confirmed transfers
- transfer-like or card-payment-like rows
- explicit P2P and instant-transfer descriptors such as XFER, Zelle, Cash App, and bill pay
- interest and fees
- excluded transactions
- zero-amount transactions
- future-dated transactions

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

The detector uses date-gap tolerance windows and requires at least three distinct observed dates for
every supported cadence. Identical same-day rows count as one occurrence; differing charges from the
same merchant on one day are treated as ambiguous and are not inferred as one recurring series.

Automatic candidates require a supported cadence. Arbitrary irregular gaps are not promoted to
recurring expenses because they do not support a defensible next occurrence or monthly equivalent.
Users can still create or edit an explicitly irregular recurring record when they know the financial
contract. Evidence must also be recent: a pattern is no longer detected after more than two expected
occurrences pass without another matching charge.

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

After CSV import confirmation, recurring and payroll detection run locally. Confirmed forecast rules
are reconciled against the imported transactions before detection advances a next date. Exact,
unambiguous matches are recorded automatically; uncertain cases remain reviewable. Transaction
normalization edits trigger a recurring refresh for the household.

Undoing an import deletes imported transactions. Recurring transaction links cascade with the deleted transactions; recurring expense records remain as reviewable historical records.

## Backup Interaction

Recurring expense records and recurring transaction links are included in backup table counts and protected by the schema fingerprint used for restore compatibility.

## Limitations

- No bank connectivity or provider metadata.
- No AI categorization.
- No automatic service cancellation.
- No one-click merchant contact.
- No external holiday-calendar feed; unusual early/late postings can be changed once.
- No multi-currency handling.
- No household-to-household recurring sharing.

# Prediction and revalidation

Automatic detection requires a defensible interval cluster and is intentionally conservative.
Predictable schedules show both Last observed and the first expected occurrence strictly after the
scan date. User-maintained irregular patterns do not show a precise Next date. Supporting
transactions are loaded only when an item is opened, keeping the recurring page payload bounded.

Confirmed and rejected decisions remain auditable. After supporting transaction semantics change,
a confirmed pattern whose frequency, amount, type, or eligibility changes materially returns to
Needs review. A rejected pattern is reconsidered only when its detection evidence changes. Stale
unconfirmed suggestions and unconfirmed Needs review records become inactive rather than being
deleted, and each automatic inactivation is audited. Previously confirmed records preserve the
existing Needs review revalidation path.
