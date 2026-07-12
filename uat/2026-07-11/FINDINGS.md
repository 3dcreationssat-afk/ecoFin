# Financial Compass — Hands-on UAT Findings

Date: 2026-07-11
Environment: `http://localhost:3000`

## Executive assessment

Core persistence, backup, import, and transfer-review foundations are present, but the app is not yet ready for comfortable day-to-day use. The main blockers are nonfunctional settings tabs, missing privacy content, add/edit ambiguity, developer-facing terminology, weak account-type guidance, unclear goal contributions, non-scalable transaction browsing, nonfunctional search, unclear duplicate handling, and silent transfer-match failure.

## Findings

### 1. Settings tabs do not work

`Household`, `Categories`, `Backup & Data`, and `Privacy` look like tabs but do not change the view or scroll to the relevant section. Users must scroll manually. No actual Privacy section was found; `Demonstration Data Reset` appears instead.

Expected:

- Real routed or stateful tabs
- Active tab indication
- Back/forward support
- A real Privacy section
- Demonstration Data Reset under Backup & Data or its own clearly named tab

Evidence: `01-settings-household-overview.png` through `04-settings-restore-validated.png`

### 2. Household settings are too technical

The text “SQLite is the source of truth” is internal implementation language. Raw enums such as `BI_WEEKLY` and `AVALANCHE` are exposed. Field meanings are not explained.

Expected:

- Plain-language labels
- Info icons/help for Financial month start, Income schedule, Checking buffer, Emergency fund target, and Debt strategy
- Currency-aware inputs
- No implementation details in normal UI

Evidence: `01-settings-household-overview.png`, `05-household-settings-fields.png`

### 3. Account add/edit workflow is ambiguous

The same editor can edit an existing account or create a new one. `Save account` and `Create as new` appear together, creating a risk of accidental overwrite or duplication.

Expected:

- Separate Add Account and Edit Account flows
- Explicit mode heading
- Clear cancel/reset behavior
- New-account flow must not start with an existing record loaded

Evidence: `07-accounts-editor.png`, `08-accounts-list.png`

### 4. Account fields are not type-aware

APR, minimum payment, due date, statement date, balance, and available balance are shown together regardless of account type. `Available` versus `Balance` is unexplained. `Statement date` is ambiguous.

Expected:

- Checking/savings: balance and optional available balance
- Credit card: balance, available credit, credit limit, APR, minimum payment, payment due day, statement closing day
- Loan/mortgage: outstanding balance, APR, minimum payment, payment due day
- Info icons and plain-language descriptions

### 5. Institution should use a curated list plus Other

Free-text institution entry works, but a searchable curated list would improve consistency, future CSV profile reuse, and later bank connectivity. Include `Other institution` and store a normalized institution identifier separately.

### 6. Goal add/edit workflow is ambiguous

The same editor is used to edit an existing goal and create a new one. `Save goal` and `Create as new` appear together.

Expected:

- Separate Add Goal and Edit Goal modes
- Clear mode heading
- No accidental duplication or overwrite

Evidence: `09-goals-editor.png`, `10-goal-added-pickup-truck.png`

### 7. Goal contributions are unclear

Contribution recording appears inside the goal configuration form. It is unclear whether editing `Current` is equivalent to a contribution, and contribution history is not visible.

Expected:

- Separate contribution workflow
- Modal/drawer with amount, date, source account, note, and resulting progress
- Contribution history
- Clear rule for direct current-amount adjustments

### 8. Category management needs explanations

`Category name`, `Group`, `Parent category`, `Type`, `Budget`, and `Sort order` are not self-explanatory. The difference between Group and Parent category is unclear, and the purpose of Budget is not obvious.

Expected:

- Info icons and examples
- Friendly enum labels
- Clear hierarchy rules
- Explanation of where category budget is used

Evidence: `06-category-management-parent-options.png`

### 9. CSV import works but is too technical

The import completed successfully, but raw terms such as `SIGNED_AMOUNT` and `DEBITS_NEGATIVE` are exposed. Users must understand delimiter, encoding, date format, and separators without guidance. Many rows show “Ambiguous slash date” even after an explicit date format was selected.

Expected:

- Friendly labels and examples
- Auto-detection with override
- Warnings only when uncertainty remains
- Better review summary for large imports

Evidence: `11-csv-import-start.png`, `12-csv-preview-mapping.png`, `17-csv-review-warnings.png`

### 10. Repeated-file behavior is not clearly communicated

The same CSV was imported twice. No prominent repeated-file warning was observed. The second import showed 2 duplicate candidates and skipped 2 rows, but did not clearly say the same file had already been imported.

Expected:

- Exact-file warning before confirmation
- Prior batch date/account/count
- Block by default
- Explicit override
- Distinguish repeated file, duplicate row, and possible duplicate transaction
- Link to duplicate review

Evidence: `13-csv-import-summary-first.png`, `18-csv-import-summary-second.png`, `19-duplicate-transactions-visible.png`

### 11. Transaction list does not scale

Hundreds of transactions render as one extremely long page. There is no practical pagination or bounded table review experience.

Expected:

- Server-side or cursor pagination
- Default 25 or 50 rows
- Page-size selector
- Result count
- Sticky header inside a bounded container
- URL-preserved filters

Evidence: `14-transactions-long-page.png`

### 12. Search appears nonfunctional

Typing `starbucks` in the top search field did not visibly filter the transaction list.

Expected:

- Functional scoped search with result count, or remove/disable it until implemented

Evidence: `15-transactions-search-and-transfer-review.png`

### 13. Transfer review is hard to understand

`Scan transfers` is not explained. No suggested pairs appeared. Manual matching uses raw transaction dropdowns, and selected transactions can have different amounts. The user does not know what qualifies as a valid pair.

Expected:

- Plain-language explanation of transfer candidates
- Info icon/help
- Eligible counterpart filtering
- Candidate comparison cards
- Inline validation for amount, sign, account, and date rules
- Clear empty state

Evidence: `15-transactions-search-and-transfer-review.png`, `16-transfer-review-manual-match.png`

### 14. Manual transfer match failure is silent

Clicking `Create manual match` appeared to do nothing.

Expected:

- Loading, success, validation-error, and server-error states
- Prevent invalid submission
- Explain exact failure reason
- No silent button behavior

### 15. Privacy section is missing

A Privacy tab exists, but no privacy content was found.

Expected:
Explain:

- Local-only storage
- What SQLite stores
- What browser preferences store
- Backup sensitivity
- No telemetry
- No bank credentials
- No external AI
- Future connected-account implications
- Data deletion/export status

### 16. Internal enums and implementation terms are exposed

Examples:

- `BI_WEEKLY`
- `AVALANCHE`
- `EXPENSE`
- `SIGNED_AMOUNT`
- `DEBITS_NEGATIVE`
- `CSV_IMPORT`
- `NEEDS_REVIEW`

Expected:

- Plain-language user labels
- Internal values only in code or diagnostics

## Positive findings

- Backup creation worked.
- Downloaded backup validated successfully.
- Restore validation showed same-schema compatibility and integrity OK.
- Category creation worked.
- Account creation worked.
- Goal creation worked.
- CSV import completed successfully with a large file.
- Imported transactions persisted.
- Duplicate candidates were not blindly imported in at least one observed case.
- Transfer Review exists and matches the intended product direction.

## Sensitive backup note

The downloaded backup ZIP is intentionally not included in this package because it contains sensitive, unencrypted SQLite financial data.

## Recommended correction order

1. Fix Settings navigation and add Privacy.
2. Separate Add/Edit flows for accounts and goals.
3. Separate goal contribution from goal configuration.
4. Add contextual help and friendly labels.
5. Make account fields type-aware.
6. Add transaction pagination and working search/filtering.
7. Improve repeated-file and duplicate messaging.
8. Fix transfer matching validation and feedback.
9. Clean up all user-facing terminology.
10. Re-run UAT before starting another major feature phase.
