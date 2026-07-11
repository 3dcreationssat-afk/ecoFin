"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta, transactions } from "@/data/demo";

export default function TransactionsPage() {
  const [drawer, setDrawer] = useState(false);
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/transactions"].title}
        subtitle={pageMeta["/transactions"].subtitle}
        action={
          <div className="flex gap-3">
            <Button variant="secondary"><Upload className="h-4 w-4" /> Import CSV</Button>
            <Button><Plus className="h-4 w-4" /> Add Transaction</Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="h-11 min-w-[280px] flex-1 rounded-md border border-[var(--border)] bg-white px-4" placeholder="Search merchant..." />
        {["All Accounts", "All Categories", "All Statuses"].map((label) => (
          <select key={label} className="h-11 rounded-md border border-[var(--border)] bg-white px-4"><option>{label}</option></select>
        ))}
        <Button variant="secondary"><SlidersHorizontal className="h-4 w-4" /> Saved Views</Button>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>{["", "Date", "Merchant / Description", "Account", "Category", "Amount", "Status"].map((h) => <th key={h} className="px-4 py-4 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {transactions.map((row, index) => (
                <tr key={`${row[0]}-${row[1]}-${row[2]}-${index}`} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                  <td className="px-4 py-3"><span className="block h-5 w-5 rounded border border-[var(--teal)]" /></td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row[0]}</td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-left font-semibold" onClick={() => setDrawer(true)}>
                      {row[1]}
                    </button>
                    <div className="text-xs text-[var(--muted)]">{row[2]}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row[3]}</td>
                  <td className="px-4 py-3">{row[4] === "Uncategorized" ? <span className="italic text-[var(--amber)]">{row[4]}</span> : row[4]}</td>
                  <td className={row[5].startsWith("+") ? "px-4 py-3 text-right font-semibold text-[var(--green)]" : "px-4 py-3 text-right font-semibold"}>{row[5]}</td>
                  <td className="px-4 py-3"><Pill tone={row[6] === "Reviewed" ? "good" : row[6].includes("duplicate") ? "bad" : "warn"}>{row[6]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {drawer ? (
        <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setDrawer(false)}>
          <aside data-testid="transaction-drawer" className="ml-auto h-full w-full max-w-[520px] overflow-y-auto bg-[var(--surface)] p-8" onClick={(event) => event.stopPropagation()}>
            <button className="float-right rounded-full border border-[var(--teal)] px-3 py-1 text-[var(--teal)]" onClick={() => setDrawer(false)}>×</button>
            <h2 className="text-2xl font-semibold">Whole Foods Market</h2>
            <p className="mt-2 text-[var(--muted)]">WHOLE FOODS MARKET #123</p>
            <div className="my-8 flex justify-between border-b border-[var(--border)] pb-6"><span className="text-[var(--muted)]">Amount</span><strong className="text-3xl">-$87.42</strong></div>
            <Section title="Imported Data" rows={[["Raw merchant", "WHOLE FOODS MARKET #123"], ["Raw amount", "-87.42"], ["Imported on", "Jul 8, 2026"]]} />
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Normalized Values</h3>
              {["Merchant", "Category", "Transaction type", "Notes"].map((label, index) => <label key={label} className="block text-sm text-[var(--muted)]">{label}<input className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]" defaultValue={["Whole Foods Market", "Groceries", "Debit", ""][index]} placeholder="Add a note..." /></label>)}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {["Match Transfer", "Split", "Exclude", "Merchant Rule"].map((label) => <Button key={label} variant="secondary">{label}</Button>)}
            </div>
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}

function Section({ title, rows }: { title: string; rows: string[][] }) {
  return <div><h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{title}</h3><div className="space-y-3">{rows.map(([a,b]) => <div key={a} className="flex justify-between gap-8"><span className="text-[var(--muted)]">{a}</span><code>{b}</code></div>)}</div></div>;
}
