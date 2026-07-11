import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta, recurringRows } from "@/data/demo";

export default function RecurringPage() {
  return (
    <AppShell>
      <PageHeader title={pageMeta["/recurring"].title} subtitle={pageMeta["/recurring"].subtitle} />
      <div className="mb-7 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Monthly total" value="$2,718.93" />
        <MetricCard label="Annual total" value="$32,627" />
        <MetricCard label="Essential" value="$2,550" tone="positive" />
        <MetricCard label="Optional" value="$44" tone="warning" />
        <MetricCard label="Under review" value="$169" />
        <MetricCard label="Price increases" value="+$9.00/mo" tone="warning" />
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-6">
          <h2 className="text-xl font-semibold">All Recurring Expenses</h2>
          <p className="text-sm text-[var(--muted)]">Select items to calculate potential savings</p>
        </div>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              {[
                "Merchant",
                "Service",
                "Amount",
                "Frequency",
                "Monthly",
                "Annual",
                "Next charge",
                "Price change",
                "Classification",
                "Recommendation",
              ].map((h) => (
                <th key={h} className="px-5 py-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recurringRows.map((row) => (
              <tr key={row[0]} className="border-t border-[var(--border)]">
                {row.map((cell, i) => (
                  <td key={`${row[0]}-${i}`} className="px-5 py-4">
                    {i > 7 ? (
                      <Pill
                        tone={
                          cell === "Essential" || cell === "Keep"
                            ? "good"
                            : cell === "Useful"
                              ? "info"
                              : "warn"
                        }
                      >
                        {cell}
                      </Pill>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
