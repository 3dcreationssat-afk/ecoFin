import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import { categoryBudgetSummaries } from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const household = await getHousehold();
  const state = await workspaceState();
  const rows = categoryBudgetSummaries(household.categories, household.transactions);
  const totals = rows.reduce(
    (total, row) => ({
      budgetMinor: total.budgetMinor + row.budgetMinor,
      actualMinor: total.actualMinor + row.actualMinor,
      forecastMinor: total.forecastMinor + row.forecastMinor,
      remainingMinor: total.remainingMinor + row.remainingMinor,
    }),
    { budgetMinor: 0, actualMinor: 0, forecastMinor: 0, remainingMinor: 0 },
  );
  const groups = [...new Set(rows.map((row) => row.group))];
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/budget"].title}
        subtitle={pageMeta["/budget"].subtitle}
        workspaceState={state}
        action={
          <Button disabled title="Category creation is planned">
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        }
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Budget views will appear after data is added.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add accounts, categories, and transactions to begin budget comparisons.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Budgeted" value={formatMoney(totals.budgetMinor)} />
            <MetricCard label="Actual" value={formatMoney(totals.actualMinor)} />
            <MetricCard label="Forecast" value={formatMoney(totals.forecastMinor)} />
            <MetricCard
              label="Remaining"
              value={formatMoney(totals.remainingMinor)}
              tone={totals.remainingMinor >= 0 ? "positive" : "critical"}
            />
            <MetricCard label="Forecast method" value="Current pace" detail="Preliminary" />
          </div>
          <div className="space-y-5">
            {groups.map((group) => {
              const groupRows = rows.filter((row) => row.group === group);
              const groupBudget = groupRows.reduce((total, row) => total + row.budgetMinor, 0);
              const groupActual = groupRows.reduce((total, row) => total + row.actualMinor, 0);
              const groupUsed =
                groupBudget <= 0 ? 0 : Math.round((groupActual / groupBudget) * 100);
              return (
                <Card key={group} className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-6">
                    <div>
                      <h2 className="text-xl font-semibold">{group}</h2>
                      <p className="text-sm text-[var(--muted)]">
                        Actual / budget: {formatMoney(groupActual)} / {formatMoney(groupBudget)}
                      </p>
                    </div>
                    <div className="min-w-48">
                      <div className="h-2 rounded bg-[var(--surface-muted)]">
                        <div
                          className="h-2 rounded bg-[var(--teal)]"
                          style={{ width: `${Math.min(100, groupUsed)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-sm text-[var(--muted)]">
                        {groupUsed}% used
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr>
                          {[
                            "Category",
                            "Budgeted",
                            "Actual",
                            "Forecast",
                            "Remaining",
                            "Used",
                            "Status",
                          ].map((head) => (
                            <th key={head} className="px-6 py-4 uppercase tracking-[0.08em]">
                              {head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupRows.map((row) => (
                          <tr key={row.id} className="border-t border-[var(--border)]">
                            <td className="px-6 py-4">{row.name}</td>
                            <td className="px-6 py-4">{formatMoney(row.budgetMinor)}</td>
                            <td className="px-6 py-4">{formatMoney(row.actualMinor)}</td>
                            <td className="px-6 py-4">{formatMoney(row.forecastMinor)}</td>
                            <td
                              className={
                                row.remainingMinor >= 0
                                  ? "px-6 py-4 text-[var(--green)]"
                                  : "px-6 py-4 text-[var(--red)]"
                              }
                            >
                              {formatMoney(row.remainingMinor)}
                            </td>
                            <td className="px-6 py-4">{row.usedPercent}%</td>
                            <td className="px-6 py-4">
                              <Pill
                                tone={
                                  row.status === "Projected over"
                                    ? "bad"
                                    : row.usedPercent >= 90
                                      ? "warn"
                                      : "good"
                                }
                              >
                                {row.status}
                              </Pill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
          <Card className="mt-5 border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
            <strong>Forecast:</strong> current month actuals are projected at the current daily
            pace. This is a preliminary planning signal, not an advanced forecast.
          </Card>
        </>
      )}
    </AppShell>
  );
}
