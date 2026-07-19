import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import { categoryBudgetSummaries, currentPeriodSummary } from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { ReportControls } from "./report-controls";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const raw = await searchParams;
  const household = await getHousehold();
  const state = await workspaceState();
  const months = availableMonths(household.transactions);
  const requestedMonth = typeof raw.month === "string" ? raw.month : months[0]?.value;
  const month = months.some((option) => option.value === requestedMonth)
    ? requestedMonth!
    : (months[0]?.value ?? new Date().toISOString().slice(0, 7));
  const asOf = new Date(`${month}-15T00:00:00.000Z`);
  const view = raw.view === "CATEGORIES" ? "CATEGORIES" : "SUMMARY";
  const comparison =
    raw.comparison === "PRIOR_MONTH" || raw.comparison === "PRIOR_YEAR" ? raw.comparison : "NONE";
  const period = currentPeriodSummary(household.transactions, asOf);
  const categoryRows = categoryBudgetSummaries(household.categories, household.transactions, asOf)
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
          <ReportControls
            month={month}
            months={months}
            view={view}
            comparison={comparison}
            report={{
              periodLabel: monthLabel(month),
              income: formatMoney(period.currentSummary.householdIncomeMinor),
              spending: formatMoney(period.currentSummary.householdSpendingMinor),
              netCashFlow: formatMoney(period.currentSummary.netCashFlowMinor),
              savingsRate: `${savingsRate}%`,
              categories: categoryRows.map((row) => ({
                category: row.name,
                spending: formatMoney(row.actualMinor),
              })),
            }}
          />
          {view === "SUMMARY" ? (
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
          ) : null}
          {comparison !== "NONE" ? (
            <ComparisonCard
              comparison={comparison}
              current={period.currentSummary}
              compared={
                comparison === "PRIOR_MONTH"
                  ? period.priorSummary
                  : currentPeriodSummary(
                      household.transactions,
                      new Date(Date.UTC(asOf.getUTCFullYear() - 1, asOf.getUTCMonth(), 15)),
                    ).currentSummary
              }
            />
          ) : null}
          <Card className="p-6">
            <h2 className="text-xl font-semibold">Spending by Category</h2>
            <p className="mb-8 text-[var(--muted)]">
              {monthLabel(month)}, transfers and credit-card payments excluded
            </p>
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

type Summary = ReturnType<typeof currentPeriodSummary>["currentSummary"];

function ComparisonCard({
  comparison,
  current,
  compared,
}: {
  comparison: "PRIOR_MONTH" | "PRIOR_YEAR";
  current: Summary;
  compared: Summary;
}) {
  return (
    <Card className="mb-7 p-6">
      <h2 className="text-lg font-semibold">
        Compared with {comparison === "PRIOR_MONTH" ? "prior month" : "same month last year"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <ComparisonMetric
          label="Income change"
          value={current.householdIncomeMinor - compared.householdIncomeMinor}
        />
        <ComparisonMetric
          label="Spending change"
          value={current.householdSpendingMinor - compared.householdSpendingMinor}
        />
        <ComparisonMetric
          label="Cash-flow change"
          value={current.netCashFlowMinor - compared.netCashFlowMinor}
        />
      </div>
    </Card>
  );
}

function ComparisonMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`text-xl font-semibold ${value >= 0 ? "text-emerald-700" : "text-red-700"}`}>
        {value >= 0 ? "+" : ""}
        {formatMoney(value)}
      </p>
    </div>
  );
}

function availableMonths(transactions: { transactionDate: Date | string }[]) {
  const values = [
    ...new Set(
      transactions.map((transaction) =>
        new Date(transaction.transactionDate).toISOString().slice(0, 7),
      ),
    ),
  ]
    .sort()
    .reverse();
  return values.map((value) => ({ value, label: monthLabel(value) }));
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-15T00:00:00.000Z`));
}
