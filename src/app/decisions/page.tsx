import { AppShell } from "@/components/app-shell/app-shell";
import { PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { decisionSimulatorDashboard } from "@/server/data/decision-scenarios";
import { workspaceState } from "@/server/data/repositories";
import { DecisionsClient } from "./decisions-client";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const [{ scenario }, state] = await Promise.all([searchParams, workspaceState()]);
  const dashboard = await decisionSimulatorDashboard(scenario);
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/decisions"].title}
        subtitle="Compare isolated assumptions with your validated current plan"
        workspaceState={state}
      />
      <DecisionsClient dashboard={dashboard} emptyWorkspace={state === "EMPTY"} />
    </AppShell>
  );
}
