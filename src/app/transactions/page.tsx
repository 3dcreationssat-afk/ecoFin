import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { importDashboard } from "@/server/data/imports";
import { workspaceState } from "@/server/data/repositories";
import { transferReviewQueue } from "@/server/data/transfers";
import { TransactionsClient } from "./transactions-client";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const { household, accounts, categories, profiles, batches } = await importDashboard();
  const state = await workspaceState();
  const transferQueue = await transferReviewQueue();
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/transactions"].title}
        subtitle={`${household.transactions.length} transactions tracked locally`}
        workspaceState={state}
      />
      {state === "EMPTY" ? (
        <Card className="mb-5 p-6">
          <h2 className="text-xl font-semibold">No transactions yet.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Import a CSV after adding an account. Manual transaction creation is still planned.
          </p>
        </Card>
      ) : null}
      <TransactionsClient
        transactions={JSON.parse(JSON.stringify(household.transactions))}
        categories={JSON.parse(JSON.stringify(categories))}
        accounts={JSON.parse(JSON.stringify(accounts))}
        profiles={JSON.parse(JSON.stringify(profiles))}
        batches={JSON.parse(JSON.stringify(batches))}
        transferMatches={JSON.parse(JSON.stringify(transferQueue.matches))}
      />
    </AppShell>
  );
}
