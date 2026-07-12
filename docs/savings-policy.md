# Savings Recommendation Policy

The household selects Conservative, Balanced, Aggressive, or Custom preferences. Persisted inputs include target basis points of maximum surplus, minimum discretionary reserve, extra safety reserve, minimum cash retained, goal-contribution inclusion, emergency-shortfall preference, and conservative confidence adjustment.

Balanced defaults retain all known protections plus discretionary cash and recommend at most 50% of maximum surplus. The demo uses a $1,250 discretionary reserve and $500 extra safety reserve. This is planning support, not regulated financial advice.

`recommendation = min(maximum surplus - retained reserves, target percentage of maximum surplus)`

Safe to Spend is maximum surplus less the recommendation. Conservative Safe to Save reduces the recommendation when confidence is weaker and protects known unconfirmed expenses.
