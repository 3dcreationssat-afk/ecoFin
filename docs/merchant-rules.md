# Merchant Rules

Merchant rules are local SQLite records that deterministically normalize future CSV imports. A rule has a household, unique case-insensitive name, priority, active/archive state, match field/type/pattern, optional normalized merchant/category/safe transaction type, review behavior, notes, and last-applied time.

Matching trims text, collapses whitespace, and ignores case. Supported match types are exact, contains, starts with, and ends with. Regular expressions are intentionally unsupported. Rules sort by ascending priority, then exact over starts/ends-with over contains, then creation time and ID. The first matching rule wins. Preview reports conflicts when matching rules propose different outputs.

Precedence is immutable source values, confirmed transfer/recurring protections, explicit user or bulk-user values, merchant rules, import defaults, then fallback values. Per-field provenance (`merchantSource`, `categorySource`, `typeSource`, and `reviewSource`) prevents a rule from silently replacing later manual corrections. Rules never change original description, amount text, date text, account, source row, or import provenance and cannot create confirmed transfers.

Saving future-only does not rewrite history. “Save and apply eligible history” is a separate confirmed operation. Reapply from Transactions operates only on explicit selected IDs, at most 100. Protected matches are skipped and summarized. Import applies active rules after source preservation and before transfer and recurring scans; the batch summary records matched and conflicting rule counts.

Start Fresh and demonstration reset remove rules and seed none. Backup/restore includes rules and validates the table/count under the current schema fingerprint. Rules store bounded patterns and actions, not transaction snapshots or credentials.
