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
