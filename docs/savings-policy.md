# Savings Recommendation Policy

The household selects Conservative, Balanced, Aggressive, or Custom preferences. Persisted inputs include target basis points of maximum surplus, minimum discretionary reserve, extra safety reserve, minimum cash retained, goal-contribution inclusion, emergency-shortfall preference, and conservative confidence adjustment.

Balanced defaults retain all known protections plus discretionary cash and recommend at most 50% of maximum surplus. The demo uses a $1,250 discretionary reserve and $500 extra safety reserve. This is planning support, not regulated financial advice.

`allocatable surplus = cash after obligations and protections - retained safety reserve`

`recommendation = target percentage of allocatable surplus`, capped to the allocatable amount.

Safe to Spend is allocatable surplus less the recommendation. Conservative Safe to Save reduces the recommendation when confidence is weaker and protects known unconfirmed expenses.

- Conservative caps the configured savings target at 35% of allocatable surplus.
- Balanced uses the configured target (50% by default).
- Aggressive floors the configured target at 75%.
- Custom uses the validated 0–100% target exactly.

All modes retain the configured discretionary, extra safety, and unmet minimum-cash reserves. High confidence makes Conservative Safe to Save equal Recommended. Moderate subtracts the configured confidence adjustment; Limited subtracts twice that percentage, capped at 100%. Known unconfirmed expenses are additionally protected.
