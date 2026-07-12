import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import { goalSummaries } from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { GoalsClient } from "./goals-client";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const household = await getHousehold();
  const state = await workspaceState();
  const summary = goalSummaries(household.goals);
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/goals"].title}
        subtitle={`${household.goals.length} goals tracked locally`}
        workspaceState={state}
      />
      {state === "EMPTY" ? (
        <Card className="mb-7 p-6">
          <h2 className="text-xl font-semibold">No goals yet.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create a goal when you are ready to track a savings target.
          </p>
        </Card>
      ) : (
        <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total saved" value={formatMoney(summary.totalSavedMinor)} />
          <MetricCard label="Total target" value={formatMoney(summary.totalTargetMinor)} />
          <MetricCard label="Monthly planned" value={formatMoney(summary.plannedMonthlyMinor)} />
          <MetricCard label="Overall progress" value={`${summary.progressPercent}%`} featured />
        </div>
      )}
      <GoalsClient
        householdId={household.id}
        accounts={JSON.parse(JSON.stringify(household.accounts))}
        goals={JSON.parse(JSON.stringify(household.goals))}
      />
    </AppShell>
  );
}
