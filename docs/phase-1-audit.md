# Phase 1 Audit

## Executive Status

Complete with documented limitations.

The repository is safe to build on for Phase 1 foundation work. CSV import should not begin until the remaining blockers listed below are accepted or resolved.

## Repository Inspection

- Branch: `main`.
- Git baseline commits present: `19e2214`, `33ff203`, `a69b1fc`, `5693184`.
- Initial tracked status: clean after restoring generated `next-env.d.ts`.
- Ignored local files observed: `.next/`, `node_modules/`, `prisma/dev.db`, disposable audit databases, and `test-results/`.
- SQLite files observed: ignored local files under `prisma/` only.
- Secrets or real financial files: none found by filename scan for `.env`, database, statement, export, CSV, OFX, QFX, QBO, or PDF patterns. `.env.example` is committed and contains only a local SQLite example.
- Unexpected files: `design/enhancements/collapsible-navigation/` was untracked at audit start. It was reviewed and incorporated as supplemental navigation guidance.

## Requirements Matrix

| Requirement              | Status                    | Evidence                                                                | Test                                                                                         | Limitation                                                            | Follow-up                                    |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Governance               | Complete                  | `AGENTS.md`, README, docs reviewed                                      | `git log`, `git status`                                                                      | None                                                                  | Keep change ledger current                   |
| Package scripts          | Complete                  | All requested scripts exist                                             | `npm run format:check`, `lint`, `typecheck`, `test`, `test:e2e`, `build`; DB commands tested | `db:migrate` uses committed SQL via `prisma db execute`               | Revisit Prisma migrate engine later          |
| Type safety              | Complete                  | Strict TypeScript                                                       | `npm run typecheck` passed                                                                   | None                                                                  | Add more domain types with engines           |
| Formatting               | Complete                  | Prettier configured                                                     | `npm run format:check` passed                                                                | None                                                                  | None                                         |
| Database reproducibility | Complete                  | Disposable `prisma/audit-exec.db` initialized and reset                 | `db:generate`, `db:migrate`, `db:seed`, `db:reset`; counts `1/6/11`                          | Reset is CLI-only                                                     | Add in-app reset after data separation       |
| Local persistence        | Limited                   | SQLite API foundation; settings/nav local storage                       | E2E settings and nav persistence tests                                                       | Accounts/categories/goals/transactions UI persistence not implemented | Connect forms to Prisma before import        |
| UI fidelity              | Complete with limitations | Compared all Base44 screenshots and supplemental nav references         | 1440 screenshots captured under `test-results/phase-1-audit/`                                | Values and calculations are demo-only                                 | Continue visual QA as screens become dynamic |
| Responsive behavior      | Complete                  | 1440, 1280, 1024, 768, 390 route sweep                                  | All routes 200; no document overflow                                                         | Tables use horizontal internal scrolling                              | Add richer mobile table views later          |
| Accessibility            | Improved                  | Landmarks, tables, labels, drawer role, Escape close, disabled controls | Playwright drawer/mobile nav tests                                                           | Full automated a11y scan not added                                    | Add axe when scope justifies dependency      |
| Demo-data isolation      | Complete with limitation  | Demo data centralized in `src/data/demo.ts` and Prisma seed             | Seed/reset counts verified                                                                   | UI static demo values are separate from DB demo rows                  | Replace static demo reads with repositories  |
| Financial representation | Complete with limitations | Money helpers use integer minor units; APR basis points documented      | Money unit tests                                                                             | Static UI strings repeat formatted values                             | Centralize all display values with engines   |
| Security/privacy         | Complete with limitation  | `.gitignore`, docs, no telemetry/bank connectivity                      | filename scan, docs review                                                                   | Browser local storage for settings only                               | Move settings to SQLite                      |
| Dependency audit         | Complete with finding     | Prisma upgraded to `6.19.3`                                             | `npm audit`, `npm audit --omit=dev`                                                          | Moderate Next/PostCSS advisory remains                                | Track upstream safe fix                      |
| Documentation accuracy   | Complete                  | README rewritten; docs updated                                          | Review                                                                                       | Phase 1 limitations explicit                                          | Keep docs synced                             |
| Test adequacy            | Partial                   | Money, schema, drawer, settings, nav, disabled controls                 | Vitest 4 tests; Playwright 12 tests                                                          | Persistence workflows not covered because not implemented             | Add tests when workflows are implemented     |

## Screen Matrix

| Screen       | Visual Fidelity | Working Interactions                             | Persistence           | Demonstration-Only Behavior                    | Responsive Status | Accessibility Status                   |
| ------------ | --------------- | ------------------------------------------------ | --------------------- | ---------------------------------------------- | ----------------- | -------------------------------------- |
| Overview     | High            | Navigation links                                 | None                  | All financial values                           | Pass              | Headings and cards readable            |
| Transactions | High            | Filters visible; drawer opens/closes with Escape | None                  | Drawer edits not saved; original values static | Pass              | Dialog semantics added                 |
| Cash Flow    | High            | Chart renders                                    | None                  | Projection and Safe to Save values             | Pass              | Chart accompanied by textual metrics   |
| Budget       | High            | Planned Add disabled                             | None                  | Budget rows and status values                  | Pass              | Table headers present                  |
| Recurring    | High            | Table review only                                | None                  | Classification/recommendation values           | Pass              | Table headers present                  |
| Debt         | High            | Strategy controls disabled                       | None                  | Payoff strategy impact                         | Pass              | Disabled state communicates limitation |
| Goals        | High            | Contribution/Add disabled                        | None                  | Goal status and amounts                        | Pass              | Warning text is explicit               |
| Decisions    | High            | Scenario controls disabled/read-only             | None                  | Scenario comparison                            | Pass              | Isolated badge and labels present      |
| Reports      | High            | Export buttons disabled                          | None                  | Chart and metrics                              | Pass              | Report remains readable without export |
| Data Quality | High            | Static issue review                              | None                  | Confidence scores and issues                   | Pass              | Issues include impact/action text      |
| Accounts     | High            | Add disabled; refresh icon noninteractive        | None                  | Account rows and summaries                     | Pass              | Table headers present                  |
| Settings     | High            | Household settings edit in browser               | Browser local storage | Category groups static; reset disabled         | Pass              | Form labels present                    |

## Validation Results

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 2 files, 4 tests.
- `npm run test:e2e`: passed, 12 tests across Chromium desktop and mobile projects.
- `npm run build`: passed, all app routes built.
- Production server: `npm run start -- -H 127.0.0.1 -p 3100`; all 12 routes returned 200; no browser console warnings/errors.
- Development server: `npm run dev`; all 12 routes returned 200 at widths 1440, 1280, 1024, 768, and 390; no browser console warnings/errors; no document-level horizontal overflow.
- Screenshots captured: current implementation screenshots for all 12 routes at 1440px under ignored `test-results/phase-1-audit/`.

## Clean Database Reproducibility

Commands used with disposable `DATABASE_URL=file:./audit-exec.db`:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
node <count check>
npm run db:reset
node <count check>
```

Results:

- Migration SQL executed successfully.
- Seed executed successfully.
- Expected records after seed: `{"households":1,"accounts":6,"categories":11}`.
- Expected records after reset: `{"households":1,"accounts":6,"categories":11}`.
- SQLite database files remained ignored.

## Dependency Findings

| Package                                | Direct                              | Impact                                           | Severity | Finding                                                       | Remediation                                                                    |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `prisma` / `@prisma/config` / `effect` | `prisma` direct dev dependency      | Development tooling; also appeared in full audit | High     | `effect` AsyncLocalStorage advisory through Prisma config     | Applied safe upgrade to Prisma packages `6.19.3`                               |
| `next` / bundled `postcss`             | `next` direct production dependency | Production dependency                            | Moderate | PostCSS CSS stringify XSS advisory in bundled Next dependency | Not applied; npm offers semver-major downgrade to `next@9.3.3`, not a safe fix |

Current audit result:

- `npm audit`: 2 moderate vulnerabilities.
- `npm audit --omit=dev`: 2 moderate vulnerabilities.

## Remaining Blockers Before CSV Import

- UI account/category/goal/transaction persistence is not implemented.
- Transaction original and normalized values are not stored in SQLite.
- Demo UI values are static and not repository-derived.
- In-app demo reset is disabled until it can avoid future user-data loss.
- Moderate Next/PostCSS advisory remains unresolved pending a safe upstream remediation.
- Date, duration, and all formatted financial display strings are not fully centralized.
