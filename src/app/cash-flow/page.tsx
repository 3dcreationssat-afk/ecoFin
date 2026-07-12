import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { getCashFlowProjection } from "@/server/data/cash-flow";
import { matchSuggestions, planningDashboard } from "@/server/data/planning";
import { PlanningClient } from "./planning-client";
import { CashFlowClient } from "./cash-flow-client";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  await getHousehold();
  const state = await workspaceState();
  const projection = state === "EMPTY" ? null : await getCashFlowProjection();
  const planning = state === "EMPTY" ? null : await planningDashboard();
  const suggestions = state === "EMPTY" ? [] : await matchSuggestions();
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
            Add an account, expected income, and your first obligation, then configure a savings
            policy before reviewing cash timing.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/accounts" className="rounded-md border px-3 py-2 text-sm font-semibold">
              Add an account
            </a>
            <span className="rounded-md border px-3 py-2 text-sm">Add expected income</span>
            <span className="rounded-md border px-3 py-2 text-sm">Add first obligation</span>
            <span className="rounded-md border px-3 py-2 text-sm">Configure savings policy</span>
          </div>
        </Card>
      ) : (
        <>
          <CashFlowClient projection={projection!} />
          <PlanningClient
            householdId={planning!.id}
            incomes={planning!.expectedIncomeSchedules}
            obligations={planning!.scheduledObligations}
            policy={planning!}
            suggestions={suggestions}
          />
        </>
      )}
    </AppShell>
  );
}
