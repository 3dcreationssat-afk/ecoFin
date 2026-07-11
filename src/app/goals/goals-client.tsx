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
  contributions: { amountMinor: number; createdAt: string; note?: string | null }[];
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
  const [editingId, setEditingId] = useState(first?.id ?? "");
  const editing = goals.find((goal) => goal.id === editingId) ?? first;
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState(goalForm(editing, householdId, accounts[0]?.id ?? ""));
  const [contribution, setContribution] = useState("25.00");

  function choose(goal: GoalDto) {
    setEditingId(goal.id);
    setForm(goalForm(goal, householdId, accounts[0]?.id ?? ""));
  }

  async function save(method: "POST" | "PATCH") {
    setStatus("saving");
    setError("");
    const response = await fetch(method === "POST" ? "/api/goals" : `/api/goals/${editingId}`, {
      method,
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
    setStatus("saving");
    const response = await fetch(`/api/goals/${id}/contributions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: parseMoneyToMinor(contribution),
        contributionDate: new Date().toISOString(),
        note: "Manual contribution",
      }),
    });
    setStatus(response.ok ? "saved" : "error");
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
          <h2 className="text-xl font-semibold">Goal Editor</h2>
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
            onClick={() => save("PATCH")}
          >
            Save goal
          </button>
          <button
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
            onClick={() => save("POST")}
          >
            Create as new
          </button>
          <input
            aria-label="Contribution amount"
            className="h-10 rounded-md border border-[var(--border)] px-3"
            value={contribution}
            onChange={(event) => setContribution(event.target.value)}
          />
          <button
            className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
            onClick={() => contribute(editingId)}
          >
            Record contribution
          </button>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        {goals.map((goal) => {
          const progress = goalProgress(goal);
          return (
            <Card key={goal.id} className="p-6">
              <div className="mb-8 flex justify-between">
                <div>
                  <button className="text-left text-xl font-semibold" onClick={() => choose(goal)}>
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
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
