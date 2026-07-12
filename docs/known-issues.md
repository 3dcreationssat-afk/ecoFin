# Known Issues

- Match suggestions require confirmation and use amount/date proximity; merchant-aware split allocation remains future work.
- Conservative and Aggressive modes use documented 35% ceiling and 75% floor respectively; richer per-mode reserve presets remain future product policy work.

- Cash Flow does not invent expected income from a schedule label or isolated history; explicit expected-income CRUD and a general scheduled-obligation model remain future work. Safe to Spend is zero when the full surplus is allocated to Recommended Safe to Save.

- Debt payoff is a validated deterministic monthly approximation; variable/promotional rates,
  balloon payments, irregular schedules, fees, and lender-specific daily interest remain unsupported.
- Saved debt-plan extra payments intentionally do not affect Cash Flow; that integration is deferred.
- Overview, Cash Flow, Budget, Debt, and Reports now use repository-derived values where deterministic local inputs exist, but cash-flow month-end and budget forecast values are still planning signals rather than validated recommendations.
- Overview category links use the existing Transactions category/status filters. Dedicated period filters and saved transaction views are still deferred.
- An old Custom plan becomes incomplete when the eligible debt set changes and must be reviewed; it
  never silently falls back to Avalanche.
- CSV transaction import is implemented for Phase 2A. OFX, QFX, QBO, PDF parsing, OCR, bank connectivity, provider APIs, automatic transfer confirmation, merchant rules, and AI categorization are not implemented.
- Import duplicate detection is conservative candidate review, not an automatic deduplication engine.
- Import undo is blocked after material edits and does not provide a merge/review UI for edited imported transactions yet.
- Base44 screenshots were used as static references; exact pixel values are estimated.
- Report Print, CSV, and HTML export controls are disabled because export is not implemented.
- Backup/restore is local-only, unencrypted, same-version/same-schema only, and has no selective restore, scheduled backup, remote provider, or merge workflow.
- Transfer matching supports exact same-currency one-to-one matches only. Fees, partial transfers, aggregated transfers, currency conversion, investment transfers, and recurring-transfer auto-confirmation are not implemented.
- Transfer suggestions are conservative and must be manually confirmed; no transfer is auto-confirmed.
- Recurring detection is deterministic and local, but it does not cancel services, contact merchants, use bank-provider metadata, or run advanced forecasts.
- Restore demonstration data is single-household and intended for the synthetic local dataset only. It replaces database records with canonical sample data but does not delete local backup ZIP files or browser UI preferences.
- Start fresh creates an empty single-household workspace and preserves backups/preferences, but it is not a selective Remove demo records only workflow and not a general Delete all local financial data workflow.
- Date and duration formatting are not fully centralized.
- `npm audit` and `npm audit --omit=dev` report a moderate Next.js/PostCSS advisory. The reported fix is a semver-major downgrade to `next@9.3.3`, so it was not applied.
- Transaction amount-range controls currently accept integer minor units rather than localized decimal currency input.
- Saved-view management uses a compact popover and native confirmation prompts; richer dialog focus trapping remains a future design-system refinement.
- Bulk selection is deliberately page-scoped and limited to 100 explicit IDs; there is no “all matching” bulk operation.
- Merchant rules do not support regular expressions. Rule application is synchronous and bounded for the current local-first dataset; background jobs are not implemented.
- Pending/cleared status is modeled, but CSV currently imports validated rows as cleared because statement pending-state mapping is not implemented.
- Amount/date/account corrections and manual transaction creation remain unavailable; when implemented they must use the centralized ledger recalculation service.
