# Architecture

## Implemented

- Next.js App Router renders local application screens.
- React client components handle interactive shell, transaction drawer, charts, and settings local-storage persistence.
- Prisma models represent households, accounts, and categories in SQLite.
- API routes under `src/app/api/` expose local CRUD foundations for Phase 1 domain records.
- Zod validates household, account, and category writes.

## Planned

- Transaction import and normalization services.
- Financial calculation services with tests before production use.
- Backup and restore services for local data.

