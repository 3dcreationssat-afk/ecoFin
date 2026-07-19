import { AppShell } from "@/components/app-shell/app-shell";
import { PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { backupDashboard } from "@/server/data/backup";
import { getHousehold, workspaceState } from "@/server/data/repositories";
import { SettingsClient } from "./settings-client";
import { listMerchantRules } from "@/server/data/merchant-rules";
import { getEmergencyFundConfiguration } from "@/server/data/emergency-fund";
import { getCashFlowProjection } from "@/server/data/cash-flow";
import { plaidSetupDashboard } from "@/server/plaid/setup";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [household, backup, state, merchantRules, emergencyFund, cashFlow, plaidSetup] =
    await Promise.all([
      getHousehold(),
      backupDashboard(),
      workspaceState(),
      listMerchantRules(),
      getEmergencyFundConfiguration(),
      getCashFlowProjection(new Date("2026-07-12T00:00:00.000Z")),
      plaidSetupDashboard(),
    ]);
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title={pageMeta["/settings"].title}
          subtitle={pageMeta["/settings"].subtitle}
          workspaceState={state}
        />
        <SettingsClient
          household={JSON.parse(JSON.stringify(household))}
          categories={JSON.parse(JSON.stringify(household.categories))}
          backup={JSON.parse(JSON.stringify(backup))}
          merchantRules={JSON.parse(JSON.stringify(merchantRules))}
          emergencyFund={JSON.parse(JSON.stringify(emergencyFund))}
          emergencyRunway={JSON.parse(JSON.stringify(cashFlow.emergencyRunway))}
          plaidSetup={JSON.parse(JSON.stringify(plaidSetup))}
        />
      </div>
    </AppShell>
  );
}
