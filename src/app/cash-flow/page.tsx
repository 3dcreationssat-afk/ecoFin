import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { getCashFlowProjection } from "@/server/data/cash-flow";
import { CashFlowClient } from "./cash-flow-client";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  await getHousehold();
  const state = await workspaceState();
  const projection = state === "EMPTY" ? null : await getCashFlowProjection();
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
        <CashFlowClient projection={projection!} />
      )}
    </AppShell>
  );
}
