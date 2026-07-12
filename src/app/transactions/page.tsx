import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { importDashboard } from "@/server/data/imports";
import { workspaceState } from "@/server/data/repositories";
import { transferReviewQueue } from "@/server/data/transfers";
import { TransactionsClient } from "./transactions-client";
import {
  hasExplicitTransactionState,
  parseTransactionQuery,
  serializeTransactionQuery,
} from "@/domain/transactions/query";
import {
  defaultSavedView,
  listSavedViews,
  parseSavedViewQuery,
  transactionPage,
} from "@/server/data/transaction-views";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const raw = await searchParams;
  if (!hasExplicitTransactionState(raw)) {
    const savedDefault = await defaultSavedView();
    if (savedDefault) {
      const params = serializeTransactionQuery(parseSavedViewQuery(savedDefault.queryJson));
      redirect(`/transactions?${params.size ? params : "period=ALL"}`);
    }
  }
  const query = parseTransactionQuery(raw);
  const { accounts, categories, profiles, batches } = await importDashboard();
  const [result, savedViews] = await Promise.all([transactionPage(query), listSavedViews()]);
  const state = await workspaceState();
  const transferQueue = await transferReviewQueue();
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/transactions"].title}
        subtitle={`${result.all} transactions tracked locally`}
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
        transactions={JSON.parse(JSON.stringify(result.items))}
        totalCount={result.all}
        filteredCount={result.total}
        totalPages={result.totalPages}
        query={query}
        savedViews={JSON.parse(JSON.stringify(savedViews))}
        categories={JSON.parse(JSON.stringify(categories))}
        accounts={JSON.parse(JSON.stringify(accounts))}
        profiles={JSON.parse(JSON.stringify(profiles))}
        batches={JSON.parse(JSON.stringify(batches))}
        transferMatches={JSON.parse(JSON.stringify(transferQueue.matches))}
      />
    </AppShell>
  );
}
