import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import {
  accountSummaries,
  categoryBudgetSummaries,
  currentPeriodSummary,
  goalProgress,
} from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function Home() {
  const meta = pageMeta["/"];
  const household = await getHousehold();
  const state = await workspaceState();
  const isEmpty = state === "EMPTY";
  const accountSummary = accountSummaries(household.accounts);
  const period = currentPeriodSummary(household.transactions);
  const budgetRows = categoryBudgetSummaries(household.categories, household.transactions).slice(
    0,
    8,
  );
  const debtAccounts = household.accounts
    .filter(
      (account) =>
        !account.archivedAt &&
        ["CREDIT", "LOAN", "MORTGAGE"].includes(account.type) &&
        account.balanceMinor < 0,
    )
    .sort((a, b) => (b.aprBasisPoints ?? 0) - (a.aprBasisPoints ?? 0));
  const monthlyMinimumsMinor = debtAccounts.reduce(
    (total, account) => total + (account.minimumPaymentMinor ?? 0),
    0,
  );
  const highestApr = debtAccounts[0]?.aprBasisPoints ?? 0;
  const activeGoals = household.goals.filter((goal) => !goal.archivedAt).slice(0, 4);
  const summaryCards = [
    {
      label: "Available Cash",
      value: formatMoney(accountSummary.availableCashMinor),
      detail: `${accountSummary.cashAccountCount} cash accounts`,
    },
    {
      label: "Projected Month-End",
      value: formatMoney(
        accountSummary.availableCashMinor + period.currentSummary.netCashFlowMinor,
      ),
      detail: "Preliminary: current cash plus recorded net flow",
      featured: true,
    },
    {
      label: "Safe to Save",
      value: "Preliminary",
      detail: "Detailed engine planned before recommendations",
      tone: "warning" as const,
    },
    {
      label: "Safe to Spend",
      value: "Preliminary",
      detail: "Depends on upcoming obligations and buffers",
      tone: "warning" as const,
    },
    {
      label: "Total Debt",
      value: formatMoney(accountSummary.totalDebtsMinor),
      detail: `${debtAccounts.length} debt accounts`,
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
          <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <Card>
              <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
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
                  Details <ArrowRight className="h-4 w-4" />
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
                <Pill tone="warn">Moderate confidence</Pill>
              </div>
            </Card>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between">
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
                {budgetRows.length ? (
                  budgetRows.map((row) => (
                    <a
                      key={row.id}
                      className="grid gap-3 rounded-md border border-[var(--border)] p-3 text-sm md:grid-cols-[160px_1fr_120px_120px]"
                      href={`/transactions?category=${row.id}`}
                    >
                      <span className="font-medium">{row.name}</span>
                      <span className="h-3 rounded bg-[var(--surface-muted)]">
                        <span
                          className="block h-3 rounded bg-[var(--teal)]"
                          style={{ width: `${Math.min(100, row.usedPercent)}%` }}
                        />
                      </span>
                      <span className="text-right">{formatMoney(row.actualMinor)}</span>
                      <span className="text-right text-[var(--muted)]">
                        {formatMoney(row.remainingMinor)} left
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
                    All
                  </a>
                </div>
                <div className="space-y-4">
                  {activeGoals.length ? (
                    activeGoals.map((goal) => (
                      <div key={goal.id}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="font-medium">{goal.name}</span>
                          <span className="text-[var(--muted)]">
                            {formatMoney(goal.currentMinor)} / {formatMoney(goal.targetMinor)}
                          </span>
                        </div>
                        <div className="h-2 rounded bg-[var(--surface-muted)]">
                          <div
                            className="h-2 rounded bg-[var(--teal)]"
                            style={{ width: `${goalProgress(goal)}%` }}
                          />
                        </div>
                      </div>
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
                    Details
                  </a>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Total balance</span>
                    <strong>{formatMoney(accountSummary.totalDebtsMinor)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Monthly minimums</span>
                    <strong>{formatMoney(monthlyMinimumsMinor)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Highest APR</span>
                    <strong>{highestApr ? `${(highestApr / 100).toFixed(2)}%` : "Not set"}</strong>
                  </div>
                  <p className="pt-2 text-xs text-[var(--muted)]">
                    Payoff estimates remain preliminary until the validated debt engine is enabled.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
