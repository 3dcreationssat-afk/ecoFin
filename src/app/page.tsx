import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import { buildOverviewDashboard, type OverviewSeverity } from "@/domain/overview/dashboard";
import { accountSummaries, currentPeriodSummary } from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { cashAllocationSummary, getCashFlowProjection } from "@/server/data/cash-flow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const meta = pageMeta["/"];
  const household = await getHousehold();
  const state = await workspaceState();
  const isEmpty = state === "EMPTY";
  const accountSummary = accountSummaries(household.accounts);
  const period = currentPeriodSummary(household.transactions);
  const dashboard = buildOverviewDashboard({ household });
  const cashFlow = isEmpty ? null : await getCashFlowProjection();
  const allocation = cashFlow ? cashAllocationSummary(cashFlow) : null;
  const summaryCards = [
    {
      label: "Available Cash",
      value: formatMoney(accountSummary.availableCashMinor),
      detail: `${accountSummary.cashAccountCount} cash accounts`,
    },
    {
      label: "Projected Month-End",
      value: formatMoney(cashFlow?.projectedMonthEndMinor ?? 0),
      detail: `${cashFlow?.confidence ?? "LIMITED"} confidence · validated projection`,
      featured: true,
    },
    {
      label: "Safe to Save",
      value: formatMoney(allocation?.recommendedSafeToSaveMinor ?? 0),
      detail: `Policy recommendation from ${formatMoney(allocation?.allocatableSurplusMinor ?? 0)} allocatable surplus`,
    },
    {
      label: "Safe to Spend",
      value: formatMoney(allocation?.safeToSpendMinor ?? 0),
      detail: "Allocatable surplus remaining after the recommended transfer",
    },
    {
      label: "Total Debt",
      value: formatMoney(accountSummary.totalDebtsMinor),
      detail: `${household.accounts.filter((account) => !account.archivedAt && ["CREDIT", "LOAN", "MORTGAGE"].includes(account.type) && (account.ledgerBalanceMinor ?? 0) > 0).length} debt accounts`,
      tone: "critical" as const,
    },
  ];
  return (
    <AppShell>
      <PageHeader title={meta.title} subtitle={meta.subtitle} workspaceState={state} />
      {isEmpty ? (
        <Card className="p-7">
          <h2 className="text-2xl font-semibold">Your workspace is ready.</h2>
          <p className="mt-2 text-[var(--muted)]">
            Add accounts, import transactions, or adjust household settings to begin using your own
            local data.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white"
              href="/accounts"
            >
              Add your first account
            </a>
            <a
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              href="/transactions"
            >
              Import transactions
            </a>
            <a
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              href="/settings"
            >
              Configure household settings
            </a>
          </div>
        </Card>
      ) : (
        <>
          <div className="metric-grid mb-7">
            {summaryCards.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-6">
                <div>
                  <h2 className="text-xl font-semibold">Monthly Cash Flow</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Recorded income and spending this month; confirmed transfers excluded
                  </p>
                </div>
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold"
                  href="/cash-flow"
                >
                  View calculation <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <div className="space-y-5 p-6">
                {[
                  {
                    label: "Income received",
                    value: period.currentSummary.householdIncomeMinor,
                    color: "bg-[var(--teal)]",
                  },
                  {
                    label: "Spending",
                    value: -period.currentSummary.householdSpendingMinor,
                    color: "bg-[var(--amber)]",
                  },
                  {
                    label: "Net cash flow",
                    value: period.currentSummary.netCashFlowMinor,
                    color: "bg-sky-500",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="grid gap-3 md:grid-cols-[190px_1fr_130px] md:items-center"
                  >
                    <div className="text-sm text-[var(--muted)]">{label}</div>
                    <div className="h-9 rounded-md bg-[var(--surface-muted)]">
                      <div
                        className={`${color} h-9 rounded-md`}
                        style={{
                          width: `${Math.max(
                            6,
                            Math.min(
                              100,
                              (Math.abs(value) /
                                Math.max(
                                  1,
                                  period.currentSummary.householdIncomeMinor,
                                  period.currentSummary.householdSpendingMinor,
                                )) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="text-right font-semibold">{formatMoney(value)}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="text-xl font-semibold">vs. Last Month</h2>
              <p className="mb-8 text-sm text-[var(--muted)]">Prior month comparison</p>
              <div className="space-y-5">
                {[
                  {
                    label: "Income",
                    value: period.currentSummary.householdIncomeMinor,
                    delta:
                      period.currentSummary.householdIncomeMinor -
                      period.priorSummary.householdIncomeMinor,
                    higherIsGood: true,
                  },
                  {
                    label: "Spending",
                    value: period.currentSummary.householdSpendingMinor,
                    delta:
                      period.currentSummary.householdSpendingMinor -
                      period.priorSummary.householdSpendingMinor,
                    higherIsGood: false,
                  },
                  {
                    label: "Net cash flow",
                    value: period.currentSummary.netCashFlowMinor,
                    delta:
                      period.currentSummary.netCashFlowMinor - period.priorSummary.netCashFlowMinor,
                    higherIsGood: true,
                  },
                ].map(({ label, value, delta, higherIsGood }) => (
                  <div key={label} className="flex items-center justify-between gap-6">
                    <span className="text-[var(--muted)]">{label}</span>
                    <span className="ml-auto font-medium">{formatMoney(value)}</span>
                    <span
                      className={
                        delta >= 0 === higherIsGood ? "text-[var(--green)]" : "text-[var(--red)]"
                      }
                    >
                      {delta >= 0 ? "+" : ""}
                      {formatMoney(delta)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Pill tone={cashFlow?.confidence === "HIGH" ? "good" : "warn"}>
                  {cashFlow?.confidence ?? "LIMITED"} confidence
                </Pill>
              </div>
            </Card>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <Card className="p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Needs Your Attention</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Repository-derived items that may require action
                  </p>
                </div>
                <a className="text-sm font-semibold text-[var(--teal)]" href="/data-quality">
                  View all
                </a>
              </div>
              <div className="space-y-3">
                {dashboard.visibleActionItems.length ? (
                  dashboard.visibleActionItems.map((item) => (
                    <a
                      key={item.id}
                      className="grid min-w-0 gap-3 rounded-md border border-[var(--border)] p-4 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                      href={item.href}
                      aria-label={`${item.severity}: ${item.title}. ${item.actionLabel}`}
                    >
                      <span className="min-w-0">
                        <span className="mb-1 flex flex-wrap items-center gap-2">
                          <strong>{item.title}</strong>
                          <Pill tone={severityTone(item.severity)}>{item.severity}</Pill>
                        </span>
                        <span className="block text-[var(--muted)]">{item.explanation}</span>
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {item.impact}
                        </span>
                      </span>
                      <span className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border)] px-3 font-semibold">
                        {item.actionLabel}
                      </span>
                    </a>
                  ))
                ) : (
                  <p className="rounded-md border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                    No urgent action items from current local records.
                  </p>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="text-xl font-semibold">Upcoming Obligations</h2>
              <p className="mb-5 text-sm text-[var(--muted)]">Next 30 days from persisted data</p>
              <div className="space-y-4">
                {dashboard.upcomingObligations.length ? (
                  dashboard.upcomingObligations.slice(0, 7).map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-2 border-b border-[var(--border)] pb-4 text-sm last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <strong>{item.displayName}</strong>
                          <p className="text-[var(--muted)]">
                            {formatDate(item.dueDate)} · {item.accountName ?? item.obligationType}
                          </p>
                        </div>
                        <strong>{formatMoney(item.amountMinor)}</strong>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={item.confidence === "High" ? "good" : "warn"}>
                          {item.confidence} confidence
                        </Pill>
                        <Pill tone={item.reservedStatus === "Planned" ? "info" : "neutral"}>
                          {item.reservedStatus}
                        </Pill>
                      </div>
                      {item.explanation ? (
                        <p className="text-xs text-[var(--muted)]">{item.explanation}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                    No account minimums or confirmed recurring expenses are due in the next 30 days.
                  </p>
                )}
              </div>
            </Card>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <Card className="p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Spending by Category</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Current-period actuals versus budget
                  </p>
                </div>
                <a className="text-sm font-semibold text-[var(--teal)]" href="/budget">
                  Full breakdown
                </a>
              </div>
              <div className="space-y-3">
                {dashboard.categorySpending.length ? (
                  dashboard.categorySpending.map((row) => (
                    <a
                      key={row.id}
                      className="grid min-w-0 gap-3 rounded-md border border-[var(--border)] p-3 text-sm lg:grid-cols-[160px_minmax(0,1fr)_110px_110px_150px]"
                      href={row.href}
                    >
                      <span className="font-medium">{row.name}</span>
                      <span className="h-3 rounded bg-[var(--surface-muted)]">
                        <span
                          className="block h-3 rounded bg-[var(--teal)]"
                          style={{ width: `${Math.min(100, Math.max(4, row.usedPercent))}%` }}
                        />
                      </span>
                      <span className="text-right">{formatMoney(row.actualMinor)}</span>
                      <span className="text-right text-[var(--muted)]">
                        {row.budgetMinor ? formatMoney(row.budgetMinor) : "No budget"}
                      </span>
                      <span className="text-right">
                        <Pill tone={categoryTone(row.status)}>{row.status}</Pill>
                      </span>
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    Add categories and transactions to see spending by category.
                  </p>
                )}
              </div>
            </Card>
            <div className="grid gap-6">
              <Card className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Goals Snapshot</h2>
                  <a className="text-sm font-semibold text-[var(--teal)]" href="/goals">
                    All goals
                  </a>
                </div>
                <div className="space-y-4">
                  {dashboard.goals.length ? (
                    dashboard.goals.map((goal) => (
                      <a key={goal.id} className="block" href={goal.href}>
                        <div className="mb-1 flex flex-wrap justify-between gap-3 text-sm">
                          <span className="font-medium">{goal.name}</span>
                          <Pill tone={goalTone(goal.status)}>{goal.status}</Pill>
                        </div>
                        <div className="mb-1 flex justify-between gap-3 text-sm text-[var(--muted)]">
                          <span>
                            {formatMoney(goal.currentMinor)} / {formatMoney(goal.targetMinor)}
                          </span>
                          <span>{goal.targetDate ? formatDate(goal.targetDate) : "No date"}</span>
                        </div>
                        <div className="h-2 rounded bg-[var(--surface-muted)]">
                          <div
                            className="h-2 rounded bg-[var(--teal)]"
                            style={{ width: `${goal.progressPercent}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Planned {formatMoney(goal.plannedMonthlyMinor)} / mo · Required{" "}
                          {formatMoney(goal.requiredMonthlyMinor)} / mo
                        </p>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No active goals yet.</p>
                  )}
                </div>
              </Card>
              <Card className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Debt Snapshot</h2>
                  <a className="text-sm font-semibold text-[var(--teal)]" href="/debt">
                    Debt planner
                  </a>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--muted)]">Total balance</span>
                    <strong>{formatMoney(dashboard.debt.totalDebtMinor)}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--muted)]">Monthly minimums</span>
                    <strong>{formatMoney(dashboard.debt.monthlyMinimumsMinor)}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--muted)]">Highest APR</span>
                    <strong>{formatApr(dashboard.debt.highestAprBasisPoints)}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--muted)]">Selected strategy</span>
                    <strong>{dashboard.debt.strategy}</strong>
                  </div>
                  <div className="border-t border-[var(--border)] pt-3">
                    <p className="text-xs text-[var(--muted)]">
                      {dashboard.debt.recommendationNote}
                    </p>
                    {dashboard.debt.recommendedDebt ? (
                      <a
                        className="mt-2 flex justify-between gap-4 font-semibold text-[var(--teal)]"
                        href={dashboard.debt.recommendedDebt.href}
                      >
                        <span>{dashboard.debt.recommendedDebt.name}</span>
                        <span>{formatApr(dashboard.debt.recommendedDebt.aprBasisPoints)}</span>
                      </a>
                    ) : (
                      <p className="mt-2 font-semibold">No recommendation available.</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function severityTone(severity: OverviewSeverity) {
  if (severity === "Critical") return "bad";
  if (severity === "Warning") return "warn";
  return "info";
}

function categoryTone(status: string) {
  if (status === "Over budget") return "bad";
  if (status === "Approaching budget") return "warn";
  if (status === "On track") return "good";
  return "neutral";
}

function goalTone(status: string) {
  if (status === "Completed" || status === "On track") return "good";
  if (status === "Behind") return "bad";
  if (status === "At risk") return "warn";
  return "info";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
}

function formatApr(value: number | null) {
  return value == null ? "Not set" : `${(value / 100).toFixed(2)}%`;
}
