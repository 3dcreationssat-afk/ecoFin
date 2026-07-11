import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader, Pill } from "@/components/data-display/primitives";
import { confidenceAreas, pageMeta } from "@/data/demo";

export default function DataQualityPage() {
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/data-quality"].title}
        subtitle={pageMeta["/data-quality"].subtitle}
      />
      <Card className="mb-7 flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-5">
          <div className="rounded-lg bg-[var(--amber-soft)] p-4">
            <ShieldCheck className="h-7 w-7 text-[var(--amber)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              Overall confidence: Moderate <Pill tone="warn">Moderate confidence</Pill>
            </h2>
            <p className="text-[var(--muted)]">
              6 issues found across 6 categories. Some calculations may be affected.
            </p>
          </div>
        </div>
        <div className="flex gap-8 text-center">
          <div>
            <strong className="text-3xl text-[var(--red)]">0</strong>
            <p className="text-sm text-[var(--muted)]">Critical</p>
          </div>
          <div>
            <strong className="text-3xl text-[var(--amber)]">3</strong>
            <p className="text-sm text-[var(--muted)]">Warnings</p>
          </div>
          <div>
            <strong className="text-3xl text-[var(--blue)]">3</strong>
            <p className="text-sm text-[var(--muted)]">Info</p>
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-xl font-semibold">Confidence by Area</h2>
        <p className="mb-8 text-[var(--muted)]">How reliable each calculation is</p>
        <div className="space-y-5">
          {confidenceAreas.map(([label, value, color]) => (
            <div key={label} className="grid gap-3 md:grid-cols-[220px_1fr_60px] md:items-center">
              <span>{label}</span>
              <div className="h-2 rounded bg-[var(--surface-muted)]">
                <div className={`${color} h-2 rounded`} style={{ width: `${value}%` }} />
              </div>
              <span className="text-right text-[var(--muted)]">{value}%</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-7 p-6">
        <h2 className="text-xl font-semibold">Issues Found</h2>
        <p className="text-[var(--muted)]">Each issue may affect specific calculations</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            [
              "3 uncategorized transactions",
              "Spending by category and budget tracking may be understated.",
              "Review merchant categories when transaction persistence is implemented.",
            ],
            [
              "1 unconfirmed recurring expense",
              "Safe to Save and cash-flow projections may miss a future obligation.",
              "Confirm recurring status before relying on savings guidance.",
            ],
            [
              "Auto loan balance last updated Jun 30",
              "Debt totals and payoff estimates may be stale.",
              "Refresh or edit the account balance when account persistence is implemented.",
            ],
          ].map(([title, impact, action]) => (
            <div key={title} className="rounded-md border border-[var(--border)] p-4">
              <Pill tone="warn">Warning</Pill>
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{impact}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{action}</p>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
