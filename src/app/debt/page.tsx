import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { debts, pageMeta } from "@/data/demo";
import { workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const state = await workspaceState();
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/debt"].title}
        subtitle={pageMeta["/debt"].subtitle}
        workspaceState={state}
        action={
          <Button disabled title="Debt creation is planned">
            <Plus className="h-4 w-4" /> Add Debt
          </Button>
        }
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Debt planning will appear after data is added.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add debt accounts before reviewing payoff order and strategy impact.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-7 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total balance" value="$270,251" />
            <MetricCard label="Monthly minimums" value="$2,160.00" />
            <MetricCard label="Weighted APR" value="4.08%" />
            <MetricCard label="Highest APR" value="21.49%" tone="critical" />
            <MetricCard label="Est. payoff date" value="Jun 2046" />
            <MetricCard label="Est. remaining interest" value="$142,800" />
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--muted)]">Payoff Strategy</h2>
              <div
                className="mt-3 flex rounded-md border border-[var(--border)] bg-white p-1"
                aria-label="Demonstration payoff strategy"
              >
                <button
                  disabled
                  title="Strategy switching is demonstration-only"
                  className="rounded bg-[var(--surface-muted)] px-4 py-2"
                >
                  Avalanche
                </button>
                <button
                  disabled
                  title="Strategy switching is demonstration-only"
                  className="px-4 py-2 text-[var(--muted)]"
                >
                  Snowball
                </button>
                <button
                  disabled
                  title="Strategy switching is demonstration-only"
                  className="px-4 py-2 text-[var(--muted)]"
                >
                  Custom
                </button>
              </div>
            </div>
            <label className="text-[var(--muted)]">
              Extra monthly payment{" "}
              <input disabled type="range" defaultValue="200" className="mx-3 align-middle" />{" "}
              <strong className="text-[var(--text)]">$200.00</strong>
            </label>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
            <Card className="p-6">
              <h2 className="text-xl font-semibold">Payoff Order</h2>
              <p className="mb-6 text-sm text-[var(--muted)]">
                Avalanche strategy with $200.00/mo extra
              </p>
              <div className="space-y-4">
                {debts.map(([n, name, type, detail, balance, payment]) => (
                  <div
                    key={name}
                    className="flex items-center gap-4 rounded-lg border border-[var(--border)] p-4"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--teal)] font-semibold text-white">
                      {n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {name} <Pill>{type}</Pill>
                      </div>
                      <div className="text-sm text-[var(--muted)]">{detail}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{balance}</div>
                      <div className="text-sm text-[var(--muted)]">{payment}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="text-xl font-semibold">Strategy Impact</h2>
              <p className="mb-10 text-sm text-[var(--muted)]">With $200.00/mo extra</p>
              {[
                ["Est. debt-free date", "Mar 2031"],
                ["Est. total interest", "$89,200"],
                ["Interest saved vs. minimums", "$53,600"],
                ["Time saved", "15 years"],
                ["Total monthly payment", "$2,360.00"],
              ].map(([a, b]) => (
                <div key={a} className="flex justify-between border-b border-[var(--border)] py-5">
                  <span className="text-[var(--muted)]">{a}</span>
                  <strong
                    className={b.includes("$53") || b.includes("15") ? "text-[var(--green)]" : ""}
                  >
                    {b}
                  </strong>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
