<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Financial Compass Agent Rules

## Operating Behavior

- Inspect repository structure, Git status, relevant docs, schema, routes, services, tests, and recent commits before substantial changes.
- Preserve unrelated work and never rewrite, squash, amend, reset, or discard user changes unless explicitly requested.
- Keep scope narrow. Do not begin CSV import, bank connectivity, investment advice, tax advice, or unrelated redesign work without explicit approval.
- Keep commits coherent, conventional, and reviewable. Update `docs/change-ledger.md` for meaningful product, architecture, schema, calculation, persistence, or design changes.
- Stop and report if required data, credentials, legal/financial judgment, or destructive ambiguity blocks safe progress.

## Financial Correctness

- Store money as integer minor units with currency stored separately. Never use JavaScript floating-point arithmetic for persisted money calculations.
- Preserve original transaction import fields. Normalization, categorization, notes, review status, and exclusion are editable; original description, original amount text, original date text, parsed amount, account, and posted/transaction dates require separate reviewed contracts.
- CSV imports must stage rows, validate mappings, preserve source fields, detect duplicate candidates, require explicit confirmation, and link created transactions to import batches and rows. Do not silently discard duplicate candidates or overwrite original imported values.
- Import undo must only affect transactions created by the selected batch, record audit history, and block when imported transactions were materially edited.
- Transfers, credit-card payments, refunds, reversals, and split transactions must not be inferred silently. Preserve source records and add explicit modeled relationships only with tests.
- Safe-to-save, cash-flow forecasting, debt payoff, recurring detection, and decision scenarios must remain labeled demonstration-only until validated engines and tests exist.
- Debt calculations must use APR basis points, minimum payments, due dates, and explicit assumptions. Do not present estimates as advice.

## Data Integrity And Auditability

- SQLite is the source of truth for household financial configuration and Phase 1 domain records. Browser local storage is limited to non-financial UI preferences such as navigation state.
- Material manual changes must create audit records with entity type, entity id, action, field, previous value, new value, timestamp, source, and optional reason.
- Archive records instead of deleting when history may depend on them. Archiving accounts or categories must not delete transactions.
- Migrations must be additive unless a destructive migration is explicitly approved and documented. Do not edit already-applied migrations.
- Destructive operations, including demo reset, must require confirmation, run server-side, and document scope.

## Privacy And Security

- Keep the app local-first. Normal local development must not require Docker, remote services, telemetry, analytics, or bank connectivity.
- Never request, store, log, or commit bank credentials, card PINs, MFA secrets, security-question answers, complete payment-card numbers, real account identifiers, statements, `.env` files, SQLite databases, backups, imports, exports, tokens, or secrets.
- Use synthetic demonstration data only. Do not commit real CSV, OFX, QFX, QBO, PDF statement, export, or backup files.
- Do not permanently store raw uploaded CSV files. Store only bounded row fields and metadata required for traceability.
- Logs and audit records must avoid secrets and unnecessary complete object snapshots.

## Engineering

- Use Next.js App Router, React, strict TypeScript, Tailwind CSS, Prisma, SQLite, Zod, Vitest, and Playwright.
- Use route handlers or server actions, application services, repositories, Prisma, and domain calculations with clear boundaries. Do not access Prisma directly from arbitrary client components.
- Use Zod validation for writes and return structured validation errors for invalid input, not found, archived edits, foreign-key mismatches, invalid dates, invalid minor units, invalid account/category relationships, and conflicting actions.
- Prefer repository-derived screen data over scattered page constants for persisted domains.
- Keep approved Base44-derived design and collapsible navigation unless the task explicitly asks for redesign.

## Testing And Definition Of Done

- Add tests proportional to financial risk: unit tests for money and calculations, integration tests for persistence contracts/audit/original-value preservation, and Playwright tests for critical workflows.
- Required validation for substantial work: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, relevant `npm run test:e2e`, `npm run build`, and dependency audit when requested.
- A feature is not done until persistence, reload/restart behavior, validation errors, audit behavior, docs, and change ledger entries match the implemented behavior.

## Final Reporting

- Report what changed, what persists, what remains demonstration-only, tests run, audit/dependency findings, commits created, and whether CSV/import work remains blocked.
