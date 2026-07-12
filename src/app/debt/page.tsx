import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { formatMoney } from "@/domain/money/money";
import { accountSummaries } from "@/domain/summaries/calculations";
import { getHousehold, workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const household = await getHousehold();
  const state = await workspaceState();
  const summary = accountSummaries(household.accounts);
  const debtAccounts = household.accounts
    .filter(
      (account) =>
        !account.archivedAt &&
        ["CREDIT", "LOAN", "MORTGAGE"].includes(account.type) &&
        (account.ledgerBalanceMinor ?? 0) > 0,
    )
    .sort((a, b) => (b.aprBasisPoints ?? 0) - (a.aprBasisPoints ?? 0));
  const monthlyMinimumsMinor = debtAccounts.reduce(
    (total, account) => total + (account.minimumPaymentMinor ?? 0),
    0,
  );
  const weightedAprBasisPoints =
    summary.totalDebtsMinor === 0
      ? 0
      : Math.round(
          debtAccounts.reduce(
            (total, account) =>
              total + (account.ledgerBalanceMinor ?? 0) * (account.aprBasisPoints ?? 0),
            0,
          ) / summary.totalDebtsMinor,
        );
  const highestAprBasisPoints = debtAccounts[0]?.aprBasisPoints ?? 0;
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/debt"].title}
        subtitle={pageMeta["/debt"].subtitle}
        workspaceState={state}
        action={
          <Button disabled title="Debt creation is planned">
            <Plus className="h-4 w-4" /> Add Debt
          </Button>
        }
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Debt planning will appear after data is added.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add debt accounts before reviewing payoff order and strategy impact.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-7 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total balance" value={formatMoney(summary.totalDebtsMinor)} />
            <MetricCard label="Monthly minimums" value={formatMoney(monthlyMinimumsMinor)} />
            <MetricCard label="Weighted APR" value={formatApr(weightedAprBasisPoints)} />
            <MetricCard
              label="Highest APR"
              value={formatApr(highestAprBasisPoints)}
              tone={highestAprBasisPoints > 0 ? "critical" : "default"}
            />
            <MetricCard label="Est. payoff date" value="Unavailable" detail="Engine planned" />
            <MetricCard
              label="Est. remaining interest"
              value="Unavailable"
              detail="Engine planned"
            />
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--muted)]">Payoff Strategy</h2>
              <div
                className="mt-3 flex rounded-md border border-[var(--border)] bg-white p-1"
                aria-label="Demonstration payoff strategy"
              >
                <button
                  disabled
                  title="Strategy switching requires the payoff engine"
                  className="rounded bg-[var(--surface-muted)] px-4 py-2"
                >
                  Avalanche
                </button>
                <button
                  disabled
                  title="Strategy switching requires the payoff engine"
                  className="px-4 py-2 text-[var(--muted)]"
                >
                  Snowball
                </button>
                <button
                  disabled
                  title="Strategy switching requires the payoff engine"
                  className="px-4 py-2 text-[var(--muted)]"
                >
                  Custom
                </button>
              </div>
            </div>
            <label className="text-[var(--muted)]">
              Extra monthly payment{" "}
              <input disabled type="range" defaultValue="0" className="mx-3 align-middle" />{" "}
              <strong className="text-[var(--text)]">Unavailable</strong>
            </label>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
            <Card className="p-6">
              <h2 className="text-xl font-semibold">Payoff Order</h2>
              <p className="mb-6 text-sm text-[var(--muted)]">
                Sorted by APR until a validated payoff strategy engine is enabled
              </p>
              <div className="space-y-4">
                {debtAccounts.map((account, index) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-4 rounded-lg border border-[var(--border)] p-4"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--teal)] font-semibold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {account.name} <Pill>{friendlyAccountType(account.type)}</Pill>
                      </div>
                      <div className="text-sm text-[var(--muted)]">
                        {formatApr(account.aprBasisPoints ?? 0)} APR
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatMoney(account.ledgerBalanceMinor ?? 0)}
                      </div>
                      <div className="text-sm text-[var(--muted)]">
                        {formatMoney(account.minimumPaymentMinor ?? 0)} min
                      </div>
                    </div>
                  </div>
                ))}
                {debtAccounts.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No active debt accounts found.</p>
                ) : null}
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="text-xl font-semibold">Strategy Impact</h2>
              <p className="mb-10 text-sm text-[var(--muted)]">
                Payoff simulation is intentionally unavailable until validated
              </p>
              {[
                ["Est. debt-free date", "Unavailable"],
                ["Est. total interest", "Unavailable"],
                ["Interest saved vs. minimums", "Unavailable"],
                ["Time saved", "Unavailable"],
                ["Total monthly payment", formatMoney(monthlyMinimumsMinor)],
              ].map(([a, b]) => (
                <div key={a} className="flex justify-between border-b border-[var(--border)] py-5">
                  <span className="text-[var(--muted)]">{a}</span>
                  <strong>{b}</strong>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}

function formatApr(value: number) {
  return value > 0 ? `${(value / 100).toFixed(2)}%` : "Not set";
}

function friendlyAccountType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
