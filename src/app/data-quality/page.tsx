import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { dataQualityRules } from "@/domain/summaries/calculations";
import { getHousehold } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function DataQualityPage() {
  const household = await getHousehold();
  const quality = dataQualityRules({
    transactions: household.transactions,
    accounts: household.accounts,
    goals: household.goals,
    asOf: new Date("2026-07-11"),
  });
  const issues = [
    [
      "Uncategorized transactions",
      quality.uncategorized,
      "Spending by category may be incomplete.",
    ],
    ["Transactions lacking review", quality.unreviewed, "Review status may affect confidence."],
    ["Stale accounts", quality.staleAccounts, "Balances may need a manual update."],
    [
      "Missing debt APR or minimum",
      quality.missingDebtTerms,
      "Debt payoff estimates remain demonstration-only.",
    ],
    ["Incomplete goals", quality.incompleteGoals, "Goal progress may be incomplete."],
  ] as const;
  const issueCount = issues.reduce((total, [, count]) => total + count, 0);
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/data-quality"].title}
        subtitle="Deterministic checks from SQLite records"
      />
      <Card className="mb-7 flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-5">
          <div className="rounded-lg bg-[var(--amber-soft)] p-4">
            <ShieldCheck className="h-7 w-7 text-[var(--amber)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              Overall confidence: {issueCount ? "Moderate" : "High"}{" "}
              <Pill tone={issueCount ? "warn" : "good"}>{issueCount} issues</Pill>
            </h2>
            <p className="text-[var(--muted)]">
              These checks do not claim advanced recurring, forecast, or duplicate engines exist.
            </p>
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-xl font-semibold">Issues Found</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {issues.map(([title, count, impact]) => (
            <div key={title} className="rounded-md border border-[var(--border)] p-4">
              <Pill tone={count ? "warn" : "good"}>{count ? "Review" : "Clear"}</Pill>
              <p className="mt-3 font-semibold">
                {count} {title.toLowerCase()}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{impact}</p>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
