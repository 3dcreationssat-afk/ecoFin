"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Card, Pill } from "@/components/data-display/primitives";
import { formatMoney, minorToDecimalString, parseMoneyToMinor } from "@/domain/money/money";

type AccountDto = {
  id: string;
  name: string;
  institution: string;
  type: string;
  balanceMinor: number;
  availableMinor?: number | null;
  creditLimitMinor?: number | null;
  aprBasisPoints?: number | null;
  minimumPaymentMinor?: number | null;
  dueDay?: number | null;
  statementDay?: number | null;
  notes?: string | null;
  archivedAt?: string | null;
  lastUpdated: string;
};

export function AccountsClient({
  householdId,
  accounts,
}: {
  householdId: string;
  accounts: AccountDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const first = accounts[0];
  const [editingId, setEditingId] = useState(first?.id ?? "");
  const editing = accounts.find((account) => account.id === editingId) ?? first;
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState(accountForm(editing, householdId));

  function choose(account: AccountDto) {
    setEditingId(account.id);
    setForm(accountForm(account, householdId));
  }

  async function save(method: "POST" | "PATCH") {
    setStatus("saving");
    setError("");
    const body = toPayload(form);
    const response = await fetch(
      method === "POST" ? "/api/accounts" : `/api/accounts/${editingId}`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "Unable to save account.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  async function archive(id: string, action: "archive" | "restore") {
    setStatus("saving");
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Card className="mb-7 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Account Editor</h2>
            <p className="text-sm text-[var(--muted)]">
              Create, edit, archive, and restore accounts in SQLite.
            </p>
          </div>
          {status === "saving" || isPending ? <Pill tone="info">Saving</Pill> : null}
          {status === "saved" ? <Pill tone="good">Saved</Pill> : null}
        </div>
        {error ? (
          <div role="alert" className="mb-4 rounded-md bg-[var(--red-soft)] p-3 text-sm">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field
            label="Institution"
            value={form.institution}
            onChange={(institution) => setForm({ ...form, institution })}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(type) => setForm({ ...form, type })}
            options={["CHECKING", "SAVINGS", "CREDIT", "LOAN", "MORTGAGE", "OTHER"]}
          />
          <Field
            label="Balance"
            value={form.balance}
            onChange={(balance) => setForm({ ...form, balance })}
          />
          <Field
            label="Available"
            value={form.available}
            onChange={(available) => setForm({ ...form, available })}
          />
          <Field
            label="Credit limit"
            value={form.creditLimit}
            onChange={(creditLimit) => setForm({ ...form, creditLimit })}
          />
          <Field label="APR %" value={form.apr} onChange={(apr) => setForm({ ...form, apr })} />
          <Field
            label="Minimum payment"
            value={form.minimumPayment}
            onChange={(minimumPayment) => setForm({ ...form, minimumPayment })}
          />
          <Field
            label="Due date"
            value={form.dueDay}
            onChange={(dueDay) => setForm({ ...form, dueDay })}
          />
          <Field
            label="Statement date"
            value={form.statementDay}
            onChange={(statementDay) => setForm({ ...form, statementDay })}
          />
          <Field
            label="Notes"
            value={form.notes}
            onChange={(notes) => setForm({ ...form, notes })}
          />
        </div>
        <div className="mt-5 flex gap-3">
          <Button disabled={status === "saving"} onClick={() => save("PATCH") as never}>
            Save account
          </Button>
          <Button
            variant="secondary"
            disabled={status === "saving"}
            onClick={() => save("POST") as never}
          >
            <Plus className="h-4 w-4" /> Create as new
          </Button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-6">
          <h2 className="text-xl font-semibold">All Accounts</h2>
          <p className="text-[var(--muted)]">Balances and details derive from SQLite</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                {[
                  "Account",
                  "Institution",
                  "Type",
                  "Balance",
                  "APR",
                  "Minimum",
                  "Due",
                  "Statement",
                  "Status",
                  "",
                ].map((h) => (
                  <th key={h} className="px-5 py-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-[var(--border)]">
                  <td className="px-5 py-4">
                    <button className="font-semibold" onClick={() => choose(account)}>
                      {account.name}
                    </button>
                    <div className="text-xs text-[var(--muted)]">{account.notes}</div>
                  </td>
                  <td className="px-5 py-4">{account.institution}</td>
                  <td className="px-5 py-4">{account.type}</td>
                  <td
                    className={
                      account.balanceMinor < 0 ? "px-5 py-4 text-[var(--red)]" : "px-5 py-4"
                    }
                  >
                    {formatMoney(account.balanceMinor)}
                  </td>
                  <td className="px-5 py-4">
                    {account.aprBasisPoints ? `${(account.aprBasisPoints / 100).toFixed(2)}%` : "-"}
                  </td>
                  <td className="px-5 py-4">
                    {account.minimumPaymentMinor ? formatMoney(account.minimumPaymentMinor) : "-"}
                  </td>
                  <td className="px-5 py-4">{account.dueDay ?? "-"}</td>
                  <td className="px-5 py-4">{account.statementDay ?? "-"}</td>
                  <td className="px-5 py-4">
                    <Pill tone={account.archivedAt ? "neutral" : "good"}>
                      {account.archivedAt ? "Archived" : "Active"}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="rounded-md border border-[var(--border)] px-3 py-2"
                      onClick={() =>
                        archive(account.id, account.archivedAt ? "restore" : "archive")
                      }
                    >
                      {account.archivedAt ? "Restore" : "Archive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function accountForm(account: AccountDto | undefined, householdId: string) {
  return {
    householdId,
    name: account?.name ?? "",
    institution: account?.institution ?? "",
    type: account?.type ?? "CHECKING",
    balance: minorToDecimalString(account?.balanceMinor ?? 0),
    available: account?.availableMinor == null ? "" : minorToDecimalString(account.availableMinor),
    creditLimit:
      account?.creditLimitMinor == null ? "" : minorToDecimalString(account.creditLimitMinor),
    apr: account?.aprBasisPoints == null ? "" : String(account.aprBasisPoints / 100),
    minimumPayment:
      account?.minimumPaymentMinor == null ? "" : minorToDecimalString(account.minimumPaymentMinor),
    dueDay: account?.dueDay == null ? "" : String(account.dueDay),
    statementDay: account?.statementDay == null ? "" : String(account.statementDay),
    notes: account?.notes ?? "",
  };
}

function toPayload(form: ReturnType<typeof accountForm>) {
  return {
    householdId: form.householdId,
    name: form.name,
    institution: form.institution,
    type: form.type,
    balanceMinor: parseMoneyToMinor(form.balance),
    availableMinor: form.available ? parseMoneyToMinor(form.available) : null,
    creditLimitMinor: form.creditLimit ? parseMoneyToMinor(form.creditLimit) : null,
    aprBasisPoints: form.apr ? Math.round(Number(form.apr) * 100) : null,
    minimumPaymentMinor: form.minimumPayment ? parseMoneyToMinor(form.minimumPayment) : null,
    dueDay: form.dueDay ? Number(form.dueDay) : null,
    statementDay: form.statementDay ? Number(form.statementDay) : null,
    notes: form.notes || null,
    lastUpdated: new Date().toISOString(),
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

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <select
        className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
