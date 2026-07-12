# Scheduled Obligations

Obligations persist integer amount, cadence, next due date, type, essentiality, confidence, and optional account/category/recurring/debt/goal links. Definitions do not mutate when one month is paid.

Occurrences support Upcoming, Paid, Skipped, Overdue, and Partially Paid. One transaction can satisfy only one planning occurrence. Precedence is satisfied occurrence, explicit obligation, debt minimum, confirmed recurring record, then forecast candidate. Explicit links suppress fallbacks to prevent duplication.
