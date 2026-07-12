# Codex Prompt — UAT Correction Pass

Perform a focused correction pass based on `uat/2026-07-11/FINDINGS.md` and the screenshots in `uat/2026-07-11/screens/`.

Do not begin recurring detection, bank connectivity, AI, or advanced forecasting.

## Required work

1. Make Settings tabs functional and directly addressable.
2. Add a real Privacy section.
3. Remove SQLite and other developer-facing wording from normal UI.
4. Replace raw enums with friendly labels.
5. Add contextual help for household and category fields.
6. Separate Add/Edit Account workflows.
7. Make account fields conditional by account type.
8. Add a curated institution selector plus Other.
9. Separate Add/Edit Goal workflows.
10. Move contributions into a dedicated contribution workflow with history.
11. Add transaction pagination, bounded table scrolling, result counts, and working filters.
12. Make global/transaction search functional or remove it.
13. Add prominent exact-file repeat warnings before confirmation.
14. Distinguish repeated file, duplicate row, and possible duplicate transaction.
15. Improve transfer-review help, candidate comparison, eligibility filtering, and error feedback.
16. Ensure no visible button silently does nothing.

## Tests

Add coverage for:

- Settings tabs and Privacy
- Friendly labels/help
- Add/Edit account separation
- Account-type conditional fields
- Institution selector
- Add/Edit goal separation
- Contribution workflow
- Transaction pagination/search/filter URL state
- Large datasets
- Repeated-file warning and explicit override
- Transfer-match validation and feedback
- Accessibility and responsive behavior

## Validation

Run:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run db:reset`
- `npm run test:e2e`
- `npm run build`
- `npm audit`
- `npm audit --omit=dev`

Manually verify all findings against the supplied screenshots and produce a UAT follow-up matrix with:

- Finding
- Resolution
- Evidence
- Test
- Remaining limitation

Use coherent conventional commits. Do not rewrite history. Do not push unless explicitly requested.
