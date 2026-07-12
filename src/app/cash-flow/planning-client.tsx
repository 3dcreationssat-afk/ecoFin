"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Pill } from "@/components/data-display/primitives";
import { formatMoney, parseMoneyToMinor } from "@/domain/money/money";
type Occ = {
  id: string;
  expectedDate: Date | string;
  expectedAmountMinor: number;
  status: string;
  amountDifferenceMinor: number;
};
type Income = {
  id: string;
  name: string;
  amountMinor: number;
  frequency: string;
  nextExpectedDate: Date | string;
  active: boolean;
  archivedAt: Date | string | null;
  confidence: string;
  occurrences: Occ[];
};
type Obligation = {
  id: string;
  name: string;
  amountMinor: number;
  frequency: string;
  dueDate: Date | string;
  active: boolean;
  archivedAt: Date | string | null;
  confidence: string;
  obligationType: string;
  occurrences: Occ[];
};
type Policy = {
  savingsRecommendationMode: string;
  savingsTargetBps: number;
  minimumDiscretionaryReserveMinor: number;
  extraSafetyReserveMinor: number;
  minimumCashRetainedMinor: number;
  includeGoalContributionsInSafeToSave: boolean;
  emergencyShortfallIncreasesRecommendation: boolean;
  conservativeConfidenceAdjustmentBps: number;
};
const money = (value: string) => parseMoneyToMinor(value);
export function PlanningClient({
  householdId,
  incomes,
  obligations,
  policy,
  suggestions,
}: {
  householdId: string;
  incomes: Income[];
  obligations: Obligation[];
  policy: Policy;
  suggestions: {
    kind: "income" | "obligation";
    occurrenceId: string;
    transactionId: string;
    label: string;
    confidence: string;
    amountDifferenceMinor: number;
    dateDifferenceDays: number;
  }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [incomeEdit, setIncomeEdit] = useState<string | null>(null);
  const [obligationEdit, setObligationEdit] = useState<string | null>(null);
  async function send(url: string, method: string, body: unknown) {
    setMessage("");
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Action failed.");
      return false;
    }
    setMessage("Saved.");
    router.refresh();
    return true;
  }
  async function submitIncome(form: FormData) {
    const payload = {
      householdId,
      name: String(form.get("name")),
      amountMinor: money(String(form.get("amount"))),
      frequency: String(form.get("frequency")),
      nextExpectedDate: String(form.get("date")),
      sourceType: "USER_ENTERED",
      confidence: "HIGH",
      active: true,
    };
    const ok = await send(
      incomeEdit ? `/api/planning/income/${incomeEdit}` : "/api/planning/income",
      incomeEdit ? "PATCH" : "POST",
      payload,
    );
    if (ok) setIncomeEdit(null);
  }
  async function submitObligation(form: FormData) {
    const payload = {
      householdId,
      name: String(form.get("name")),
      amountMinor: money(String(form.get("amount"))),
      frequency: String(form.get("frequency")),
      dueDate: String(form.get("date")),
      obligationType: String(form.get("type")),
      sourceType: "USER_ENTERED",
      essentiality: "ESSENTIAL",
      confidence: "HIGH",
      active: true,
    };
    const ok = await send(
      obligationEdit ? `/api/planning/obligations/${obligationEdit}` : "/api/planning/obligations",
      obligationEdit ? "PATCH" : "POST",
      payload,
    );
    if (ok) setObligationEdit(null);
  }
  const activeIncome = incomes.filter((i) => !i.archivedAt),
    activeObligations = obligations.filter((i) => !i.archivedAt);
  const allOccurrences = activeObligations.flatMap((o) =>
    o.occurrences.map((x) => ({ ...x, name: o.name })),
  );
  const paid = allOccurrences.filter((o) => ["PAID", "PARTIALLY_PAID"].includes(o.status)),
    overdue = allOccurrences.filter(
      (o) => o.status === "UPCOMING" && new Date(o.expectedDate) < new Date(),
    );
  return (
    <div className="mt-7 space-y-7" id="planning-inputs">
      {message ? (
        <div role="status" className="rounded-md bg-amber-50 p-3 text-sm">
          {message}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Expected Income</h2>
          <p className="text-sm text-[var(--muted)]">
            Explicit schedules only; received occurrences stop forecasting.
          </p>
          <form action={submitIncome} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              aria-label="Income name"
              placeholder="Payroll"
              required
              className="rounded-md border p-2"
            />
            <input
              name="amount"
              aria-label="Income amount"
              placeholder="2425.00"
              required
              className="rounded-md border p-2"
            />
            <select
              name="frequency"
              aria-label="Income frequency"
              className="rounded-md border p-2"
            >
              {[
                "ONE_TIME",
                "WEEKLY",
                "BIWEEKLY",
                "TWICE_MONTHLY",
                "MONTHLY",
                "QUARTERLY",
                "ANNUAL",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              name="date"
              aria-label="Next expected date"
              type="date"
              required
              className="rounded-md border p-2"
            />
            <button className="rounded-md bg-[var(--teal)] p-2 font-semibold text-white">
              {incomeEdit ? "Save income" : "Add expected income"}
            </button>
          </form>
          <div className="mt-5 space-y-3">
            {activeIncome.map((item) => (
              <div key={item.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{item.name}</strong>
                  <span>
                    {formatMoney(item.amountMinor)} · {item.frequency} ·{" "}
                    <Pill tone={item.confidence === "HIGH" ? "good" : "warn"}>
                      {item.confidence}
                    </Pill>
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setIncomeEdit(item.id)} className="underline">
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      send(`/api/planning/income/${item.id}`, "PATCH", {
                        action: item.active ? "PAUSE" : "RESUME",
                      })
                    }
                    className="underline"
                  >
                    {item.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() =>
                      send(`/api/planning/income/${item.id}`, "PATCH", { action: "ARCHIVE" })
                    }
                    className="underline"
                  >
                    Archive
                  </button>
                </div>
                {item.occurrences
                  .filter((o) => o.status === "UPCOMING")
                  .slice(0, 2)
                  .map((o) => (
                    <div key={o.id} className="mt-2 flex justify-between border-t pt-2">
                      <span>
                        {new Date(o.expectedDate).toLocaleDateString()} · {o.status}
                      </span>
                      <button
                        onClick={() =>
                          send(`/api/planning/occurrences/income/${o.id}`, "POST", {
                            action: "RECEIVED",
                          })
                        }
                        className="font-semibold text-[var(--teal)]"
                      >
                        Mark received
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Upcoming Obligations</h2>
          <p className="text-sm text-[var(--muted)]">
            Explicit bills take precedence over debt, recurring, and goal fallbacks.
          </p>
          <form action={submitObligation} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              name="name"
              aria-label="Obligation name"
              placeholder="Electricity"
              required
              className="rounded-md border p-2"
            />
            <input
              name="amount"
              aria-label="Obligation amount"
              placeholder="142.00"
              required
              className="rounded-md border p-2"
            />
            <select
              name="frequency"
              aria-label="Obligation frequency"
              className="rounded-md border p-2"
            >
              {["ONE_TIME", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              name="date"
              aria-label="Next due date"
              type="date"
              required
              className="rounded-md border p-2"
            />
            <select name="type" aria-label="Obligation type" className="rounded-md border p-2">
              {[
                "HOUSING",
                "UTILITY",
                "INSURANCE",
                "DEBT_MINIMUM",
                "SUBSCRIPTION",
                "CHILDCARE",
                "TAX",
                "MEDICAL",
                "GOAL_CONTRIBUTION",
                "SINKING_FUND",
                "OTHER",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <button className="rounded-md bg-[var(--teal)] p-2 font-semibold text-white">
              {obligationEdit ? "Save obligation" : "Add obligation"}
            </button>
          </form>
          <div className="mt-5 space-y-3">
            {activeObligations.map((item) => (
              <div key={item.id} className="rounded-md border p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <strong>{item.name}</strong>
                  <span>
                    {formatMoney(item.amountMinor)} · {item.frequency}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setObligationEdit(item.id)} className="underline">
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      send(`/api/planning/obligations/${item.id}`, "PATCH", {
                        action: item.active ? "PAUSE" : "RESUME",
                      })
                    }
                    className="underline"
                  >
                    {item.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() =>
                      send(`/api/planning/obligations/${item.id}`, "PATCH", { action: "ARCHIVE" })
                    }
                    className="underline"
                  >
                    Archive
                  </button>
                </div>
                {item.occurrences
                  .filter((o) => o.status === "UPCOMING")
                  .slice(0, 1)
                  .map((o) => (
                    <div key={o.id} className="mt-2 flex gap-3 border-t pt-2">
                      <span>{new Date(o.expectedDate).toLocaleDateString()}</span>
                      <button
                        onClick={() =>
                          send(`/api/planning/occurrences/obligation/${o.id}`, "POST", {
                            action: "PAID",
                          })
                        }
                        className="font-semibold text-[var(--teal)]"
                      >
                        Mark paid
                      </button>
                      <button
                        onClick={() =>
                          send(`/api/planning/occurrences/obligation/${o.id}`, "POST", {
                            action: "SKIPPED",
                          })
                        }
                        className="underline"
                      >
                        Skip once
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Paid This Period</h2>
          {paid.length ? (
            paid.slice(0, 8).map((o) => (
              <p key={o.id} className="border-b py-2 text-sm">
                {o.name} · {formatMoney(o.expectedAmountMinor)}
              </p>
            ))
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No satisfied obligations yet.</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Overdue Obligations</h2>
          {overdue.length ? (
            overdue.map((o) => (
              <p key={o.id} className="border-b py-2 text-sm text-[var(--red)]">
                {o.name} · {new Date(o.expectedDate).toLocaleDateString()}
              </p>
            ))
          ) : (
            <p className="mt-3 text-sm text-[var(--green)]">No overdue obligations.</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Suggested Matches</h2>
          {suggestions.length ? (
            suggestions.slice(0, 6).map((s) => (
              <div
                key={`${s.kind}-${s.occurrenceId}-${s.transactionId}`}
                className="border-b py-2 text-sm"
              >
                <strong>{s.label}</strong>
                <span className="block text-xs">
                  {s.confidence} · {formatMoney(s.amountDifferenceMinor)} difference ·{" "}
                  {s.dateDifferenceDays} days
                </span>
                <button
                  onClick={() =>
                    send(`/api/planning/occurrences/${s.kind}/${s.occurrenceId}`, "POST", {
                      action: s.kind === "income" ? "RECEIVED" : "PAID",
                      transactionId: s.transactionId,
                    })
                  }
                  className="mr-3 font-semibold text-[var(--teal)]"
                >
                  Confirm
                </button>
                <button
                  onClick={() =>
                    send(`/api/planning/occurrences/${s.kind}/${s.occurrenceId}`, "POST", {
                      action: "REJECT_MATCH",
                    })
                  }
                  className="underline"
                >
                  Reject
                </button>
              </div>
            ))
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No deterministic suggestions. Nothing is auto-confirmed.
            </p>
          )}
        </Card>
      </div>
      <Card className="p-6">
        <h2 className="text-xl font-semibold">Savings Policy</h2>
        <p className="text-sm text-[var(--muted)]">
          A planning preference, not regulated financial advice.
        </p>
        <form
          action={async (form) => {
            await send("/api/planning/policy", "PATCH", {
              savingsRecommendationMode: String(form.get("mode")),
              savingsTargetBps: Number(form.get("bps")),
              minimumDiscretionaryReserveMinor: money(String(form.get("reserve"))),
              extraSafetyReserveMinor: money(String(form.get("extra"))),
              minimumCashRetainedMinor: money(String(form.get("retained"))),
              includeGoalContributionsInSafeToSave: true,
              emergencyShortfallIncreasesRecommendation: false,
              conservativeConfidenceAdjustmentBps: Number(form.get("confidenceBps")),
            });
          }}
          className="mt-4 grid gap-3 md:grid-cols-3"
        >
          <select
            name="mode"
            aria-label="Savings mode"
            defaultValue={policy.savingsRecommendationMode}
            className="rounded-md border p-2"
          >
            {["CONSERVATIVE", "BALANCED", "AGGRESSIVE", "CUSTOM"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            name="bps"
            aria-label="Savings target basis points"
            type="number"
            defaultValue={policy.savingsTargetBps}
            className="rounded-md border p-2"
          />
          <input
            name="reserve"
            aria-label="Discretionary reserve"
            defaultValue={(policy.minimumDiscretionaryReserveMinor / 100).toFixed(2)}
            className="rounded-md border p-2"
          />
          <input
            name="extra"
            aria-label="Extra safety reserve"
            defaultValue={(policy.extraSafetyReserveMinor / 100).toFixed(2)}
            className="rounded-md border p-2"
          />
          <input
            name="retained"
            aria-label="Minimum cash retained"
            defaultValue={(policy.minimumCashRetainedMinor / 100).toFixed(2)}
            className="rounded-md border p-2"
          />
          <input
            name="confidenceBps"
            aria-label="Conservative adjustment basis points"
            type="number"
            defaultValue={policy.conservativeConfidenceAdjustmentBps}
            className="rounded-md border p-2"
          />
          <button className="rounded-md bg-[var(--teal)] p-2 font-semibold text-white">
            Save savings policy
          </button>
        </form>
      </Card>
    </div>
  );
}
