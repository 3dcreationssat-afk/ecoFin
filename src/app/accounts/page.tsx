import { Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Button, Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { accounts, pageMeta } from "@/data/demo";

export default function AccountsPage() {
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/accounts"].title}
        subtitle={pageMeta["/accounts"].subtitle}
        action={
          <Button disabled title="Account creation is planned">
            <Plus className="h-4 w-4" /> Add Account
          </Button>
        }
      />
      <div className="mb-7 grid gap-4 md:grid-cols-3">
        <MetricCard label="Total assets" value="$22,620.55" tone="positive" />
        <MetricCard label="Total debts" value="$270,251.10" tone="critical" />
        <MetricCard label="Net worth" value="-$247,630.55" featured />
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-6">
          <h2 className="text-xl font-semibold">All Accounts</h2>
          <p className="text-[var(--muted)]">Balances and details</p>
        </div>
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              {[
                "Account",
                "Institution",
                "Type",
                "Balance",
                "Available",
                "Credit limit",
                "APR",
                "Due date",
                "Last updated",
                "Status",
                "",
              ].map((h) => (
                <th key={h} className="px-5 py-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map((row) => (
              <tr key={row[0]} className="border-t border-[var(--border)]">
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={`px-5 py-4 ${cell.startsWith("-") ? "text-[var(--red)]" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
                <td className="px-5 py-4">
                  <Pill tone="good">Active</Pill>
                </td>
                <td className="px-5 py-4">
                  <RefreshCw aria-label="Balance refresh planned" className="h-4 w-4 opacity-50" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
