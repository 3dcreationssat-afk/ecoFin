# Financial Compass

Financial Compass is a private, local-first personal finance decision-support application for one household.

It helps a household understand income, spending, debts, recurring expenses, goals, data quality, and future decision tradeoffs. It is not a bank, accounting platform, tax product, investment adviser, credit counselor, bill-payment service, credit-score estimator, or substitute for professional financial advice.

## Current Status

Phase 2C explainable transfer matching is implemented on top of the completed Phase 2B backup and restore foundation.

Implemented:

- Next.js App Router application with strict TypeScript and Tailwind CSS.
- Responsive application shell with persistent collapsible desktop navigation and mobile/tablet drawer navigation.
- SQLite/Prisma source of truth for household settings, accounts, categories, goals, goal contributions, transactions, and audit records.
- Repository/service-backed API routes with Zod validation and structured errors.
- Persistent household settings, account management, category management, goal management/contributions, and transaction normalization edits.
- Immutable original transaction fields for normal drawer edits.
- Secure CSV transaction import with preview, explicit mapping, validation, duplicate review, reusable profiles, import-batch history, audit records, and safe batch undo.
- Local SQLite backup and restore with manifest validation, SHA-256 verification, mandatory pre-restore safety backup, rollback on failed restore, audit records, Settings UI, and CLI scripts.
- Explainable transfer detection, manual confirmation/rejection, manual matching, unmatching, credit-card payment handling, audit records, data-quality signals, and household reporting exclusion for confirmed transfers.
- Synthetic seed/reset flow for one local demo household.
- Repository-derived overview, accounts, transactions, goals, settings, and data-quality values.

Still planned:

- OFX/QFX/QBO/PDF imports, direct bank connectivity, Plaid/provider APIs, automatic recurring detection, automatic merchant rules, AI categorization, advanced debt planning, scheduled/encrypted/cloud backup, report export, and validated financial engines.
- Production-grade safe-to-save, cash-flow, budget forecast, debt payoff, recurring, and decision scenario engines.

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
- `npm run backup` creates a local backup package for the active SQLite database.
- `npm run backup:list` lists recent backup records.
- `npm run backup:validate -- <backup.zip>` validates a local backup package.
- `RESTORE_CONFIRMATION="RESTORE BACKUP" npm run restore -- <backup.zip>` restores a validated backup package after creating a safety backup.
- `npm run format` formats source files with Prettier.
- `npm run format:check` verifies Prettier formatting.
- `npm run db:generate` generates Prisma Client.
- `npm run db:migrate` applies all committed SQLite SQL migrations in order.
- `npm run db:seed` replaces contents of the target database with synthetic demonstration data.
- `npm run db:reset` deletes the target SQLite file under `prisma/`, recreates schema, and seeds synthetic data.
- `npm run db:studio` opens Prisma Studio.

Do not point `db:seed` or `db:reset` at any database containing personal financial data.

## Data And Privacy

- The application is local-first and single-household in the current implementation.
- SQLite is the source of truth for household financial configuration and persisted Phase 1 domain data.
- CSV import stores durable import batches, row-level validation state, and imported transaction links. The uploaded file contents are not permanently stored.
- Backup packages contain complete unencrypted SQLite financial data and are stored under `backups/local/`, which is ignored by Git.
- Browser local storage is limited to non-financial UI preferences such as navigation expanded/collapsed state.
- No direct bank connectivity, telemetry, analytics, ads, or external AI services are included.
- `.env`, SQLite database files, imports, exports, statements, backups, and secrets are ignored.
- Only synthetic demonstration data should be committed.
- Never store bank credentials, card PINs, MFA secrets, security-question answers, complete card numbers, real statements, or real account identifiers.

## Money Rules

- Monetary domain values use integer minor units.
- User-entered decimal strings are parsed centrally before persistence.
- CSV amounts support signed amount columns and separate debit/credit columns with explicit sign convention, decimal separator, and thousands separator.
- Confirmed transfers are directional transaction classifications: `TRANSFER_OUT` and `TRANSFER_IN`.
- Household income and spending exclude confirmed transfers; account activity still shows both transaction records.
- APR values use basis points, for example `2149` means `21.49%`.
- Demonstration-only financial screens remain labeled until validated engines exist.

## Demo Data And Backup Status

- Seed/reset creates one synthetic household with accounts, categories, goals, contribution records, transactions, audit records, and clears import batches/profiles.
- In-app demo reset requires the exact confirmation phrase `RESET DEMO DATA` and runs through a server-side reset service.
- In-app backup creation writes an application-controlled local ZIP package with `database.sqlite`, `manifest.json`, and `README.txt`.
- Restore requires validation, the exact phrase `RESTORE BACKUP`, and a mandatory pre-restore safety backup.
- Backup/restore includes transfer relationships and requires the current transfer schema fingerprint.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Documentation

Key implementation records live in:

- `AGENTS.md`
- `docs/architecture.md`
- `docs/assumptions.md`
- `docs/backup-and-restore.md`
- `docs/calculations.md`
- `docs/change-ledger.md`
- `docs/design-decisions.md`
- `docs/design-system.md`
- `docs/import-format.md`
- `docs/known-issues.md`
- `docs/phase-1-audit.md`
- `docs/privacy-and-security.md`
- `docs/transfer-matching.md`
