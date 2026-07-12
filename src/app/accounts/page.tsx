import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { accountSummaries } from "@/domain/summaries/calculations";
import { formatMoney } from "@/domain/money/money";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { AccountsClient } from "./accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const household = await getHousehold();
  const state = await workspaceState();
  const summary = accountSummaries(household.accounts);
  const isEmpty = state === "EMPTY";
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/accounts"].title}
        subtitle={`${household.accounts.length} accounts tracked locally`}
        workspaceState={state}
      />
      {isEmpty ? (
        <Card className="mb-7 p-6">
          <h2 className="text-xl font-semibold">No accounts yet.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add an account to start tracking balances in your local workspace.
          </p>
        </Card>
      ) : (
        <div className="metric-grid mb-7">
          <MetricCard
            label="Total assets"
            value={formatMoney(summary.totalAssetsMinor)}
            tone="positive"
          />
          <MetricCard
            label="Total debts"
            value={formatMoney(summary.totalDebtsMinor)}
            tone="critical"
          />
          <MetricCard label="Net worth" value={formatMoney(summary.netWorthMinor)} featured />
        </div>
      )}
      <AccountsClient
        householdId={household.id}
        accounts={JSON.parse(JSON.stringify(household.accounts))}
      />
    </AppShell>
  );
}
