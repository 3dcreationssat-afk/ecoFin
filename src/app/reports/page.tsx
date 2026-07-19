import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import { categoryBudgetSummaries, currentPeriodSummary } from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const household = await getHousehold();
  const state = await workspaceState();
  const period = currentPeriodSummary(household.transactions);
  const categoryRows = categoryBudgetSummaries(household.categories, household.transactions)
    .filter((row) => row.actualMinor > 0)
    .sort((a, b) => b.actualMinor - a.actualMinor)
    .slice(0, 8);
  const maxCategoryActual = Math.max(1, ...categoryRows.map((row) => row.actualMinor));
  const savingsRate =
    period.currentSummary.householdIncomeMinor <= 0
      ? 0
      : Math.round(
          (period.currentSummary.netCashFlowMinor / period.currentSummary.householdIncomeMinor) *
            100,
        );
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/reports"].title}
        subtitle={pageMeta["/reports"].subtitle}
        workspaceState={state}
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">
            Reports will appear after transactions are added.
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Import transactions to populate local reporting views.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-7 flex flex-wrap items-center gap-3">
            <span className="text-[var(--muted)]">Period: current month</span>
          </div>
          <div className="metric-grid mb-7">
            <MetricCard
              label="Income"
              value={formatMoney(period.currentSummary.householdIncomeMinor)}
            />
            <MetricCard
              label="Spending"
              value={formatMoney(period.currentSummary.householdSpendingMinor)}
            />
            <MetricCard
              label="Net cash flow"
              value={formatMoney(period.currentSummary.netCashFlowMinor)}
              tone={period.currentSummary.netCashFlowMinor >= 0 ? "positive" : "critical"}
            />
            <MetricCard label="Savings rate" value={`${savingsRate}%`} />
          </div>
          <Card className="p-6">
            <h2 className="text-xl font-semibold">Spending by Category</h2>
            <p className="mb-8 text-[var(--muted)]">Current month, transfers excluded</p>
            <div className="space-y-4">
              {categoryRows.map((row) => (
                <div key={row.id} className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <div className="text-right text-sm text-[var(--muted)]">{row.name}</div>
                  <div className="h-8 rounded bg-[var(--surface-muted)]">
                    <div
                      className="h-8 rounded bg-[var(--teal)]"
                      style={{
                        width: `${Math.max(4, (row.actualMinor / maxCategoryActual) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between pl-[156px] text-sm text-[var(--muted)]">
              <span>$0</span>
              <span>{formatMoney(maxCategoryActual)}</span>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
