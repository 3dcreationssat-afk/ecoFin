import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { cashBars, overviewComparison, pageMeta, summaryCards } from "@/data/demo";

export default function Home() {
  const meta = pageMeta["/"];
  return (
    <AppShell>
      <PageHeader title={meta.title} subtitle={meta.subtitle} />
      <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
        <Card>
          <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
            <div>
              <h2 className="text-xl font-semibold">Monthly Cash Flow</h2>
              <p className="text-sm text-[var(--muted)]">Income versus outflows this month</p>
            </div>
            <Button variant="secondary">
              Details <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-5 p-6">
            {cashBars.map(([label, value, width]) => (
              <div key={label} className="grid gap-3 md:grid-cols-[190px_1fr_130px] md:items-center">
                <div className="text-sm text-[var(--muted)]">{label}</div>
                <div className="h-9 rounded-md bg-[var(--surface-muted)]">
                  <div className={`${width} h-9 rounded-md`} />
                </div>
                <div className="text-right font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">vs. Last Month</h2>
          <p className="mb-8 text-sm text-[var(--muted)]">June 2026 comparison</p>
          <div className="space-y-5">
            {overviewComparison.map(([label, value, delta]) => (
              <div key={label} className="flex items-center justify-between gap-6">
                <span className="text-[var(--muted)]">{label}</span>
                <span className="ml-auto font-medium">{value}</span>
                <span className={delta.includes("+") ? "text-[var(--green)]" : "text-[var(--muted)]"}>{delta}</span>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Pill tone="warn">Moderate confidence</Pill>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

