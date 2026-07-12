# Known Issues

- Financial engines are not implemented; UI values are synthetic demonstration data.
- Safe-to-save, cash-flow, budget forecast, debt payoff, and decision scenario outputs remain demonstration-only.
- CSV transaction import is implemented for Phase 2A. OFX, QFX, QBO, PDF parsing, OCR, bank connectivity, provider APIs, automatic transfer confirmation, merchant rules, and AI categorization are not implemented.
- Import duplicate detection is conservative candidate review, not an automatic deduplication engine.
- Import undo is blocked after material edits and does not provide a merge/review UI for edited imported transactions yet.
- Base44 screenshots were used as static references; exact pixel values are estimated.
- Report Print, CSV, and HTML export controls are disabled because export is not implemented.
- Backup/restore is local-only, unencrypted, same-version/same-schema only, and has no selective restore, scheduled backup, remote provider, or merge workflow.
- Transfer matching supports exact same-currency one-to-one matches only. Fees, partial transfers, aggregated transfers, currency conversion, investment transfers, and recurring-transfer auto-confirmation are not implemented.
- Transfer suggestions are conservative and must be manually confirmed; no transfer is auto-confirmed.
- Recurring detection is deterministic and local, but it does not cancel services, contact merchants, use bank-provider metadata, or run advanced forecasts.
- Demo reset is single-household and intended for the synthetic local dataset only.
- Date and duration formatting are not fully centralized.
- `npm audit` and `npm audit --omit=dev` report a moderate Next.js/PostCSS advisory. The reported fix is a semver-major downgrade to `next@9.3.3`, so it was not applied.
