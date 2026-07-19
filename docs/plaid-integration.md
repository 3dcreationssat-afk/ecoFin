# Plaid Integration

## Initial scope

Financial Compass initializes only Plaid Transactions. Balance metadata is available with that
connection and does not require a separate Link product. Auth, Identity, Liabilities, Investments,
Assets, and Plaid Income are intentionally disabled until a concrete product workflow requires
them.

The official `plaid` Node SDK runs only in `src/server/plaid/`. The browser receives a short-lived
Link token and sends the one-time public token to a local route handler. Plaid client secrets and
access tokens never enter client component props or browser bundles.

## Local configuration

Copy the variable names from `.env.example` into ignored `.env.local`. Keep values out of source,
chat, screenshots, logs, fixtures, and documentation.

- `PLAID_ENV` is `sandbox` or `production`.
- `PLAID_CLIENT_ID` and `PLAID_SECRET` come from the matching Plaid environment.
- `PLAID_TOKEN_ENCRYPTION_KEY` is a base64-encoded 32-byte random key stored separately from the
  database and its backups.
- `PLAID_REDIRECT_URI` is optional for desktop Sandbox. Sandbox allows HTTP localhost redirects;
  production OAuth redirects require HTTPS.
- `PLAID_WEBHOOK_URL` is optional. Without it, the local app uses explicit **Sync now** polling.
- `PLAID_REAL_CONNECTIONS_ENABLED` remains `false` until isolated Sandbox acceptance passes.

Sandbox operations are rejected for a REAL workspace. Production connections are rejected unless
the workspace is REAL and the explicit production lock is enabled. Automated tests use an isolated
TEST database and must not receive real Plaid variables.

## Token and backup security

Access tokens are encrypted with AES-256-GCM before SQLite persistence. Each token uses a fresh
96-bit nonce and authentication tag. The encryption key is never stored in SQLite. Local backup ZIP
files therefore contain encrypted token envelopes, not plaintext access tokens. Restore requires
the corresponding local encryption key for a connection to remain usable. Losing the key requires
disconnecting/relinking; storing the key beside backup ZIP files defeats this separation.

Disconnect calls Plaid Item removal first, then deletes the local encrypted token and sync cursor.
Normalized transaction history and provenance remain available for audit. Errors persist only a
bounded Plaid error code and display message; raw provider responses are not logged or stored.

## Synchronization and coexistence

`/transactions/sync` cursors are stored per Item. All pages are collected before one SQLite
transaction applies added, modified, and removed records and advances the cursor. A lock prevents
concurrent sync runs. Provider transaction IDs make repeated syncs idempotent.

- Added records retain normalized Plaid provenance and create ledger transactions only after the
  connected account has a local account match.
- Explicit pending-to-posted relationships reuse one ledger transaction.
- Modifications update provider-owned fields while preserving user-owned classification fields.
- Removals retain the record, disable its ledger/report impact, and create audit history.
- CSV overlap is auto-reconciled only for one unique candidate with the same local account, exact
  minor-unit amount, normalized merchant, and a posted date within two days. Otherwise both records
  remain available for review.

No public webhook or tunnel is required for the initial local-only release. A webhook is recommended
before relying on unattended production updates. On-demand Transactions Refresh is not enabled.
