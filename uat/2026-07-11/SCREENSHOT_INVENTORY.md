# Sanitized Screenshot Inventory

The screenshot files in `uat/2026-07-11/screens/` were inspected for release-readiness evidence handling. They are intentionally not committed because they may contain personal names, transaction descriptions, account details, and financial amounts.

| File                                             | Classification                      | Reason                                                                             | Git handling             |
| ------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------- | ------------------------ |
| `01-settings-household-overview.png`             | Sensitive and should remain ignored | UI screenshot may include household/account context and local environment details. | Ignored via `.gitignore` |
| `02-settings-backup-data-empty-history.png`      | Sensitive and should remain ignored | Backup/data screenshots may expose local data counts or filenames.                 | Ignored via `.gitignore` |
| `03-settings-backup-created.png`                 | Sensitive and should remain ignored | Backup screenshots may expose backup filename/hash metadata.                       | Ignored via `.gitignore` |
| `04-settings-restore-validated.png`              | Sensitive and should remain ignored | Restore screenshots may expose backup metadata.                                    | Ignored via `.gitignore` |
| `05-household-settings-fields.png`               | Sensitive and should remain ignored | Household settings may include planning amounts.                                   | Ignored via `.gitignore` |
| `06-category-management-parent-options.png`      | Sensitive and should remain ignored | Category screenshots may expose budget/category structure.                         | Ignored via `.gitignore` |
| `07-accounts-editor.png`                         | Sensitive and should remain ignored | Account screenshots include account details and balances.                          | Ignored via `.gitignore` |
| `08-accounts-list.png`                           | Sensitive and should remain ignored | Account list includes account details and balances.                                | Ignored via `.gitignore` |
| `09-goals-editor.png`                            | Sensitive and should remain ignored | Goal screenshots include savings targets and account links.                        | Ignored via `.gitignore` |
| `10-goal-added-pickup-truck.png`                 | Sensitive and should remain ignored | Goal screenshot may include private goal names and amounts.                        | Ignored via `.gitignore` |
| `11-csv-import-start.png`                        | Sensitive and should remain ignored | Import screenshots may expose file/account context.                                | Ignored via `.gitignore` |
| `12-csv-preview-mapping.png`                     | Sensitive and should remain ignored | CSV preview may expose transaction fields.                                         | Ignored via `.gitignore` |
| `13-csv-import-summary-first.png`                | Sensitive and should remain ignored | Import summary may expose counts and file context.                                 | Ignored via `.gitignore` |
| `14-transactions-long-page.png`                  | Sensitive and should remain ignored | Transaction list includes descriptions and amounts.                                | Ignored via `.gitignore` |
| `15-transactions-search-and-transfer-review.png` | Sensitive and should remain ignored | Transactions/transfer review may expose transaction descriptions and amounts.      | Ignored via `.gitignore` |
| `16-transfer-review-manual-match.png`            | Sensitive and should remain ignored | Manual match dropdowns include transaction descriptions and amounts.               | Ignored via `.gitignore` |
| `17-csv-review-warnings.png`                     | Sensitive and should remain ignored | CSV review rows include transaction descriptions and amounts.                      | Ignored via `.gitignore` |
| `18-csv-import-summary-second.png`               | Sensitive and should remain ignored | Import summary may expose file context and counts.                                 | Ignored via `.gitignore` |
| `19-duplicate-transactions-visible.png`          | Sensitive and should remain ignored | Duplicate review includes transaction descriptions and amounts.                    | Ignored via `.gitignore` |
| `manifest.json`                                  | Generated                           | Contains generated screenshot metadata and hashes for private screenshots.         | Ignored via `.gitignore` |
