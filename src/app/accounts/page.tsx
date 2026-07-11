import { AppShell } from "@/components/app-shell/app-shell";
import { MetricCard, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { accountSummaries } from "@/domain/summaries/calculations";
import { formatMoney } from "@/domain/money/money";
import { getHousehold } from "@/server/data/repositories";
import { AccountsClient } from "./accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const household = await getHousehold();
  const summary = accountSummaries(household.accounts);
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/accounts"].title}
        subtitle={`${household.accounts.length} accounts · SQLite`}
      />
      <div className="mb-7 grid gap-4 md:grid-cols-3">
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
      <AccountsClient
        householdId={household.id}
        accounts={JSON.parse(JSON.stringify(household.accounts))}
      />
    </AppShell>
  );
}
