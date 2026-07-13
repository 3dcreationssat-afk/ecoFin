# Account Balances

Accounts use a transaction-derived ledger with explicit concepts:

- `openingBalanceMinor`, `openingBalanceDate`, and `openingBalanceSource` form the trusted anchor.
- `ledgerBalanceMinor`, `ledgerCalculatedAt`, and `ledgerStatus` are derived/cached from the anchor, eligible cleared transactions after the anchor, and explicit reconciliation adjustments.
- `reportedBalanceMinor`, `reportedAvailableMinor`, and `reportedBalanceAsOf` are institution snapshots used only for comparison.
- `reconciliationDifferenceMinor`, `reconciliationStatus`, `lastReconciledAt`, and `balanceConfidence` explain trust.

The obsolete ambiguous `balanceMinor` and `availableMinor` fields were removed. Assets are positive money owned. Credit cards, loans, and mortgages are positive amounts owed. Account type centrally converts transaction signs: a negative card purchase increases the liability ledger; a positive card payment/refund reduces it. Net worth subtracts liability ledgers.

Ledger formula:

`opening anchor + cleared eligible transaction effects after anchor + explicit adjustments`

`affectsLedger` is independent of `affectsIncomeSpendingReports`. Confirmed transfers and card payments affect both account ledgers while remaining excluded from household income/spending. Pending, duplicate-candidate, and explicitly non-ledger rows do not affect the cached ledger.

CSV confirmation and undo recalculate affected accounts. Normal merchant/category/note edits do not change amounts and therefore do not change ledger totals. Transfer confirmation/unmatch recalculates both accounts. Future amount/date/account correction workflows must call the same recalculation service.

Cash Flow uses only trustworthy anchored ledgers. A reported available balance may cap usable liquidity only when current (seven days or less old) and lower; it never changes the ledger.

# Import repair and unanchored accounts

Recalculating after an import semantic repair recalculates eligible transaction-derived ledger
movement and ledger state only. It never infers an opening balance. An account without an explicit
anchor remains `NEEDS_ANCHOR`, keeps a null authoritative ledger balance, and retains limited
confidence.
