import { AppShell } from "@/components/app-shell/app-shell";
import { PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { importDashboard } from "@/server/data/imports";
import { TransactionsClient } from "./transactions-client";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const { household, accounts, categories, profiles, batches } = await importDashboard();
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/transactions"].title}
        subtitle={`${household.transactions.length} transactions · SQLite`}
      />
      <TransactionsClient
        transactions={JSON.parse(JSON.stringify(household.transactions))}
        categories={JSON.parse(JSON.stringify(categories))}
        accounts={JSON.parse(JSON.stringify(accounts))}
        profiles={JSON.parse(JSON.stringify(profiles))}
        batches={JSON.parse(JSON.stringify(batches))}
      />
    </AppShell>
  );
}
