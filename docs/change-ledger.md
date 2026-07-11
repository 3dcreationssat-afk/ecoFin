# Change Ledger

## 2026-07-11

- Initialized Financial Compass as a Next.js, TypeScript, Tailwind, Prisma, SQLite application.
- Added governance files and local-first privacy rules.
- Added Prisma schema and synthetic seed data for households, accounts, and categories.
- Added screenshot-inspired app shell and Phase 1 demonstration screens.
- Added local API route foundations for household settings, accounts, and categories.
- Added Vitest, Playwright, ESLint, and Prettier configuration.
- Added Phase 1 audit corrections: required package scripts, committed SQLite migration SQL, deterministic local database reset, disabled planned controls, collapsible desktop navigation, mobile navigation drawer, drawer Escape handling, stronger e2e tests, and dependency audit documentation.
- Upgraded Prisma packages to `6.19.3` to remediate the high-severity transitive `effect` advisory.
- Refined the collapsible navigation enhancement with reusable shell pieces, visible collapsed-state tooltips, focus-return drawer behavior, backdrop close, non-color active markers, and responsive shell tests.
- Restored expanded governance guardrails and README product scope for Phase 1.5.
- Added SQLite-backed household settings, account, category, goal, contribution, transaction, audit, and demo reset persistence foundations.
- Added repository-derived overview, account, transaction, goal, settings, and data-quality screen data.
- Added tests for money parsing, summaries, data-quality rules, repository persistence, audit records, goal contributions, and original transaction preservation.
