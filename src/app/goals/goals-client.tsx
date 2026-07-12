"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Pill } from "@/components/data-display/primitives";
import { formatMoney, minorToDecimalString, parseMoneyToMinor } from "@/domain/money/money";
import { goalProgress } from "@/domain/summaries/calculations";

type GoalDto = {
  id: string;
  name: string;
  targetMinor: number;
  currentMinor: number;
  plannedMonthlyMinor: number;
  requiredMonthlyMinor: number;
  priority: number;
  linkedAccountId?: string | null;
  archivedAt?: string | null;
  linkedAccount?: { name: string } | null;
  contributions: { amountMinor: number; createdAt: string; note?: string | null; source: string }[];
};

type AccountDto = { id: string; name: string; archivedAt?: string | null };

export function GoalsClient({
  householdId,
  accounts,
  goals,
}: {
  householdId: string;
  accounts: AccountDto[];
  goals: GoalDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const first = goals[0];
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState(first?.id ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState(goalForm(undefined, householdId, accounts[0]?.id ?? ""));
  const [contributionGoalId, setContributionGoalId] = useState(first?.id ?? "");
  const [contribution, setContribution] = useState({
    amount: "25.00",
    date: new Date().toISOString().slice(0, 10),
    accountId: accounts[0]?.id ?? "",
    note: "",
  });

  function choose(goal: GoalDto) {
    setMode("edit");
    setEditingId(goal.id);
    setForm(goalForm(goal, householdId, accounts[0]?.id ?? ""));
  }

  function startAdd() {
    setMode("add");
    setEditingId("");
    setError("");
    setForm(goalForm(undefined, householdId, accounts[0]?.id ?? ""));
  }

  async function save() {
    setStatus("saving");
    setError("");
    const response = await fetch(mode === "add" ? "/api/goals" : `/api/goals/${editingId}`, {
      method: mode === "add" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(form)),
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Unable to save goal.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  async function contribute(id: string) {
    if (!id) return;
    setStatus("saving");
    setError("");
    const sourceAccount = accounts.find((account) => account.id === contribution.accountId);
    const response = await fetch(`/api/goals/${id}/contributions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: parseMoneyToMinor(contribution.amount),
        contributionDate: new Date(`${contribution.date}T12:00:00.000Z`).toISOString(),
        source: sourceAccount ? `Account: ${sourceAccount.name}` : "Manual contribution",
        note: contribution.note || "Manual contribution",
      }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Unable to record contribution.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  async function archive(id: string, action: "archive" | "restore") {
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Card className="mb-7 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{mode === "add" ? "Add Goal" : "Edit Goal"}</h2>
            <p className="text-sm text-[var(--muted)]">
              {mode === "add"
                ? "Create a new savings target without changing existing goals."
                : "Update the selected goal. Contributions are recorded separately below."}
            </p>
          </div>
          <button
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            onClick={startAdd}
          >
            Add goal
          </button>
          {status === "saving" || isPending ? <Pill tone="info">Saving</Pill> : null}
          {status === "saved" ? <Pill tone="good">Saved</Pill> : null}
        </div>
        {error ? (
          <div role="alert" className="mb-4 rounded-md bg-[var(--red-soft)] p-3 text-sm">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-4">
          <Field
            label="Goal name"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
          />
          <Field
            label="Target"
            value={form.target}
            onChange={(target) => setForm({ ...form, target })}
          />
          <Field
            label="Current"
            value={form.current}
            onChange={(current) => setForm({ ...form, current })}
          />
          <Field
            label="Planned monthly"
            value={form.planned}
            onChange={(planned) => setForm({ ...form, planned })}
          />
          <Field
            label="Required monthly"
            value={form.required}
            onChange={(required) => setForm({ ...form, required })}
          />
          <Field
            label="Priority"
            help="Lower numbers sort earlier when comparing goals."
            value={form.priority}
            onChange={(priority) => setForm({ ...form, priority })}
          />
          <label>
            <span className="text-sm text-[var(--muted)]">Linked account</span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
              value={form.linkedAccountId}
              onChange={(event) => setForm({ ...form, linkedAccountId: event.target.value })}
            >
              {accounts
                .filter((account) => !account.archivedAt)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
            disabled={status === "saving" || (mode === "edit" && !editingId)}
            onClick={save}
          >
            {mode === "add" ? "Create goal" : "Save goal"}
          </button>
          {mode === "edit" ? (
            <button
              className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
              onClick={startAdd}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </Card>
      <Card className="mb-7 p-6">
        <h2 className="text-xl font-semibold">Record Contribution</h2>
        <p className="text-sm text-[var(--muted)]">
          Add money already moved toward a goal and keep a visible contribution history.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label>
            <span className="text-sm text-[var(--muted)]">Goal</span>
            <select
              aria-label="Contribution goal"
              className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
              value={contributionGoalId}
              onChange={(event) => setContributionGoalId(event.target.value)}
            >
              {goals
                .filter((goal) => !goal.archivedAt)
                .map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
            </select>
          </label>
          <input
            aria-label="Contribution amount"
            className="h-11 rounded-md border border-[var(--border)] px-3"
            value={contribution.amount}
            onChange={(event) => setContribution({ ...contribution, amount: event.target.value })}
          />
          <input
            aria-label="Contribution date"
            type="date"
            className="h-11 rounded-md border border-[var(--border)] px-3"
            value={contribution.date}
            onChange={(event) => setContribution({ ...contribution, date: event.target.value })}
          />
          <label>
            <span className="text-sm text-[var(--muted)]">Source account</span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
              value={contribution.accountId}
              onChange={(event) =>
                setContribution({ ...contribution, accountId: event.target.value })
              }
            >
              {accounts
                .filter((account) => !account.archivedAt)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </label>
          <input
            aria-label="Contribution note"
            className="h-11 rounded-md border border-[var(--border)] px-3"
            placeholder="Optional note"
            value={contribution.note}
            onChange={(event) => setContribution({ ...contribution, note: event.target.value })}
          />
        </div>
        <button
          className="mt-5 h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
          disabled={!contributionGoalId || status === "saving"}
          onClick={() => contribute(contributionGoalId)}
        >
          Record contribution
        </button>
        <div className="mt-5 max-h-72 overflow-y-auto rounded-md border border-[var(--border)]">
          {(goals.find((goal) => goal.id === contributionGoalId)?.contributions ?? []).length ? (
            (goals.find((goal) => goal.id === contributionGoalId)?.contributions ?? []).map(
              (entry, index) => (
                <div
                  key={`${entry.createdAt}-${index}`}
                  className="flex flex-wrap justify-between gap-3 border-b border-[var(--border)] p-3 text-sm last:border-b-0"
                >
                  <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                  <strong>{formatMoney(entry.amountMinor)}</strong>
                  <span className="text-[var(--muted)]">{entry.source}</span>
                  <span className="text-[var(--muted)]">{entry.note ?? ""}</span>
                </div>
              ),
            )
          ) : (
            <p className="p-3 text-sm text-[var(--muted)]">No contributions recorded yet.</p>
          )}
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        {goals.map((goal) => {
          const progress = goalProgress(goal);
          return (
            <div key={goal.id} id={`goal-${goal.id}`} className="scroll-mt-6">
              <Card className="p-6">
                <div className="mb-8 flex justify-between">
                  <div>
                    <button
                      className="text-left text-xl font-semibold"
                      onClick={() => choose(goal)}
                    >
                      {goal.name}
                    </button>
                    <p className="text-sm text-[var(--muted)]">
                      {goal.linkedAccount?.name ?? "No account linked"}
                    </p>
                  </div>
                  <Pill tone={goal.archivedAt ? "neutral" : "good"}>
                    {goal.archivedAt ? "Archived" : "Active"}
                  </Pill>
                </div>
                <div className="flex items-end justify-between">
                  <strong className="text-3xl">{formatMoney(goal.currentMinor)}</strong>
                  <span className="text-[var(--muted)]">of {formatMoney(goal.targetMinor)}</span>
                </div>
                <div className="my-3 h-2 rounded bg-[var(--surface-muted)]">
                  <div className="h-2 rounded bg-[var(--teal)]" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {progress}% complete · {goal.contributions.length} contribution records
                </p>
                <div className="mt-7 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--muted)]">Planned / mo</span>
                    <div className="font-semibold">{formatMoney(goal.plannedMonthlyMinor)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--muted)]">Required / mo</span>
                    <div className="font-semibold">{formatMoney(goal.requiredMonthlyMinor)}</div>
                  </div>
                </div>
                <button
                  className="mt-6 h-10 w-full rounded-md border border-[var(--border)]"
                  onClick={() => archive(goal.id, goal.archivedAt ? "restore" : "archive")}
                >
                  {goal.archivedAt ? "Restore" : "Archive"}
                </button>
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
}

function goalForm(goal: GoalDto | undefined, householdId: string, fallbackAccountId: string) {
  return {
    householdId,
    name: goal?.name ?? "",
    target: minorToDecimalString(goal?.targetMinor ?? 10000),
    current: minorToDecimalString(goal?.currentMinor ?? 0),
    planned: minorToDecimalString(goal?.plannedMonthlyMinor ?? 0),
    required: minorToDecimalString(goal?.requiredMonthlyMinor ?? 0),
    priority: String(goal?.priority ?? 100),
    linkedAccountId: goal?.linkedAccountId ?? fallbackAccountId,
  };
}

function toPayload(form: ReturnType<typeof goalForm>) {
  return {
    householdId: form.householdId,
    linkedAccountId: form.linkedAccountId || null,
    name: form.name,
    targetMinor: parseMoneyToMinor(form.target),
    currentMinor: parseMoneyToMinor(form.current),
    plannedMonthlyMinor: parseMoneyToMinor(form.planned),
    requiredMonthlyMinor: parseMoneyToMinor(form.required),
    priority: Number(form.priority),
  };
}

function Field({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      {help ? <span className="ml-2 text-xs text-[var(--muted)]">Info: {help}</span> : null}
      <input
        className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
