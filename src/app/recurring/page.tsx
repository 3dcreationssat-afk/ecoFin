import { AppShell } from "@/components/app-shell/app-shell";
import { PageHeader } from "@/components/data-display/primitives";
import { recurringDashboard } from "@/server/data/recurring";
import { RecurringClient } from "./recurring-client";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const data = await recurringDashboard();
  return (
    <AppShell>
      <PageHeader
        title="Recurring Expenses"
        subtitle="Local pattern detection for subscriptions and recurring bills"
      />
      <RecurringClient data={JSON.parse(JSON.stringify(data))} />
    </AppShell>
  );
}
