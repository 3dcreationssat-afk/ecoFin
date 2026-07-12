"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Pill } from "@/components/data-display/primitives";
import { formatMoney, minorToDecimalString, parseMoneyToMinor } from "@/domain/money/money";

type AccountDto = {
  id: string;
  name: string;
  institution: string;
  type: string;
  creditLimitMinor?: number | null;
  aprBasisPoints?: number | null;
  minimumPaymentMinor?: number | null;
  dueDay?: number | null;
  statementDay?: number | null;
  notes?: string | null;
  archivedAt?: string | null;
  lastUpdated: string;
  openingBalanceMinor?: number | null;
  openingBalanceDate?: string | null;
  reportedBalanceMinor?: number | null;
  reportedAvailableMinor?: number | null;
  reportedBalanceAsOf?: string | null;
  ledgerBalanceMinor?: number | null;
  reconciliationDifferenceMinor?: number | null;
  reconciliationStatus?: string;
  balanceConfidence?: string;
  lastReconciledAt?: string | null;
};

const accountTypes = ["CHECKING", "SAVINGS", "CREDIT", "LOAN", "MORTGAGE", "OTHER"];
const accountTypeLabels: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT: "Credit card",
  LOAN: "Loan",
  MORTGAGE: "Mortgage",
  OTHER: "Other",
};
const institutions = [
  "First National Bank",
  "Chase",
  "Capital One",
  "Toyota Financial",
  "Quicken Loans",
  "Bank of America",
  "Wells Fargo",
  "Citi",
  "Other institution",
];

export function AccountsClient({
  householdId,
  accounts,
}: {
  householdId: string;
  accounts: AccountDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState(accountForm(undefined, householdId));
  const [reconcile, setReconcile] = useState({
    reported: "",
    available: "",
    asOf: new Date().toISOString().slice(0, 10),
    note: "",
    createAdjustment: false,
    adjustmentReason: "",
  });

  function choose(account: AccountDto) {
    setMode("edit");
    setEditingId(account.id);
    setForm(accountForm(account, householdId));
  }

  function startAdd() {
    setMode("add");
    setEditingId("");
    setError("");
    setForm(accountForm(undefined, householdId));
  }

  async function save() {
    setStatus("saving");
    setError("");
    const body = toPayload(form);
    const response = await fetch(mode === "add" ? "/api/accounts" : `/api/accounts/${editingId}`, {
      method: mode === "add" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
  async function reconcileAccount() {
    if (!editingId) return;
    setStatus("saving");
    setError("");
    const response = await fetch(`/api/accounts/${editingId}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportedBalanceMinor: parseMoneyToMinor(reconcile.reported),
        reportedAvailableMinor: parseOptionalMoney(reconcile.available),
        reportedBalanceAsOf: `${reconcile.asOf}T00:00:00.000Z`,
        note: reconcile.note || null,
        createAdjustment: reconcile.createAdjustment,
        adjustmentReason: reconcile.adjustmentReason || null,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Reconciliation failed.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Card className="mb-7 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {mode === "add" ? "Add Account" : "Edit Account"}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {mode === "add"
                ? "Start with a blank account and choose only the fields that apply."
                : "Update the selected account. Use Cancel to return to Add Account mode."}
            </p>
          </div>
          <button
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            onClick={startAdd}
          >
            Add account
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
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <InstitutionSelect
            value={form.institution}
            onChange={(institution) => setForm({ ...form, institution })}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(type) => setForm({ ...form, type })}
            options={accountTypes}
            labels={accountTypeLabels}
          />
          <Field
            label={
              form.type === "CREDIT"
                ? "Current card balance"
                : form.type === "LOAN" || form.type === "MORTGAGE"
                  ? "Outstanding balance"
                  : "Current balance"
            }
            help="Institution-reported snapshot. Enter liability balances as positive amounts owed. The ledger is maintained separately once anchored."
            value={form.balance}
            onChange={(balance) => setForm({ ...form, balance })}
          />
          <Field
            label="Opening balance"
            help="Optional trustworthy ledger anchor. Existing snapshots are not inferred as openings."
            value={form.openingBalance}
            onChange={(openingBalance) => setForm({ ...form, openingBalance })}
          />
          <Field
            label="Opening balance date"
            value={form.openingBalanceDate}
            onChange={(openingBalanceDate) => setForm({ ...form, openingBalanceDate })}
            type="date"
          />
          {["CHECKING", "SAVINGS", "OTHER"].includes(form.type) ? (
            <Field
              label="Available balance"
              help="Optional amount available today, if different from current balance."
              value={form.available}
              onChange={(available) => setForm({ ...form, available })}
            />
          ) : null}
          {form.type === "CREDIT" ? (
            <>
              <Field
                label="Available credit"
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
                label="Payment due day"
                value={form.dueDay}
                onChange={(dueDay) => setForm({ ...form, dueDay })}
              />
              <Field
                label="Statement closing day"
                value={form.statementDay}
                onChange={(statementDay) => setForm({ ...form, statementDay })}
              />
            </>
          ) : null}
          {["LOAN", "MORTGAGE"].includes(form.type) ? (
            <>
              <Field label="APR %" value={form.apr} onChange={(apr) => setForm({ ...form, apr })} />
              <Field
                label="Minimum payment"
                value={form.minimumPayment}
                onChange={(minimumPayment) => setForm({ ...form, minimumPayment })}
              />
              <Field
                label="Payment due day"
                value={form.dueDay}
                onChange={(dueDay) => setForm({ ...form, dueDay })}
              />
            </>
          ) : null}
          <Field
            label="Notes"
            value={form.notes}
            onChange={(notes) => setForm({ ...form, notes })}
          />
        </div>
        <div className="mt-5 flex gap-3">
          <Button
            disabled={status === "saving" || (mode === "edit" && !editingId)}
            onClick={() => save() as never}
          >
            {mode === "add" ? "Create account" : "Save account"}
          </Button>
          {mode === "edit" ? (
            <Button variant="secondary" onClick={startAdd}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </Card>
      {mode === "edit" ? (
        <Card className="mb-7 p-6">
          <h2 className="text-xl font-semibold">Reconcile account</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Compare the transaction ledger with a bank-reported snapshot. An adjustment is never
            created unless explicitly selected and explained.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              label="Bank-reported balance"
              value={reconcile.reported}
              onChange={(reported) => setReconcile({ ...reconcile, reported })}
            />
            <Field
              label="Reported available balance"
              value={reconcile.available}
              onChange={(available) => setReconcile({ ...reconcile, available })}
            />
            <Field
              label="Balance date"
              value={reconcile.asOf}
              onChange={(asOf) => setReconcile({ ...reconcile, asOf })}
              type="date"
            />
            <Field
              label="Reconciliation note"
              value={reconcile.note}
              onChange={(note) => setReconcile({ ...reconcile, note })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reconcile.createAdjustment}
                onChange={(event) =>
                  setReconcile({ ...reconcile, createAdjustment: event.target.checked })
                }
              />{" "}
              Add explicit adjustment for the difference
            </label>
            {reconcile.createAdjustment ? (
              <Field
                label="Adjustment reason"
                value={reconcile.adjustmentReason}
                onChange={(adjustmentReason) => setReconcile({ ...reconcile, adjustmentReason })}
              />
            ) : null}
          </div>
          <div className="mt-4">
            <Button onClick={reconcileAccount}>Reconcile</Button>
          </div>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-6">
          <h2 className="text-xl font-semibold">All Accounts</h2>
          <p className="text-[var(--muted)]">Choose an account to edit, archive, or restore.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                {[
                  "Account",
                  "Institution",
                  "Type",
                  "Ledger",
                  "Reported",
                  "Difference",
                  "Confidence",
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
                  <td className="px-5 py-4">{accountTypeLabels[account.type] ?? account.type}</td>
                  <td
                    className={
                      account.type === "CREDIT" ||
                      account.type === "LOAN" ||
                      account.type === "MORTGAGE"
                        ? "px-5 py-4 text-[var(--red)]"
                        : "px-5 py-4"
                    }
                  >
                    {account.ledgerBalanceMinor == null
                      ? "Not anchored"
                      : formatMoney(account.ledgerBalanceMinor)}
                  </td>
                  <td className="px-5 py-4">
                    {account.reportedBalanceMinor == null
                      ? "-"
                      : formatMoney(account.reportedBalanceMinor)}
                  </td>
                  <td className="px-5 py-4">
                    {account.reconciliationDifferenceMinor == null
                      ? "-"
                      : formatMoney(account.reconciliationDifferenceMinor)}
                  </td>
                  <td className="px-5 py-4">
                    <Pill
                      tone={
                        account.balanceConfidence === "HIGH"
                          ? "good"
                          : account.balanceConfidence === "MODERATE"
                            ? "warn"
                            : "bad"
                      }
                    >
                      {account.balanceConfidence ?? "LIMITED"}
                    </Pill>
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
    balance:
      account?.reportedBalanceMinor == null
        ? ""
        : minorToDecimalString(account.reportedBalanceMinor),
    openingBalance:
      account?.openingBalanceMinor == null ? "" : minorToDecimalString(account.openingBalanceMinor),
    openingBalanceDate: account?.openingBalanceDate?.slice(0, 10) ?? "",
    available:
      account?.reportedAvailableMinor == null
        ? ""
        : minorToDecimalString(account.reportedAvailableMinor),
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
  const isCashLike = ["CHECKING", "SAVINGS", "OTHER"].includes(form.type);
  const isCredit = form.type === "CREDIT";
  const isDebt = ["CREDIT", "LOAN", "MORTGAGE"].includes(form.type);
  return {
    householdId: form.householdId,
    name: form.name,
    institution: form.institution,
    type: form.type,
    openingBalanceMinor: parseOptionalMoney(form.openingBalance),
    openingBalanceDate: form.openingBalanceDate ? `${form.openingBalanceDate}T00:00:00.000Z` : null,
    openingBalanceSource: form.openingBalance ? "USER_OPENING_BALANCE" : null,
    reportedBalanceMinor: parseOptionalMoney(form.balance),
    reportedAvailableMinor: isCashLike || isCredit ? parseOptionalMoney(form.available) : null,
    reportedBalanceAsOf: new Date().toISOString(),
    creditLimitMinor: isCredit ? parseOptionalMoney(form.creditLimit) : null,
    aprBasisPoints: isDebt && form.apr ? Math.round(Number(form.apr) * 100) : null,
    minimumPaymentMinor: isDebt ? parseOptionalMoney(form.minimumPayment) : null,
    dueDay: isDebt && form.dueDay ? Number(form.dueDay) : null,
    statementDay: isCredit && form.statementDay ? Number(form.statementDay) : null,
    notes: form.notes || null,
    lastUpdated: new Date().toISOString(),
  };
}

function parseOptionalMoney(value: string) {
  return value ? parseMoneyToMinor(value) : null;
}

function Field({
  label,
  help,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      {help ? <span className="ml-2 text-xs text-[var(--muted)]">Info: {help}</span> : null}
      <input
        aria-label={label}
        className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  labels = {},
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <select
        aria-label={label}
        className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InstitutionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const listed = institutions.includes(value);
  return (
    <div>
      <label>
        <span className="text-sm text-[var(--muted)]">Institution</span>
        <select
          aria-label="Institution"
          className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
          value={listed ? value : "Other institution"}
          onChange={(event) => onChange(event.target.value)}
        >
          {institutions.map((institution) => (
            <option key={institution} value={institution}>
              {institution}
            </option>
          ))}
        </select>
      </label>
      {!listed || value === "Other institution" ? (
        <input
          aria-label="Other institution name"
          className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3"
          value={value === "Other institution" ? "" : value}
          placeholder="Institution name"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}
