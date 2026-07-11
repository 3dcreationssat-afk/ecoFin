import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";

export default function DecisionsPage() {
  return (
    <AppShell>
      <PageHeader title={pageMeta["/decisions"].title} subtitle={pageMeta["/decisions"].subtitle} />
      <div className="mb-6 flex flex-wrap gap-3">{["Add vehicle payment", "Cancel 3 subscriptions", "Increase debt payments"].map((x, i) => <button key={x} className={`rounded-md px-4 py-2 ${i === 0 ? "bg-[var(--teal)] text-white" : "border border-[var(--border)] bg-white"}`}>{x}</button>)}<Button variant="secondary"><Plus className="h-4 w-4" /> New Scenario</Button></div>
      <div className="grid gap-6 xl:grid-cols-[520px_1fr]">
        <Card className="p-6"><div className="mb-8 flex justify-between"><div><h2 className="text-xl font-semibold">Scenario Assumptions</h2><p className="text-[var(--muted)]">Changes are isolated; they do not affect your real data</p></div><Pill tone="info">Isolated</Pill></div><label className="text-sm text-[var(--muted)]">Scenario name<input className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-4 text-[var(--text)]" defaultValue="Add vehicle payment" /></label><div className="mt-6 grid grid-cols-2 gap-3">{["Add vehicle payment","Make a down payment","Cancel subscriptions","Increase debt payments","Change income","Add childcare cost","Make a one-time purchase","Increase savings"].map((x) => <button key={x} className="rounded-md border border-[var(--border)] px-4 py-3 text-left text-sm"><span className="text-[var(--teal)]">+ </span>{x}</button>)}</div><div className="mt-8 border-t border-[var(--border)] pt-5"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Active Components</div><div className="mt-4 flex justify-between"><div><strong>Vehicle payment</strong><p className="text-sm text-[var(--muted)]">Auto loan · 48 months</p></div><strong>-$460.00/mo</strong><Trash2 className="h-5 w-5" /></div></div></Card>
        <Card className="overflow-hidden"><div className="border-b border-[var(--border)] p-6"><h2 className="text-xl font-semibold">Before & After</h2><p className="text-sm text-[var(--muted)]">Current plan vs. scenario impact</p></div><table className="w-full text-left"><thead className="text-[var(--muted)]"><tr>{["Metric","Current plan","Scenario","Difference"].map((h) => <th key={h} className="px-6 py-4">{h}</th>)}</tr></thead><tbody>{[["Monthly cash flow","-$820.44","-$1,280.44","-$460.00"],["Safe to save","$1,450.00","$990.00","-$460.00"],["Safe to spend","$612.40","$226.40","-$386.00"],["Projected month-end","$6,380.22","$5,920.22","-$460.00"],["Emergency fund runway","4.2 mo","3.8 mo","-0.4 mo"],["Debt-free date","Jun 2046","Jun 2046","No change"],["Goal completion","Dec 2026","Mar 2027","Delayed"]].map((row) => <tr key={row[0]} className="border-t border-[var(--border)]">{row.map((cell, i) => <td key={i} className={`px-6 py-4 ${i === 3 && cell !== "No change" ? "text-[var(--red)]" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></Card>
      </div>
    </AppShell>
  );
}
