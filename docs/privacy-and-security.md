# Privacy And Security

Financial Compass is local-first.

## Implemented

- No telemetry, analytics, ads, remote financial-data storage, or bank connectivity.
- SQLite is configured for local persistence.
- `.gitignore` excludes local databases, exports, imports, statements, backups, and environment files.
- Demonstration data is synthetic.
- Browser local storage is used only for UI preferences such as navigation state. Household financial settings are stored in SQLite.
- `npm run db:reset` is restricted to SQLite `file:` URLs under the repository `prisma/` directory.
- The in-app demonstration reset requires explicit confirmation and runs server-side against the synthetic single-household dataset.
- Audit records store field-level values for material manual changes and must not be used for secrets or complete object snapshots.

## Prohibited Data

Do not store bank usernames, bank passwords, card PINs, MFA secrets, security-question answers, complete payment-card numbers, real account identifiers, real statements, or secret tokens.

## Dependency Audit

As of the Phase 1 audit, the Prisma high-severity advisory was remediated by upgrading Prisma packages to `6.19.3`. A moderate Next/PostCSS advisory remains unresolved because npm only offers a semver-major downgrade path that is not a safe remediation for this app.
