import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { cashBars, overviewComparison, pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import {
  accountSummaries,
  dataQualityRules,
  householdTransactionSummary,
} from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function Home() {
  const meta = pageMeta["/"];
  const household = await getHousehold();
  const state = await workspaceState();
  const isEmpty = state === "EMPTY";
  const accountSummary = accountSummaries(household.accounts);
  const transactionSummary = householdTransactionSummary(household.transactions);
  const quality = dataQualityRules({
    transactions: household.transactions,
    accounts: household.accounts,
    goals: household.goals,
    asOf: new Date("2026-07-11"),
  });
  const summaryCards = [
    {
      label: "Available Cash",
      value: formatMoney(accountSummary.totalAssetsMinor),
      detail: `${accountSummary.activeCount} active accounts`,
    },
    {
      label: "Total Debt",
      value: formatMoney(accountSummary.totalDebtsMinor),
      detail: "Active debt accounts",
      tone: "critical" as const,
    },
    {
      label: "Net Worth",
      value: formatMoney(accountSummary.netWorthMinor),
      detail: "Assets minus debts",
      featured: true,
    },
    {
      label: "Household Income",
      value: formatMoney(transactionSummary.householdIncomeMinor),
      detail: "Confirmed transfers excluded",
    },
    {
      label: "Household Spending",
      value: formatMoney(transactionSummary.householdSpendingMinor),
      detail: "Confirmed transfers excluded",
    },
    {
      label: "Needs Review",
      value: String(quality.unreviewed),
      detail: `${quality.uncategorized} uncategorized`,
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
                  <div
                    key={label}
                    className="grid gap-3 md:grid-cols-[190px_1fr_130px] md:items-center"
                  >
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
                    <span
                      className={
                        delta.includes("+") ? "text-[var(--green)]" : "text-[var(--muted)]"
                      }
                    >
                      {delta}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Pill tone="warn">Moderate confidence</Pill>
              </div>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
