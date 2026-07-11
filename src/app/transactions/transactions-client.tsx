"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, SlidersHorizontal, Upload } from "lucide-react";
import { Button, Card, Pill, PlannedControl } from "@/components/data-display/primitives";
import { formatMoney } from "@/domain/money/money";

type CategoryDto = { id: string; name: string };
type TransactionDto = {
  id: string;
  originalDescription: string;
  originalAmountText: string;
  originalDateText: string;
  normalizedMerchant: string;
  amountMinor: number;
  transactionDate: string;
  postedDate?: string | null;
  type: string;
  reviewStatus: string;
  excluded: boolean;
  notes?: string | null;
  categoryId?: string | null;
  account: { name: string };
  category?: { name: string } | null;
};
type AuditDto = {
  id: string;
  action: string;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  createdAt: string;
};

export function TransactionsClient({
  transactions,
  categories,
}: {
  transactions: TransactionDto[];
  categories: CategoryDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<TransactionDto | null>(null);
  const [audit, setAudit] = useState<AuditDto[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [form, setForm] = useState({
    normalizedMerchant: "",
    categoryId: "",
    type: "DEBIT",
    reviewStatus: "NEEDS_REVIEW",
    excluded: false,
    notes: "",
  });

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  async function open(transaction: TransactionDto) {
    setSelected(transaction);
    setForm({
      normalizedMerchant: transaction.normalizedMerchant,
      categoryId: transaction.categoryId ?? "",
      type: transaction.type,
      reviewStatus: transaction.reviewStatus,
      excluded: transaction.excluded,
      notes: transaction.notes ?? "",
    });
    const response = await fetch(`/api/transactions/${transaction.id}/audit`);
    const body = await response.json();
    setAudit(body.audit ?? []);
  }

  async function save() {
    if (!selected) return;
    setStatus("saving");
    const response = await fetch(`/api/transactions/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, categoryId: form.categoryId || null }),
    });
    setStatus(response.ok ? "saved" : "error");
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Button variant="secondary" disabled title="CSV import is planned for Phase 2">
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
        <Button disabled title="Manual transaction creation is planned">
          <Plus className="h-4 w-4" /> Add Transaction
        </Button>
        <PlannedControl>
          <SlidersHorizontal className="h-4 w-4" /> Saved Views
        </PlannedControl>
        {status === "saving" || isPending ? <Pill tone="info">Saving</Pill> : null}
        {status === "saved" ? <Pill tone="good">Saved</Pill> : null}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                {[
                  "Date",
                  "Merchant / Original",
                  "Account",
                  "Category",
                  "Amount",
                  "Status",
                  "Excluded",
                ].map((h) => (
                  <th key={h} className="px-4 py-4 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                >
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(transaction.transactionDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-semibold"
                      onClick={() => open(transaction)}
                    >
                      {transaction.normalizedMerchant}
                    </button>
                    <div className="text-xs text-[var(--muted)]">
                      {transaction.originalDescription}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{transaction.account.name}</td>
                  <td className="px-4 py-3">
                    {transaction.category?.name ?? (
                      <span className="italic text-[var(--amber)]">Uncategorized</span>
                    )}
                  </td>
                  <td
                    className={
                      transaction.amountMinor > 0
                        ? "px-4 py-3 text-right font-semibold text-[var(--green)]"
                        : "px-4 py-3 text-right font-semibold"
                    }
                  >
                    {formatMoney(transaction.amountMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        transaction.reviewStatus === "REVIEWED"
                          ? "good"
                          : transaction.reviewStatus === "FLAGGED"
                            ? "bad"
                            : "warn"
                      }
                    >
                      {transaction.reviewStatus}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">{transaction.excluded ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setSelected(null)}>
          <aside
            data-testid="transaction-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-drawer-title"
            className="ml-auto h-full w-full max-w-[560px] overflow-y-auto bg-[var(--surface)] p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="Close transaction drawer"
              className="float-right rounded-full border border-[var(--teal)] px-3 py-1 text-[var(--teal)]"
              onClick={() => setSelected(null)}
            >
              x
            </button>
            <h2 id="transaction-drawer-title" className="text-2xl font-semibold">
              {selected.normalizedMerchant}
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              Original imported values are immutable through this editor.
            </p>
            <div className="my-8 flex justify-between border-b border-[var(--border)] pb-6">
              <span className="text-[var(--muted)]">Parsed amount</span>
              <strong className="text-3xl">{formatMoney(selected.amountMinor)}</strong>
            </div>
            <Section
              title="Imported Data"
              rows={[
                ["Original description", selected.originalDescription],
                ["Original amount", selected.originalAmountText],
                ["Original date", selected.originalDateText],
              ]}
            />
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Editable Normalized Values
              </h3>
              <Field
                label="Merchant"
                value={form.normalizedMerchant}
                onChange={(normalizedMerchant) => setForm({ ...form, normalizedMerchant })}
              />
              <label className="block text-sm text-[var(--muted)]">
                Category
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-[var(--muted)]">
                Transaction type
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value })}
                >
                  {["DEBIT", "CREDIT", "TRANSFER", "PAYMENT", "REFUND"].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-[var(--muted)]">
                Review status
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
                  value={form.reviewStatus}
                  onChange={(event) => setForm({ ...form, reviewStatus: event.target.value })}
                >
                  {["NEEDS_REVIEW", "REVIEWED", "FLAGGED"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.excluded}
                  onChange={(event) => setForm({ ...form, excluded: event.target.checked })}
                />{" "}
                Exclude from summaries
              </label>
              <Field
                label="Notes"
                value={form.notes}
                onChange={(notes) => setForm({ ...form, notes })}
              />
            </div>
            <button
              className="mt-6 h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
              onClick={save}
            >
              Save transaction
            </button>
            <Section
              title="Audit History"
              rows={
                audit.length
                  ? audit.map((entry) => [
                      entry.field ?? entry.action,
                      `${entry.previousValue ?? "-"} -> ${entry.newValue ?? "-"} (${new Date(entry.createdAt).toLocaleString()})`,
                    ])
                  : [["No manual changes", "No audit records yet"]]
              }
            />
          </aside>
        </div>
      ) : null}
    </>
  );
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
    <label className="block text-sm text-[var(--muted)]">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Section({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="mt-8">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {title}
      </h3>
      <div className="space-y-3">
        {rows.map(([a, b]) => (
          <div key={`${title}-${a}`} className="flex justify-between gap-8 text-sm">
            <span className="text-[var(--muted)]">{a}</span>
            <code className="text-right">{b}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
