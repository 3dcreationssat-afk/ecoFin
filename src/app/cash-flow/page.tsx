import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { getCashFlowProjection } from "@/server/data/cash-flow";
import { forecastRuleDashboard } from "@/server/data/forecast-rules";
import { CashFlowIntelligenceClient } from "./cash-flow-intelligence-client";
import { detectForecastRules } from "@/server/data/forecast-rules";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  await getHousehold();
  const state = await workspaceState();
  if (state !== "EMPTY") await detectForecastRules();
  const projection = state === "EMPTY" ? null : await getCashFlowProjection();
  const setup = state === "EMPTY" ? null : await forecastRuleDashboard();
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
          <CashFlowIntelligenceClient
            projection={projection!}
            householdId={setup!.household.id}
            rules={setup!.rules}
            accounts={setup!.accounts}
          />
        </>
      )}
    </AppShell>
  );
}
