# Transaction Bulk Actions

Transactions supports explicit row selection and “Select current page.” Selection never means all matching records, is limited to the server-paginated page, survives drawer open/close, and clears when URL filter, sort, page, or page-size state changes.

Available actions are assign category, mark reviewed, mark needs review, exclude/restore from reports, set a safe non-transfer type, normalize merchant, reapply merchant rules, and create a future merchant rule from the first selected record. There is no bulk deletion.

The server accepts 1–100 explicit IDs, revalidates household ownership and every ID, validates values with Zod, and performs small operations all-or-nothing in one database transaction. Reporting-impacting changes require confirmation. Generic type changes reject confirmed transfers; type/merchant changes reject confirmed recurring links. Immutable import values are never writable. Each changed field receives a transaction audit record and the operation receives a bounded summary audit without transaction descriptions.

Known limitation: selection does not span pages. A filter or pagination change intentionally clears it to prevent accidental scope expansion.
