import { AppShell } from "@/components/app-shell/app-shell";
import { PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { getHousehold } from "@/server/data/repositories";
import { TransactionsClient } from "./transactions-client";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const household = await getHousehold();
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/transactions"].title}
        subtitle={`${household.transactions.length} transactions · SQLite`}
      />
      <TransactionsClient
        transactions={JSON.parse(JSON.stringify(household.transactions))}
        categories={JSON.parse(
          JSON.stringify(household.categories.filter((category) => !category.archivedAt)),
        )}
      />
    </AppShell>
  );
}
