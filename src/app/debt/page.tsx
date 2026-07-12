import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, PageHeader } from "@/components/data-display/primitives";
import { DebtPlanner } from "./debt-planner";
import { pageMeta } from "@/data/demo";
import type { DebtInput } from "@/domain/debt/payoff";
import { getDebtPlan } from "@/server/data/debt-plans";
import { getHousehold, workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const [household, state, plan] = await Promise.all([
    getHousehold(),
    workspaceState(),
    getDebtPlan(),
  ]);
  const debts: DebtInput[] = household.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balanceMinor: account.ledgerBalanceMinor ?? 0,
    aprBasisPoints: account.aprBasisPoints,
    minimumPaymentMinor: account.minimumPaymentMinor,
    dueDay: account.dueDay,
    archivedAt: account.archivedAt,
    reconciliationStatus: account.reconciliationStatus,
    balanceConfidence: account.balanceConfidence,
    lastReconciledAt: account.lastReconciledAt,
  }));

  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/debt"].title}
        subtitle={pageMeta["/debt"].subtitle}
        workspaceState={state}
        action={
          <Button disabled title="Add debt accounts from Accounts">
            <Plus className="h-4 w-4" /> Add Debt
          </Button>
        }
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Build your debt payoff plan.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Add a liability account, enter its APR, minimum payment, and due day, then reconcile the
            opening balance. Financial Compass will use that ledger balance without inventing
            missing terms.
          </p>
          <a
            href="/accounts"
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--teal)] px-4 text-sm font-semibold text-white"
          >
            Add and reconcile an account
          </a>
        </Card>
      ) : (
        <DebtPlanner
          debts={debts}
          initialStrategy={plan.strategy as "AVALANCHE" | "SNOWBALL" | "CUSTOM"}
          initialExtraPaymentMinor={plan.extraPaymentMinor}
          initialCustomOrder={plan.customOrder}
          initiallySaved={plan.saved}
          asOfIso="2026-07-12T00:00:00.000Z"
          mixedWorkspace={state === "MIXED"}
        />
      )}
    </AppShell>
  );
}
