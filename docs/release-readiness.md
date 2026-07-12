# Release Readiness

- Planning schedules, satisfaction, and savings policy are durable, audited, backup/reset-safe, and tested.
- Cash allocation identities reconcile exactly in integer cents across all policy modes and are shared by Cash Flow and Overview.

- Cash Flow and Safe to Save are repository-derived and explainable. Expected-income and general scheduled-obligation CRUD remain documented limitations rather than fabricated projections.

Date: 2026-07-12

## Implemented Capabilities

- Deterministic debt payoff with minimum-only, Avalanche, Snowball, Custom, explicit extra payment,
  rollover, schedule, saved/audited plan state, confidence, and invalid-metadata blocking.

- Local-first household settings, categories, accounts, goals, transactions, import history, transfer review, backup metadata, and audit records.
- Addressable Settings tabs for Household, Categories, Backup & Data, and Privacy.
- Privacy guidance for local storage, browser preferences, backups, telemetry, bank credentials, and external AI.
- Separate Add/Edit workflows for accounts and goals.
- Account-type conditional fields and curated institution selector with Other institution entry.
- Dedicated goal contribution workflow with contribution history.
- CSV import preview, mapping, validation, repeated-file blocking, duplicate review, confirmation, and undo.
- Transaction search, account/category/type/status/source filters, URL state, result counts, pagination, and bounded table scrolling.
- Advanced date/period, amount, excluded, transfer, and recurring-link filters plus durable saved/default views and server-side pagination.
- Explicit current-page bulk review and merchant rules with preview, confirmed relationship protections, manual provenance, import application, and audit trails.
- Account balances are anchored transaction ledgers with explicit reconciliation and positive liability semantics; cash-flow/Safe-to-Save remains gated for the next reviewed phase.
- Explainable transfer review with scan, confirm, reject, unmatch, eligible manual-match filtering, and validation feedback.
- Explainable recurring-expense review with scan, confirm, reject, edit, manual creation, cancellation tracking, reactivation, supporting transactions, price-change flags, and savings selection.
- Local backup creation, validation, restore preview, mandatory pre-restore safety backup, restore confirmation, and backup deletion.
- Demonstration data reset with exact confirmation, visible pending/success/error feedback, active-database diagnostics, canonical seed counts, and browser preference preservation.
- Start fresh with exact confirmation, before/after counts, backup ZIP preservation, browser preference preservation, empty workspace creation, workspace-state badges, and empty states for core screens.
- Repository-derived preliminary Overview, Cash Flow, Budget, Debt, and Reports values where deterministic local account, category, goal, recurring, transfer, import, and transaction inputs exist.
- Actionable Overview sections for Needs Your Attention, Upcoming Obligations, Spending by Category, Goals Snapshot, and Debt Snapshot with functional drill-down links.

## Demonstration-only Capabilities

- Seed data is synthetic demonstration data.
- Report export and the general decision scenario engine remain unavailable.
- Planned controls are visible but disabled for later phases.
- Transfer and recurring detection are deterministic and local; they are not AI, bank-connected, or automated account-management services.

## Known Limitations

- Transaction amount-range entry is currently expressed in integer minor units.
- Overview upcoming obligations only include persisted account minimums and confirmed recurring records; no reservation engine or bill-pay workflow is implemented.
- Curated institutions are stored as account institution text; there is no separate institution table or normalized identifier yet.
- Goal contribution source account is stored as contribution source text, not a foreign key.
- Delete-all-data and general export workflows are not implemented.
- Restore demonstration data is intentionally limited to the synthetic single-household environment and is not a general delete-all-data workflow.
- Start fresh deletes local financial/import/transfer/recurring records after typed confirmation. Remove demo records only and Delete all local financial data remain unimplemented separate workflows.
- CSV import still requires manual mapping choices for many files.
- Advanced forecasting, bank connectivity, external AI, automated categorization, and automated service cancellation are out of scope.

## Security Limitations

- The app is local-first, but the local database is not encrypted by the application.
- Backup ZIP files contain sensitive, unencrypted financial data.
- Browser local storage is used only for lightweight UI preferences such as navigation state.
- No telemetry, ads, external AI calls, or bank credential storage are included.
- Users must secure the local machine, filesystem, and backup destination.

## Backup Warning

Backups should be stored only in a secure local or encrypted location. Do not email, commit, or upload backup ZIP files unless the destination is explicitly trusted and protected.

Create a backup before using Restore demonstration data or Start fresh if the current local workspace contains changes worth preserving. Both workflows replace or remove database records but do not delete backup ZIP files.

## Browser Support

- Verified with Playwright Chromium desktop and mobile viewport projects.
- Responsive smoke coverage includes desktop, tablet, and mobile widths.
- Other browsers should be treated as unverified until tested.

## Local Startup

```bash
npm install
npm run db:reset
npm run dev
```

Open `http://localhost:3000`.

For production smoke testing:

```bash
npm run build
npm run start
```

## Manual UAT Results

Manual release-readiness checks were rerun with synthetic seed data and the corrected local workflows. Automated Playwright coverage was used as supporting evidence for persistence, accessibility, and responsive behavior.

| Check                                   | Result | Evidence                                                                                                           |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Settings tab navigation                 | Passed | Settings tabs switch visible content and preserve `#privacy` URL state.                                            |
| Browser back/forward behavior           | Passed | Hash-addressed Settings tabs participate in browser history.                                                       |
| Privacy tab                             | Passed | Privacy tab contains local storage, backup, telemetry, bank credential, external AI, and deletion/export guidance. |
| Add account                             | Passed | Add Account opens blank and creates a synthetic account.                                                           |
| Edit account                            | Passed | Selecting an existing account switches to Edit Account and Cancel returns to Add Account.                          |
| Account-type conditional fields         | Passed | Checking, credit card, loan, and mortgage fields show only relevant inputs.                                        |
| Add goal                                | Passed | Add Goal creates a synthetic goal without editing an existing goal.                                                |
| Edit goal                               | Passed | Selecting a goal switches to Edit Goal and Cancel returns to Add Goal.                                             |
| Goal contribution and history           | Passed | Contribution records with date/source/note persist after reload.                                                   |
| CSV repeated-file warning               | Passed | Exact repeated file warning blocks confirm until explicit override.                                                |
| Transaction search                      | Passed | Search filters transactions and persists `q` in the URL.                                                           |
| Account filter                          | Passed | Account filter updates results and URL state.                                                                      |
| Category filter                         | Passed | Category filter updates results and URL state.                                                                     |
| Status filter                           | Passed | Review-status filter updates results and URL state.                                                                |
| Source filter                           | Passed | Source filter updates results and URL state.                                                                       |
| Pagination                              | Passed | Result counts, page size, and paging controls work in bounded table.                                               |
| Manual transfer invalid-pair feedback   | Passed | Invalid manual matches are prevented or return visible validation feedback.                                        |
| Manual transfer valid-pair confirmation | Passed | Eligible synthetic transfer pair can be confirmed and persists.                                                    |
| Recurring scan and review               | Passed | Synthetic recurring charges produce reviewable candidates with evidence.                                           |
| Recurring confirm/reject/edit           | Passed | Recurring suggestions can be confirmed, rejected, edited, and audited.                                             |
| Recurring manual creation and savings   | Passed | Manual synthetic recurring item can be created and included in savings calculation.                                |
| Demo reset observability                | Passed | Reset shows pending, success counts, safe active database identifier, and visible failure errors.                  |
| Demo reset canonical data               | Passed | User-created synthetic category is removed, canonical categories remain after reload, and nav preference persists. |
| Persistence after reload                | Passed | Settings, accounts, goals, contributions, imports, filters, and transaction edits persist after reload.            |

## Validation Snapshot

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test`: passed
- `npm run db:reset`: passed
- `npm run test:e2e`: passed
- `npm run build`: passed
- `npm audit`: known moderate Next/PostCSS advisory remains
- `npm audit --omit=dev`: known moderate Next/PostCSS advisory remains

## Go/No-go Status

Go for the next feature phase only after preserving this UAT evidence and keeping private screenshots out of git.

Do not start bank connectivity, external AI, automated cancellation, or advanced forecasting until the next feature phase has a fresh scope, threat model update, and UAT acceptance criteria.
