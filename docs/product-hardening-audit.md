# Product Hardening Audit

Date: 2026-07-18

Status values are `WORKING`, `PARTIAL`, `REMOVED`, `BLOCKED`, or `NOT TESTED`. The rendered audit
was read-only against the REAL workspace. Financial mutations were not used to prove controls.
Repeatable mutation coverage uses isolated TEST databases.

| Screen       | Control                                         | Intended behavior                           | Actual behavior at audit                                                      | Status  | Test coverage                                 | Resolution                                                             |
| ------------ | ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | ------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Global shell | Navigation links                                | Open every production page                  | Routes and active state work                                                  | WORKING | Playwright desktop/mobile navigation          | Retained                                                               |
| Global shell | Collapse/expand navigation                      | Persist a UI preference                     | Works across reloads                                                          | WORKING | Playwright                                    | Retained                                                               |
| Global shell | Transaction search                              | Open filtered Transactions                  | Enter submits a URL query                                                     | WORKING | Transaction query tests                       | Retained                                                               |
| Global shell | Import                                          | Open CSV workflow                           | Works, including same-page event                                              | WORKING | Playwright CSV workflow                       | Retained                                                               |
| Global shell | Add                                             | Start an unspecified add workflow           | Disabled placeholder                                                          | REMOVED | Playwright absence assertion                  | Removed; actions stay contextual                                       |
| Global shell | Month and household selectors                   | Change reporting context                    | One-option controls with no behavior                                          | REMOVED | Render audit                                  | Removed until real multi-period/household behavior exists              |
| Global shell | Theme                                           | Select light, dark, or system               | Moon icon had no action                                                       | WORKING | Playwright persistence test                   | Implemented three-state persisted theme with pre-hydration application |
| Global shell | Notifications                                   | Open meaningful event inbox                 | Bell and unread dot had no action                                             | REMOVED | Render audit                                  | Removed until sync/reauth events justify a persisted inbox             |
| Global shell | Profile menu                                    | Open household/profile actions              | Initials and chevron had no action                                            | REMOVED | Render audit                                  | Removed                                                                |
| Overview     | Summary cards and drilldowns                    | Explain cash, flow, debt, spending          | Repository-derived; data confidence remains limited                           | PARTIAL | Domain and Playwright tests                   | Retained; balance freshness and payroll drilldown remain open          |
| Overview     | Attention links                                 | Open focused remediation                    | Links work, but the real workspace shows an excessive categorization workload | PARTIAL | Playwright links                              | Exception prioritization and learned automation remain open            |
| Transactions | Search/filter/sort/pagination                   | Query a bounded ledger                      | Working and URL-addressable                                                   | WORKING | Unit, integration, Playwright                 | Retained                                                               |
| Transactions | Saved views                                     | Save and restore filters                    | Working and persistent                                                        | WORKING | Integration/Playwright                        | Retained                                                               |
| Transactions | Import CSV                                      | Stage, validate, review, confirm, undo      | Working with explicit duplicate handling                                      | WORKING | Unit/integration/Playwright                   | Retained                                                               |
| Transactions | Add Transaction                                 | Create a manual ledger record               | Disabled placeholder                                                          | REMOVED | Playwright absence assertion                  | Removed until audited manual-entry contract exists                     |
| Transactions | Bulk actions and merchant rules                 | Apply bounded learned decisions             | Working with manual protections                                               | WORKING | Unit/integration/Playwright                   | Retained and reused by Plaid sync                                      |
| Transactions | Transfer review                                 | Suggest, confirm, reject, unmatch           | Working, but high-confidence auto-confirm is not enabled                      | PARTIAL | Unit/integration/Playwright                   | Cross-source auto-confirm policy remains open                          |
| Cash Flow    | Scenarios, explanation, planning forms          | Explain deterministic forecast              | Working with documented confidence limits                                     | WORKING | Unit/integration/Playwright                   | Retained                                                               |
| Budget       | Add Category                                    | Open category creation                      | Disabled duplicate of Settings action                                         | REMOVED | Source/render audit                           | Removed; Settings owns category creation                               |
| Budget       | Tables and summaries                            | Show repository-derived budget pace         | Working but preliminary                                                       | PARTIAL | Domain and responsive Playwright              | Keep preliminary label                                                 |
| Recurring    | Scan, filters, review drawer, lifecycle actions | Detect and manage recurring records         | Working                                                                       | WORKING | Unit/integration/Playwright                   | Retained; cross-source dedupe remains open                             |
| Debt         | Add Debt                                        | Create liability account                    | Disabled duplicate of Accounts action                                         | REMOVED | Source/render audit                           | Removed; Accounts owns liability creation                              |
| Debt         | Planner strategies and persistence              | Model deterministic payoff                  | Working with explicit limitations                                             | WORKING | Unit/integration/Playwright                   | Retained                                                               |
| Goals        | Add/edit/contribute/archive                     | Manage saved goals                          | Working                                                                       | WORKING | Integration/Playwright                        | Retained                                                               |
| Decisions    | Scenario/component lifecycle                    | Model isolated decisions                    | Working; vehicle inputs remain a monthly-payment abstraction                  | PARTIAL | Unit/integration/Playwright                   | Full vehicle/loan input model remains open                             |
| Reports      | Export actions                                  | Print or download reports                   | Disabled placeholders                                                         | REMOVED | Playwright absence assertion                  | Removed until export is implemented                                    |
| Reports      | Report/comparison selectors                     | Change report view                          | Disabled one-option placeholders                                              | REMOVED | Render audit                                  | Removed                                                                |
| Data Quality | Issue links                                     | Explain material data defects               | Working, but not yet a unified exception inbox                                | PARTIAL | Domain/Playwright                             | Prioritized Plaid/CSV exception model remains open                     |
| Accounts     | Manual add/edit/archive/delete                  | Maintain local accounts                     | Working with validation and history guards                                    | WORKING | Integration/Playwright                        | Retained                                                               |
| Accounts     | Reconcile                                       | Compare ledger/provider snapshot            | Working for manual snapshots                                                  | WORKING | Integration                                   | Plaid timestamps and provider labels added separately                  |
| Accounts     | Connect institution                             | Launch Plaid Link securely                  | Not present before audit                                                      | PARTIAL | Type/unit coverage; Sandbox Link not yet run  | Added with workspace/environment gates                                 |
| Accounts     | Account match/create/ignore                     | Reuse or propose local accounts             | Not present before audit                                                      | PARTIAL | Account-scoring unit tests                    | Added; Sandbox end-to-end validation remains open                      |
| Accounts     | Sync now                                        | Apply incremental provider changes          | Not present before audit                                                      | PARTIAL | Four isolated persistence integration tests   | Added; live Sandbox acceptance remains open                            |
| Accounts     | Reauthenticate                                  | Launch Link update mode                     | Not present before audit                                                      | PARTIAL | Route/UI coverage pending                     | Added for provider login-required state                                |
| Accounts     | Disconnect                                      | Revoke Item, remove token, preserve history | Not present before audit                                                      | PARTIAL | Service coverage pending                      | Added with exact confirmation payload and provider-first removal       |
| Settings     | Household/category/rule tabs                    | Persist validated settings                  | Working                                                                       | WORKING | Integration/Playwright                        | Retained                                                               |
| Settings     | Backup create/download/delete/restore           | Protect and recover local workspace         | Working and validated before migration                                        | WORKING | Unit/integration/Playwright/manual validation | Retained                                                               |
| Settings     | Workspace identity display                      | Show safe context                           | Exposed internal workspace ID and absolute database path                      | WORKING | Type/render audit                             | Replaced with type/name/source; identifiers stay server-side           |
| Settings     | Delete all data unavailable                     | Communicate a future action                 | Disabled placeholder                                                          | REMOVED | Source audit                                  | Removed                                                                |
| Settings     | Start Fresh                                     | Create empty usable workspace               | Working with default categories and real-workspace safety backup              | PARTIAL | Integration/Playwright                        | Selective reset options and Plaid-aware scope remain open              |
| Settings     | Demo reset                                      | Restore synthetic workspace only            | Guarded by DEMO identity                                                      | WORKING | Integration/Playwright                        | Retained                                                               |

## Architecture and security findings

- SQLite remains the sole local ledger truth. CSV and Plaid use the same `Account`, `Transaction`,
  merchant-rule, transfer, recurring, forecast, summary, and audit boundaries.
- Plaid secrets are server-only. Access tokens use authenticated encryption with a key stored outside
  SQLite. Browser DTOs exclude secrets, tokens, provider IDs, workspace IDs, and database paths.
- The initial local integration uses explicit synchronization. No background scheduler exists. A
  public webhook/tunnel is optional for Sandbox and recommended before unattended production use.
- Sandbox operations are rejected in REAL workspaces. Production Link is locked unless the active
  workspace is REAL and an explicit local environment gate is enabled.
- `security:scan` scans tracked files for Plaid secrets/access tokens. It complements `.gitignore`;
  it does not replace operating-system storage protection.
- A tracked reconciliation script writes an ignored, machine-verifiable aggregate report and avoids
  merchant descriptions, account names, filenames, and raw provider identifiers.

## Real-data reconciliation baseline

- The SQLite integrity check passed. All 1,603 current CSV-import transactions reconcile exactly to
  their retained source rows; all account, amount, date, description, original-text, and source-row
  mismatch counts are zero.
- The retained import history contains 3,434 source rows across 21 batches: 10 imported, 9 undone,
  and 2 validated but not imported. Historical undone rows total 1,762 and staged rows total 69.
- The source inventory found all 10 expected hashes. Seven additional OneDrive placeholders were
  unreadable locally and were not treated as evidence of missing imported sources.
- The REAL workspace has no Plaid items or Plaid transactions. Its five account balances remain
  `LIMITED` confidence, so household totals are not promoted as authoritative.
- Verified backups created before and after the additive migration passed manifest, hash, schema,
  and SQLite integrity checks. Neither backup is tracked by Git.

## Current release blockers

- Plaid Sandbox Link has not completed its end-to-end acceptance run because Sandbox variables are
  not configured in an isolated workspace. Isolated persistence tests cover idempotent additions,
  modifications, removals, pending-to-posted reuse, exact CSV reconciliation, and balance refresh.
- The REAL dataset currently has limited balance confidence and no new interpretation provenance;
  existing CSV records predate the new provider interpretation pipeline.
- The exception workload remains too high to meet “review by exception.” Merchant/category learning,
  payroll drilldown, automatic high-confidence transfer confirmation, and cross-source recurring
  reconciliation require further implementation and isolated real-data replay.
- Selective Start Fresh variants and Plaid-aware backup/reset UI are not complete.
- The focused Playwright run for the new theme/dead-control assertions currently stalls before test
  output in this Windows environment. The Chrome render audit passed, but the isolated Playwright
  harness must be diagnosed before those assertions count as automated acceptance evidence.
