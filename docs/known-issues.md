# Known Issues

- Financial engines are not implemented; UI values are synthetic demonstration data.
- Settings form persists in browser local storage; the Prisma-backed household API exists but is not yet connected to the form.
- Account and category management screens show Phase 1 review surfaces; full create/edit/delete workflows are planned.
- Goals and transaction normalized-value editing are demonstration-only and do not persist.
- Transaction import is not implemented.
- Base44 screenshots were used as static references; exact pixel values are estimated.
- Report Print, CSV, and HTML export controls are disabled because export is not implemented.
- Demo reset is available only through `npm run db:reset`; the in-app reset action is disabled until user-data/demo-data separation is safer.
- `npm audit` and `npm audit --omit=dev` report a moderate Next.js/PostCSS advisory. The reported fix is a semver-major downgrade to `next@9.3.3`, so it was not applied.
