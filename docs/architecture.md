# Architecture

## Implemented

- Next.js App Router renders local application screens.
- React client components handle interactive shell, transaction drawer, charts, and settings local-storage persistence.
- Prisma models represent households, accounts, and categories in SQLite.
- API routes under `src/app/api/` expose local CRUD foundations for Phase 1 domain records.
- Zod validates household, account, and category writes.
- Desktop navigation collapse preference and the Phase 1 household settings form use browser local storage.
- The navigation preference is stored as `financial-compass-nav=expanded|collapsed`; missing or cleared preference defaults to expanded.
- The app shell reads the navigation preference with `useSyncExternalStore` and a server snapshot of expanded to avoid Next.js hydration mismatches.
- Tablet and mobile navigation use a client-only drawer state and do not write financial data to browser storage.
- `npm run db:migrate` applies the committed SQLite SQL migration through `prisma db execute`.
- `npm run db:reset` refuses non-`file:` URLs, refuses SQLite files outside `prisma/`, recreates schema, and seeds synthetic data.

## Planned

- Transaction import and normalization services.
- Financial calculation services with tests before production use.
- Backup and restore services for local data.
- UI forms for accounts, categories, goals, and transactions connected to the Prisma data layer.
