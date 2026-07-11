# Financial Compass

Financial Compass is a private, local-first personal finance decision-support app for one household.

It helps a household understand cash in, spending, debts, safe savings capacity, safe spending capacity, recurring expenses, savings goals, debt payoff tradeoffs, and decision scenarios.

It is not a bank, accounting platform, tax product, investment adviser, credit counselor, bill-payment service, credit-score estimator, or substitute for professional financial advice.

## Implemented In This Release

- Next.js App Router application with strict TypeScript and Tailwind CSS.
- Screenshot-inspired responsive application shell with persistent navigation, compact header, local-data indicator, and demonstration-data labeling.
- High-fidelity Phase 1 screens for overview, transactions, transaction detail drawer, cash flow, Safe to Save explanation, budget, recurring expenses, debt, goals, decisions, reports, data quality, accounts, and settings.
- SQLite/Prisma schema for households, accounts, and categories.
- Zod-validated local API routes for household settings, accounts, and categories.
- Synthetic seed data only.
- Vitest and Playwright configuration with initial tests.

## Planned Later

- Transaction import, normalization, merchant rules, duplicate detection, and audit history.
- Validated cash-flow, Safe to Save, debt-payoff, goal, and decision engines.
- Backup/export workflows for local data.

## Local Development

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run test
npm run build
```

Playwright tests use:

```bash
npm run test:e2e
```
