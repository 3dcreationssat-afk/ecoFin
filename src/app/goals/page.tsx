import { AlertTriangle, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { goals, pageMeta } from "@/data/demo";

export default function GoalsPage() {
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/goals"].title}
        subtitle={pageMeta["/goals"].subtitle}
        action={
          <Button disabled title="Goal creation is planned">
            <Plus className="h-4 w-4" /> Add Goal
          </Button>
        }
      />
      <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total saved" value="$13,200" />
        <MetricCard label="Total target" value="$29,500" />
        <MetricCard label="Monthly planned" value="$1,150.00" />
        <MetricCard
          label="Monthly required"
          value="$1,212.00"
          tone="warning"
          detail="$62.00 short"
        />
      </div>
      <Card className="mb-7 flex gap-4 bg-[var(--amber-soft)] p-6 text-[var(--amber)]">
        <AlertTriangle className="h-6 w-6" />
        <div>
          <strong>Your goals compete for limited savings</strong>
          <p className="text-[var(--muted)]">
            You are planning $1,150.00/mo but need $1,212.00/mo to stay on track for all goals.
          </p>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        {goals.map(([name, account, saved, target, pct, planned, required, status]) => (
          <Card key={name} className="p-6">
            <div className="mb-8 flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">{name}</h2>
                <p className="text-sm text-[var(--muted)]">{account}</p>
              </div>
              <Pill tone={status === "On track" ? "good" : "warn"}>{status}</Pill>
            </div>
            <div className="flex items-end justify-between">
              <strong className="text-3xl">{saved}</strong>
              <span className="text-[var(--muted)]">{target}</span>
            </div>
            <div className="my-3 h-2 rounded bg-[var(--surface-muted)]">
              <div className="h-2 w-[56%] rounded bg-[var(--teal)]" />
            </div>
            <p className="text-sm text-[var(--muted)]">{pct}</p>
            <div className="mt-7 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--muted)]">Planned / mo</span>
                <div className="font-semibold">{planned}</div>
              </div>
              <div>
                <span className="text-[var(--muted)]">Required / mo</span>
                <div className="font-semibold">{required}</div>
              </div>
            </div>
            <button
              disabled
              title="Goal contributions are planned"
              className="mt-6 h-10 w-full cursor-not-allowed rounded-md border border-[var(--border)] opacity-60"
            >
              Contribute · Planned
            </button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
