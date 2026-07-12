# Safe to Save and Safe to Spend

Maximum surplus and policy recommendation are distinct. The recommendation is capped by the configured target after retained discretionary and safety reserves; it is not automatically the full surplus.

All money uses integer minor units:

`usable liquid cash + confirmed remaining income - confirmed obligations - debt minimums - remaining planned savings - checking-buffer shortfall - protected mapped emergency funds - explicit data-quality reserve = maximum available surplus`

Cash after obligations and protections is the upstream financial result. The retained safety reserve is subtracted once to produce allocatable surplus. Recommended Safe to Save is a policy share of allocatable surplus. Safe to Spend is the remaining allocatable surplus; unallocated surplus is shown explicitly and is normally zero. Negative upstream results are shortfalls.

For the canonical demo: `$18,093.58 - $1,750.00 = $16,343.58` allocatable. Balanced recommends `$8,171.79`, Safe to Spend is `$8,171.79`, and unallocated surplus is `$0.00`. Both identities reconcile to the cent.

The checking buffer is a combined household checking target. Emergency protection uses only an explicitly linked emergency-fund goal: its current protected amount is withheld from spendable cash, the target shortfall is shown separately, and its monthly goal plan is not deducted twice.

Reserves show known amounts such as reconciliation differences and duplicate candidates. Missing anchors, stale snapshots, incomplete imports, missing debt terms, unmapped emergency funds, unconfirmed recurring items, and mixed provenance lower deterministic confidence and provide remediation links. No blanket percentage or AI score is used.
