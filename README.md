# Financial Compass

Financial Compass is a private, local-first personal finance decision-support application for one household.

It helps a household understand income, spending, debts, safe savings capacity, recurring expenses, goals, and decision scenarios. It is not a bank, accounting platform, tax product, investment adviser, credit counselor, bill-payment service, credit-score estimator, or substitute for professional financial advice.

## Current Status

Phase 1 is complete with documented limitations.

Implemented:

- Next.js App Router application with strict TypeScript and Tailwind CSS.
- Responsive application shell with collapsible desktop navigation, mobile navigation drawer, compact header, local-data indicator, and demonstration-data labeling.
- Phase 1 demonstration screens for overview, transactions, transaction drawer, cash flow, Safe to Save explanation, budget, recurring expenses, debt, goals, decisions, reports, data quality, accounts, and settings.
- SQLite/Prisma schema for households, accounts, and categories.
- Committed SQLite migration SQL and deterministic local reset script.
- Zod-validated local API route foundations for household settings, accounts, and categories.
- Synthetic seed data for household, accounts, and categories.
- Vitest and Playwright validation.

Not implemented:

- CSV import, transfer matching, recurring detection, advanced debt planning, backup/restore, report export, and validated financial engines.
- Account/category/goal/transaction editing persistence from the UI.
- Transaction original/normalized value persistence.

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

`DATABASE_URL` defaults to `file:./dev.db` in `.env.example`. SQLite paths are resolved by Prisma relative to the `prisma/` directory.

## Package Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run start` starts the production server after `npm run build`.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test` runs Vitest unit tests.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run test:e2e` runs Playwright tests.
- `npm run format` formats source files with Prettier.
- `npm run format:check` verifies Prettier formatting.
- `npm run db:generate` generates Prisma Client.
- `npm run db:migrate` applies the committed SQLite SQL migration.
- `npm run db:seed` replaces contents of the target database with synthetic demonstration data.
- `npm run db:reset` deletes the target SQLite file under `prisma/`, recreates schema, and seeds synthetic data.
- `npm run db:studio` opens Prisma Studio.

Do not point `db:seed` or `db:reset` at any database containing personal financial data.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Data And Privacy

- The application is local-first.
- No direct bank connectivity, telemetry, analytics, ads, or external AI services are included.
- `.env`, SQLite database files, imports, exports, statements, backups, and secrets are ignored.
- Only synthetic demonstration data should be committed.
- Never store bank credentials, card PINs, MFA secrets, security-question answers, complete card numbers, real statements, or real account identifiers.

## Money Rules

- Monetary domain values use integer minor units.
- APR values in persisted demo records use basis points.
- Phase 1 UI financial values are demonstration values unless a document explicitly says otherwise.
- Validated Safe to Save, cash-flow, debt, goal, and scenario engines are planned but not implemented.

## Documentation

Key implementation records live in:

- `AGENTS.md`
- `docs/architecture.md`
- `docs/assumptions.md`
- `docs/calculations.md`
- `docs/change-ledger.md`
- `docs/design-decisions.md`
- `docs/design-system.md`
- `docs/import-format.md`
- `docs/known-issues.md`
- `docs/phase-1-audit.md`
- `docs/privacy-and-security.md`
