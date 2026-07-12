import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader } from "@/components/data-display/primitives";
import { workspaceState } from "@/server/data/repositories";
import { recurringDashboard } from "@/server/data/recurring";
import { RecurringClient } from "./recurring-client";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const data = await recurringDashboard();
  const state = await workspaceState();
  return (
    <AppShell>
      <PageHeader
        title="Recurring Expenses"
        subtitle="Local pattern detection for subscriptions and recurring bills"
        workspaceState={state}
      />
      {state === "EMPTY" ? (
        <Card className="mb-5 p-6">
          <h2 className="text-xl font-semibold">No recurring expenses detected.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Import transactions to let the local recurring detector find patterns.
          </p>
        </Card>
      ) : null}
      <RecurringClient data={JSON.parse(JSON.stringify(data))} />
    </AppShell>
  );
}
