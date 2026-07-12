# Import Format

Phase 2A supports local CSV transaction import only.

Unsupported formats: OFX, QFX, QBO, PDF statements, OCR, direct bank connections, provider APIs, background sync, webhooks, automatic merchant rules, automatic transfer confirmation, and AI categorization.

## Supported Files

- Extension: `.csv`.
- Encodings: UTF-8 and UTF-8 with BOM.
- Delimiters: comma, semicolon, and tab.
- Maximum file size: 512 KB.
- Maximum data rows: 1,000.
- Maximum field length: 500 characters.
- Header rows are supported and recommended. Headerless files use generated `Column 1`, `Column 2`, etc.

Uploaded CSV file contents are parsed locally and are not stored permanently. Import batches store file hash, redacted filename, file size, encoding, delimiter, row status, and safely serialized source fields required to explain imported transactions.

## Workflow

1. Select an active account.
2. Select a CSV file.
3. Preview detected rows, encoding, delimiter, headers, and sample data.
4. Map columns and configure parsing.
5. Validate rows.
6. Review invalid rows, warnings, and duplicate candidates.
7. Confirm import with the explicit confirmation contract.
8. Review summary and batch history.
9. Undo a batch when no imported transactions were materially edited.
10. Review any transfer and recurring candidates found after import.

Transactions are not created until explicit confirmation.

## Date Formats

Supported explicit date formats:

- `MM/DD/YYYY`
- `M/D/YYYY`
- `YYYY-MM-DD`
- `DD/MM/YYYY`
- `D/M/YYYY`
- `MM/DD/YY`
- `DD/MM/YY`

Ambiguous slash dates such as `03/04/2026` require a selected date format. Statement transactions use date-only UTC-midnight semantics for persistence; no timezone conversion is inferred from CSV files.

## Amount Modes

`SIGNED_AMOUNT` uses one amount column, for example:

- `125.50`
- `-125.50`
- `$1,250.00`
- `(125.50)`

`DEBIT_CREDIT_COLUMNS` uses separate debit and credit columns. The sign convention is explicit:

- `DEBITS_NEGATIVE`: debit rows become expenses and credit rows become income.
- `DEBITS_POSITIVE`: debit rows become positive and credit rows become negative.

Decimal separator and thousands separator are configurable. Values with excess fractional precision are rejected rather than rounded.

## Original And Normalized Values

Imported transactions preserve:

- Original description.
- Original amount text.
- Original date text.
- Source row number.
- Import batch ID.
- Import row ID.
- Source filename.
- Source account.
- Source type `CSV_IMPORT`.

Editable normalized fields remain separate:

- Merchant.
- Category.
- Type.
- Review status.
- Notes.
- Exclusion.

Normal transaction editing does not overwrite original imported values.

## Duplicate Logic

Duplicate candidates are explainable and conservative. The current scoring considers:

- Same account.
- Same transaction date.
- Same amount.
- Same original description.
- Same file and row metadata when available.

Statuses are:

- `NONE`
- `POSSIBLE`
- `LIKELY`
- `EXACT`

Duplicate candidates are never silently discarded. The user can import, skip, or leave a row for review. Repeated imports of the same file hash for the same account are blocked by default and require an explicit override.

## Undo Rules

Undo removes only transactions created by the selected import batch, records an audit event, and marks the batch `UNDONE`. Audit history and batch metadata remain.

Undo is blocked when imported transactions were materially edited after import, including category assignment, note changes, exclusion changes, review-status changes, or merchant normalization changes.

Undo is also blocked when imported transactions participate in confirmed transfer matches. Unmatch the transfer before undoing the batch.

After import confirmation, transfer candidate generation runs for imported transactions. It never confirms automatically and records a recoverable warning in batch metadata if scanning fails.

After import confirmation, recurring candidate generation also runs locally against household transaction history. It never confirms automatically and records a recoverable warning in batch metadata if scanning fails.

## Security Notes

The importer rejects unsupported extensions, empty files, oversized files, binary content, duplicate headers, malformed quoting, overly long fields, missing required mapped columns, invalid dates, invalid amounts, and formula-like non-amount fields.

Do not commit real CSV exports. Synthetic fixtures live under `tests/fixtures/csv/`.
