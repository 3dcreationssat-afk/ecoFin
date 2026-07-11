import { FileDown, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader } from "@/components/data-display/primitives";
import { pageMeta, reportBars } from "@/data/demo";

export default function ReportsPage() {
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/reports"].title}
        subtitle={pageMeta["/reports"].subtitle}
        action={
          <div className="flex gap-3">
            <Button variant="secondary" disabled title="Print export is planned">
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="secondary" disabled title="CSV export is planned">
              <FileDown className="h-4 w-4" /> CSV
            </Button>
            <Button variant="secondary" disabled title="HTML export is planned">
              <FileDown className="h-4 w-4" /> HTML
            </Button>
          </div>
        }
      />
      <div className="mb-7 flex flex-wrap items-center gap-3">
        <select className="h-11 rounded-md border border-[var(--border)] bg-white px-4">
          <option>Monthly Summary</option>
        </select>
        <select className="h-11 rounded-md border border-[var(--border)] bg-white px-4">
          <option>vs. Prior Month</option>
        </select>
        <span className="text-[var(--muted)]">Period: July 2026</span>
      </div>
      <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Income" value="$4,850.00" />
        <MetricCard label="Spending" value="$2,980.44" />
        <MetricCard label="Net cash flow" value="-$820.44" tone="critical" />
        <MetricCard label="Savings rate" value="29.9%" />
      </div>
      <Card className="p-6">
        <h2 className="text-xl font-semibold">Income vs. Spending by Category</h2>
        <p className="mb-8 text-[var(--muted)]">July 2026</p>
        <div className="space-y-4">
          {reportBars.map(([label, value, color]) => (
            <div key={label} className="grid grid-cols-[140px_1fr] items-center gap-4">
              <div className="text-right text-sm text-[var(--muted)]">{label}</div>
              <div className="h-8 rounded bg-[var(--surface-muted)]">
                <div
                  className={`${color} h-8 rounded`}
                  style={{ width: `${Math.max(4, (value / 1800) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between pl-[156px] text-sm text-[var(--muted)]">
          <span>$0</span>
          <span>$450</span>
          <span>$900</span>
          <span>$1350</span>
          <span>$1800</span>
        </div>
      </Card>
    </AppShell>
  );
}
