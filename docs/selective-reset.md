# Selective Reset And Start Fresh

All destructive workspace actions are server-side, require an exact typed phrase, and create and
validate a local safety backup before changing records. TEST workspaces are blocked outside automated
tests. Browser theme and navigation preferences are not financial records and remain unchanged.

| Action                         | Confirmation           | Removed                                                                                                       | Preserved                                                                                                |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Clear transactions only        | `CLEAR TRANSACTIONS`   | Transactions, transfer matches, recurring evidence links                                                      | Accounts, categories, goals, import-batch metadata, learned rules, schedules, Plaid connections, backups |
| Clear CSV import history       | `CLEAR CSV HISTORY`    | Import batches, rows, and saved import profiles                                                               | Transactions and original transaction source fields, accounts, learned rules, Plaid connections, backups |
| Disconnect Plaid institutions  | `DISCONNECT PLAID`     | Provider consent where revocation succeeds and local encrypted access tokens                                  | Local transaction history, classifications, accounts, learned rules, backups                             |
| Reset household financial data | `RESET FINANCIAL DATA` | Accounts, transactions, goals, imports, planning records, learned rules, notifications, and Plaid connections | Household identity/preferences, all categories, audit history, browser theme, backup files               |
| Full workspace reset           | `START FRESH`          | Household financial/configuration records and custom categories                                               | A new empty household, recreated canonical default categories, browser theme, backup files               |
| Restore backup                 | `RESTORE BACKUP`       | Replaces the current SQLite workspace after validation                                                        | A mandatory pre-restore recovery backup and automatic rollback path                                      |

Plaid disconnect attempts `/item/remove` before clearing a token. A provider failure stops that reset
instead of falsely claiming revocation. Full workspace reset refuses to proceed while an active Plaid
token exists, requiring the explicit disconnect workflow first.

CSV-history clearing detaches the batch/row foreign keys but does not rewrite original description,
amount text, date text, source type, source filename, or other transaction provenance. Transaction
clearing detaches forecast and Plaid evidence before deletion so planning rules, import traceability,
and connected-account configuration remain internally valid.
