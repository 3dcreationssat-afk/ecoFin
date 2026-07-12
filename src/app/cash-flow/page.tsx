import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { accountSummaries, currentPeriodSummary } from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { CashFlowClient } from "./cash-flow-client";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  const household = await getHousehold();
  const state = await workspaceState();
  const accountSummary = accountSummaries(household.accounts);
  const period = currentPeriodSummary(household.transactions);
  const timeline = [
    {
      day: "Month start",
      balance: accountSummary.availableCashMinor - period.currentSummary.netCashFlowMinor,
    },
    { day: "Current", balance: accountSummary.availableCashMinor },
    {
      day: "Preliminary month-end",
      balance: accountSummary.availableCashMinor + period.currentSummary.netCashFlowMinor,
    },
  ];
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/cash-flow"].title}
        subtitle={pageMeta["/cash-flow"].subtitle}
        workspaceState={state}
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">
            Cash-flow views will appear after data is added.
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add accounts and transactions before reviewing cash timing.
          </p>
        </Card>
      ) : (
        <CashFlowClient
          currentCashMinor={accountSummary.availableCashMinor}
          recordedIncomeMinor={period.currentSummary.householdIncomeMinor}
          recordedSpendingMinor={period.currentSummary.householdSpendingMinor}
          projectedMonthEndMinor={
            accountSummary.availableCashMinor + period.currentSummary.netCashFlowMinor
          }
          timeline={timeline}
        />
      )}
    </AppShell>
  );
}
