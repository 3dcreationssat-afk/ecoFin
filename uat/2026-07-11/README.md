# Financial Compass UAT Package

Contains screenshots, detailed findings, and a focused Codex correction prompt.

Recommended extraction path:

`uat/2026-07-11/`

The actual downloaded backup ZIP is intentionally excluded because it contains sensitive, unencrypted SQLite financial data.

Some screenshots contain real-looking imported transaction descriptions and names. Keep this package private.

## Artifact handling

- `README.md`, `FINDINGS.md`, `CODEX_PROMPT.md`, `FOLLOWUP.md`, and `SCREENSHOT_INVENTORY.md` are safe to commit.
- `screens/` is sensitive and intentionally ignored by git.
- `manifest.json` is generated screenshot metadata and intentionally ignored by git.

Private screenshots remain stored locally at:

`uat/2026-07-11/screens/`

If the screenshots are moved, keep them in a private local or encrypted evidence store. Do not commit screenshots that contain personal names, transaction descriptions, account details, or financial amounts.
