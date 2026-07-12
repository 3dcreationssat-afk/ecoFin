# Transaction Filters and Saved Views

`/transactions` is server-filtered and URL-authoritative. Browser history, reloads, and direct links restore the represented state. A material filter or sort change resets `page` to 1; page and page-size changes preserve the other state. Invalid values safely use application defaults and empty/default values are omitted.

## Query parameters

| Parameter                  | Meaning                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `q`                        | Merchant, original description, or source-file search (maximum 120 characters)                                          |
| `account`, `category`      | Account/category ID; `category=uncategorized` selects missing categories                                                |
| `status`, `source`, `type` | Review status, source, and supported persisted transaction type                                                         |
| `period`                   | `CURRENT_MONTH`, `PREVIOUS_MONTH`, `THIS_QUARTER`, `PREVIOUS_QUARTER`, `THIS_YEAR`, `PREVIOUS_YEAR`, `CUSTOM`, or `ALL` |
| `from`, `to`               | ISO dates used only with `period=CUSTOM`                                                                                |
| `amountMin`, `amountMax`   | Signed integer minor-unit inclusive bounds                                                                              |
| `excluded`                 | `all`, `included`, or `excluded`                                                                                        |
| `transfer`                 | `all`, `confirmed`, `suggested`, `unmatched`, or `none`                                                                 |
| `recurring`                | `all`, `confirmed`, `suggested`, or `none`                                                                              |
| `sort`, `direction`        | Sort field and `asc`/`desc` direction                                                                                   |
| `page`, `pageSize`         | One-based page and 25, 50, or 100 rows                                                                                  |

Financial-month periods use the household's configured financial-month start day. Amount comparisons use signed integer minor units; transaction type provides income/expense direction. Confirmed and suggested transfer/recurring relationships remain distinct.

## Saved views

Saved views persist a validated query preference, name, page size, sort, and default flag in SQLite. They do not snapshot transactions. Names are trimmed, limited to 60 characters, and unique per household without regard to case. Delete archives a view. Apply, rename, update, set/remove default, and delete expose pending and live-region feedback.

Precedence is: explicit supported URL state, household default saved view, then application defaults. `/transactions?period=ALL` is the explicit unfiltered route and therefore does not apply the household default.

Start Fresh and Restore demonstration data remove saved views and do not seed replacements. SQLite backup/restore preserves them and validates their table as part of the schema fingerprint.

## Drill-downs

Overview category spending supplies category plus the current financial period. Overview attention items supply status filters. Data Quality supplies uncategorized, duplicate/status, transfer, recurring, account, or import-source destinations. Account activity can use `account=<id>`.

Known limitations: amount inputs are currently minor units; saved search text is stored only when the user explicitly saves the view; the feature does not add bulk actions, rules, transaction splits, or new import formats.
