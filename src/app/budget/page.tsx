import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { budgetRows, pageMeta } from "@/data/demo";
import { workspaceState } from "@/server/data/repositories";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const state = await workspaceState();
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/budget"].title}
        subtitle={pageMeta["/budget"].subtitle}
        workspaceState={state}
        action={
          <Button disabled title="Category creation is planned">
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        }
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Budget views will appear after data is added.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add accounts, categories, and transactions to begin budget comparisons.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Budgeted" value="$4,585.00" />
            <MetricCard label="Actual" value="$3,711.02" />
            <MetricCard label="Forecast" value="$4,185.00" />
            <MetricCard label="Remaining" value="$873.98" tone="positive" />
            <MetricCard label="vs. Last Month" value="↘ -$172.16" tone="positive" />
          </div>
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--border)] p-6">
              <h2 className="text-xl font-semibold">Fixed</h2>
              <p className="text-sm text-[var(--muted)]">Regular, unchanged amounts</p>
            </div>
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr>
                  {[
                    "Category",
                    "Budgeted",
                    "Actual",
                    "Forecast",
                    "Remaining",
                    "Used",
                    "vs. Last Mo",
                    "Status",
                  ].map((h) => (
                    <th key={h} className="px-6 py-4 uppercase tracking-[0.08em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((row) => (
                  <tr key={row[0]} className="border-t border-[var(--border)]">
                    {row.map((cell, i) => (
                      <td key={`${row[0]}-${i}`} className="px-6 py-4">
                        {i === 7 ? <Pill tone="warn">{cell}</Pill> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}
