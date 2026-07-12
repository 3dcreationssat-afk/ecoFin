# Reconciliation

Reconciliation compares the authoritative anchored ledger with an institution-reported balance on a date. It shows ledger, reported balance, available balance, difference, status, confidence, and last reconciliation.

If an account has no anchor, the first explicit reconciliation establishes a `RECONCILIATION_ANCHOR`; historical balances are never inferred. A zero difference marks the account reconciled. A nonzero difference remains unreconciled unless the user explicitly selects an adjustment and provides a reason.

Adjustments are durable `ReconciliationAdjustment` records with account, integer amount, effective date, reason, optional note, timestamp, and audit. They are ledger corrections, not ordinary spending transactions, and never appear in household income/spending.

Confidence is deterministic: missing anchors are Limited; fresh zero-difference ledgers without duplicates/unreviewed rows are High; small explainable uncertainty can be Moderate; stale or materially incomplete records are Limited.
