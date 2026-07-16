# Expected Income

Expected income uses a durable canonical forecast rule. Explicit rules support one-time, weekly,
biweekly, twice-monthly, monthly, quarterly, and annual cadence with an optional account link.
Historical schedules remain migration provenance, not a second projection source.

Payroll detection groups eligible positive deposits by account and normalized merchant, requires at
least three occurrences, measures cadence and amount stability, and excludes transfers, refunds,
reimbursements, bonuses, cash deposits, tax refunds, investment activity, and other non-payroll-like
credits. Detected rules require confirmation before entering the Confirmed scenario.

Only occurrence exceptions are persisted: Skipped, Changed, Cancelled, or Matched. A transaction can
match at most one occurrence; account, direction, merchant, amount, and date must agree within the
rule's tolerances. Ambiguous deposits are never silently matched.
