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
- The user has authorized controlled restarts of this repository's local development server when
  needed for verification. Identify the repo-owned listener before stopping it, preserve the
  configured database/workspace environment, announce the temporary interruption, restart it in
  the background, and verify localhost responds afterward. This authorization does not extend to
  unrelated processes, database resets, or other destructive actions.

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
- Backup restore must require explicit confirmation, validate manifest/hash/schema/SQLite integrity before replacement, create a pre-restore safety backup, and preserve an automatic rollback path.

## Privacy And Security

- Keep the app local-first. Normal local development must not require Docker, remote services, telemetry, analytics, or bank connectivity.
- Never request, store, log, or commit bank credentials, card PINs, MFA secrets, security-question answers, complete payment-card numbers, real account identifiers, statements, `.env` files, SQLite databases, backups, imports, exports, tokens, or secrets.
- Use synthetic demonstration data only. Do not commit real CSV, OFX, QFX, QBO, PDF statement, export, or backup files.
- Do not permanently store raw uploaded CSV files. Store only bounded row fields and metadata required for traceability.
- Backup ZIP files contain complete unencrypted SQLite financial data and must stay local, ignored, and out of commits.
- Logs and audit records must avoid secrets and unnecessary complete object snapshots.

## Engineering

- Use Next.js App Router, React, strict TypeScript, Tailwind CSS, Prisma, SQLite, Zod, Vitest, and Playwright.
- Use the Node.js 22 LTS line for local development. Keep the installed patch at `22.22.0` or
  newer so Codex browser tooling can run; do not change Node major versions without explicit
  approval. Verify `node --version` and `npm --version` after runtime upgrades.
- Use route handlers or server actions, application services, repositories, Prisma, and domain calculations with clear boundaries. Do not access Prisma directly from arbitrary client components.
- Use Zod validation for writes and return structured validation errors for invalid input, not found, archived edits, foreign-key mismatches, invalid dates, invalid minor units, invalid account/category relationships, and conflicting actions.
- Prefer repository-derived screen data over scattered page constants for persisted domains.
- Keep approved Base44-derived design and collapsible navigation unless the task explicitly asks for redesign.

## Local Browser Verification

- The repository development server is expected at `http://127.0.0.1:3000` or
  `http://localhost:3000`. Confirm the repo-owned listener and an HTTP success response before
  browser verification.
- When the Chrome control skill is available and connected, use it for rendered UI audits and
  interactive localhost verification. Restrict inspection and control to Financial Compass tabs;
  do not inspect, claim, or disclose unrelated browser tabs, history, or signed-in sessions. If
  tab discovery is required, filter immediately for the localhost Financial Compass target and do
  not emit unrelated tab metadata.
- Browser access to the real workspace is read-only by default. Do not submit forms or trigger
  imports, resets, restores, Plaid actions, account changes, transaction decisions, or other
  financial mutations unless the current task explicitly authorizes that action.
- Use the repository's Playwright suite for repeatable regression coverage and whenever Chrome
  control is unavailable. Keep automated tests isolated from the real database and real Plaid
  credentials.

## Testing And Definition Of Done

- Add tests proportional to financial risk: unit tests for money and calculations, integration tests for persistence contracts/audit/original-value preservation, and Playwright tests for critical workflows.
- Required validation for substantial work: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, relevant `npm run test:e2e`, `npm run build`, and dependency audit when requested.
- A feature is not done until persistence, reload/restart behavior, validation errors, audit behavior, docs, and change ledger entries match the implemented behavior.

## Final Reporting

- Report what changed, what persists, what remains demonstration-only, tests run, audit/dependency findings, commits created, and whether CSV/import work remains blocked.
