import { AppShell } from "@/components/app-shell/app-shell";
import { PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { backupDashboard } from "@/server/data/backup";
import { getHousehold } from "@/server/data/repositories";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [household, backup] = await Promise.all([getHousehold(), backupDashboard()]);
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageHeader title={pageMeta["/settings"].title} subtitle={pageMeta["/settings"].subtitle} />
        <SettingsClient
          household={JSON.parse(JSON.stringify(household))}
          categories={JSON.parse(JSON.stringify(household.categories))}
          backup={JSON.parse(JSON.stringify(backup))}
        />
      </div>
    </AppShell>
  );
}
