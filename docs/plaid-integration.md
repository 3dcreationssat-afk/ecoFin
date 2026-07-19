# Plaid Integration

## Initial scope

Financial Compass initializes only Plaid Transactions. Balance metadata is available with that
connection and does not require a separate Link product. Auth, Identity, Liabilities, Investments,
Assets, and Plaid Income are intentionally disabled until a concrete product workflow requires
them.

The official `plaid` Node SDK runs only in `src/server/plaid/`. The browser receives a short-lived
Link token and sends the one-time public token to a local route handler. Plaid client secrets and
access tokens never enter client component props or browser bundles.

## Exact Windows setup

Plaid is currently unconfigured when any required variable below is absent. Never paste real
values into chat. In PowerShell, from the repository root, create or edit the local, untracked file
`.env.local` and use this placeholder-only shape:

```dotenv
PLAID_ENV="production"
PLAID_CLIENT_ID="<YOUR_PLAID_CLIENT_ID>"
PLAID_SECRET="<YOUR_MATCHING_PRODUCTION_SECRET>"
PLAID_TOKEN_ENCRYPTION_KEY="<BASE64_32_BYTE_KEY>"
PLAID_REDIRECT_URI="https://<YOUR_PUBLIC_HOST>/plaid-oauth"
PLAID_WEBHOOK_URL="https://<YOUR_PUBLIC_HOST>/api/plaid/webhook"
```

Only the first four variables are required. The redirect and webhook variables are optional for a
desktop, manual-sync connection. Do not set empty optional variables unless you intend to configure
them. Verify that Git ignores the secret file:

```powershell
git check-ignore -v .env.local
```

The output must identify an `.env*.local` ignore rule. Generate the independent encryption key in
PowerShell (run once, copy the displayed value into `.env.local`, and clear terminal history if your
local policy requires it):

```powershell
$keyBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($keyBytes)
[Convert]::ToBase64String($keyBytes)
```

This key must remain stable across restarts and restores. It is not a Plaid credential and is not
stored in SQLite or backup ZIPs. If it changes or is lost, existing encrypted access tokens cannot
be decrypted. Restore the original key or reconnect each institution; do not delete local history
to work around the problem. Store a protected recovery copy separately from both the database and
backup ZIP files.

Next.js reads `.env.local` at process startup. After every configuration change, stop the
repository-owned development process and restart it with:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open **Settings → Plaid**. The page reports presence only, validates the encryption key locally,
and provides **Test Plaid configuration**. That server-side test calls Plaid's institutions API; it
does not open Link, create an Item, return a secret, or change financial records.

## Plaid Dashboard checklist

Before production use, confirm all of the following in the Plaid Dashboard:

1. The application name and consumer-facing branding are complete.
2. The declared use case accurately describes household financial aggregation and analysis.
3. **Transactions** is enabled. Balance metadata is retrieved with the connected Item; this app
   does not request Auth, Identity, Income, Investments, Liabilities, Assets, or payment products.
4. The supported country includes the United States (`US`).
5. The Production credential pair is used with `PLAID_ENV="production"`; Sandbox and Production
   Items and secrets are not interchangeable.
6. The account has Limited Production/Trial or full Production access to Transactions. The Plaid
   API does not expose the Dashboard's commercial tier, so a successful configuration test proves
   credential validity and reachability—not billing status, institution approval, or Item limits.
7. Any required organization, application, compliance, approval, and billing steps are complete.
8. If a redirect URI is set, the exact URI is in **Allowed redirect URIs**. Production redirect
   URIs use HTTPS and contain no fragment or extra query string.
9. OAuth registration is complete for any institution that requires it. Limited Production can
   restrict major OAuth institutions until full Production access and OAuth registration are done.
10. If webhooks are used, the URL is public HTTPS and routes to an implemented receiver. This app
    currently supports safe manual **Sync now** operation, so leave `PLAID_WEBHOOK_URL` unset until
    a receiver is deployed.

Plaid documents only Sandbox and Production API hosts. Current access tiers and limits are managed
in the Dashboard. See Plaid's [Sandbox and Limited Production overview](https://plaid.com/docs/sandbox/),
[API environments](https://plaid.com/docs/api/), and [OAuth redirect rules](https://plaid.com/docs/link/oauth/).

## Deliberate real-data enablement

Real connectivity defaults off in SQLite, independently of credential presence. To enable it:

1. Use a protected REAL workspace and create/validate a local backup.
2. Configure `PLAID_ENV="production"` with the matching credential pair and stable encryption key.
3. Restart the app and run **Settings → Plaid → Test Plaid configuration** successfully.
4. Confirm real Transactions access, institution availability, approvals, and billing in the
   Dashboard.
5. Check the Dashboard confirmation, type `ENABLE REAL PLAID`, and enable the gate.
6. Go to Accounts and explicitly launch Plaid Link. Enabling the gate alone never connects an
   institution.

Disable the gate at any time from Settings. This prevents new production Link operations but does
not revoke already connected Items. Disconnect an Item from Accounts to request provider-side
revocation and remove the local encrypted token. Sandbox remains restricted to DEMO/TEST
workspaces, and Production remains restricted to a REAL workspace. Automated tests always use an
isolated TEST database and never silently fall back between Plaid environments.

To change environments safely: disconnect Items in the old environment, disable the gate, stop the
app, change both `PLAID_ENV` and its matching secret, restart, test configuration, and enable the
gate only if production access is intended. Items and access tokens cannot move between Plaid
environments.

## Localhost, OAuth, webhooks, and polling

- Desktop non-OAuth Link can run from localhost; a public tunnel is not inherently required.
- Plaid allows HTTP localhost redirect URIs only in Sandbox. Production redirect URIs must use
  HTTPS and be allowlisted. Desktop web OAuth may use a popup without a redirect URI, but a public
  HTTPS redirect is the robust choice and is required for embedded/mobile-web redirect flows.
- A public webhook is optional for this manual-sync local app. It is recommended before relying on
  unattended updates. Until a verified receiver exists, use the visible **Sync now** action.
- Scheduled polling is not implemented. The user-triggered sync uses `/transactions/sync` and the
  persisted cursor.

## Status meanings and troubleshooting

- **CREDENTIALS MISSING**: add the named variables to `.env.local`, then restart.
- **ENCRYPTION INVALID**: generate a base64-encoded 32-byte key. If Items already exist, recover the
  original key instead of replacing it.
- **CONFIGURATION NOT TESTED**: run the safe server-side test.
- **CREDENTIALS INVALID OR UNREACHABLE**: `INVALID_CREDENTIALS_OR_ENVIRONMENT` means the credential
  pair and `PLAID_ENV` likely do not match; `NETWORK_FAILURE` means no Plaid response arrived.
- **SANDBOX ONLY**: the selected host supports test Items only; never treat this as real-data access.
- **REAL ACCESS CONFIRMATION REQUIRED**: credentials work, but Dashboard tier, approval, billing,
  and institution access must be confirmed by the user.
- **REAL CONNECTIVITY ENABLED**: the local gate is open; Plaid Link still requires an explicit user
  action and authentication.
- **Institution error**: use the bounded code shown on the connected Item and retry Sync; Plaid
  outages may be checked at `status.plaid.com`.
- **REAUTHENTICATION REQUIRED**: launch the account's update-mode Link flow. The app never requests
  or stores institution credentials.
- **OAuth failure**: verify the exact allowlisted HTTPS redirect, environment, popup behavior, and
  institution registration. An `ACCESS_NOT_GRANTED` response means the Item lacks the requested
  product/account permission.

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
