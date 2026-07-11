# Architecture

## Implemented

- Next.js App Router renders local application screens.
- React client components handle interactive shell, transaction drawer, charts, and persisted form workflows.
- Prisma models represent households, accounts, categories, goals, goal contributions, transactions, and audit logs in SQLite.
- API routes under `src/app/api/` expose local write foundations for Phase 1.5 domain records through repository/service modules.
- Zod validates household, account, category, goal, contribution, and transaction-normalization writes.
- SQLite is the source of truth for household financial configuration and Phase 1.5 domain records.
- Browser local storage is limited to non-financial UI preferences.
- The navigation preference is stored as `financial-compass-nav=expanded|collapsed`; missing or cleared preference defaults to expanded.
- The app shell reads the navigation preference with `useSyncExternalStore` and a server snapshot of expanded to avoid Next.js hydration mismatches.
- Tablet and mobile navigation use a client-only drawer state and do not write financial data to browser storage.
- `npm run db:migrate` applies the committed SQLite SQL migration through `prisma db execute`.
- `npm run db:reset` refuses non-`file:` URLs, refuses SQLite files outside `prisma/`, recreates schema, and seeds synthetic data.
- Original transaction import fields are stored separately from editable normalized fields.
- Material manual changes create field-level audit records without storing complete object snapshots.

## Planned

- Transaction import and normalization services.
- Financial calculation services with tests before production use.
- Backup and restore services for local data.
- Multi-household support and a safer production user-data/demo-data separation model.
