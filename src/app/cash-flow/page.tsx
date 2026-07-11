"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, MetricCard, PageHeader, Pill } from "@/components/data-display/primitives";
import { cashTimeline, pageMeta } from "@/data/demo";

export default function CashFlowPage() {
  return (
    <AppShell>
      <PageHeader title={pageMeta["/cash-flow"].title} subtitle={pageMeta["/cash-flow"].subtitle} />
      <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Current Cash Position" value="$8,421.00" detail="Today, Jul 10" />
        <MetricCard label="Remaining Income" value="$3,250.00" detail="Expected this month" />
        <MetricCard label="Remaining Expenses" value="$1,840.00" detail="Bills + spending" />
        <MetricCard label="Projected Month-End" value="$6,380.22" detail="Jul 31" featured />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-6">
          <div>
            <h2 className="text-xl font-semibold">Cash-Flow Timeline</h2>
            <p className="text-sm text-[var(--muted)]">
              Recorded, scheduled, and forecasted balance throughout July
            </p>
          </div>
          <div className="flex gap-2 text-sm text-[var(--muted)]">
            <Pill tone="good">Recorded</Pill>
            <Pill tone="warn">Scheduled</Pill>
            <Pill tone="info">Forecast</Pill>
          </div>
        </div>
        <div className="h-[440px] p-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashTimeline}>
              <defs>
                <linearGradient id="cash" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#258b7f" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#258b7f" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e0d8" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => `$${Number(v) / 1000}k`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Balance"]} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#258b7f"
                strokeWidth={3}
                fill="url(#cash)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="mt-7 p-6">
        <h2 className="text-xl font-semibold">Safe to Save — Full Calculation</h2>
        <p className="mb-6 text-sm text-[var(--muted)]">How this demonstration number is derived</p>
        {[
          ["Starting available cash", "$22,620.55"],
          ["Remaining expected income", "+$3,250.00"],
          ["Remaining expected expenses", "-$1,840.00"],
          ["Upcoming bills", "-$1,240.00"],
          ["Debt minimums", "-$680.00"],
          ["Sinking funds", "-$320.00"],
          ["Checking buffer", "-$1,500.00"],
          ["Emergency fund protection", "-$500.00"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-[var(--border)] py-3">
            <span className="text-[var(--muted)]">{label}</span>
            <strong className={value.startsWith("-") ? "text-[var(--red)]" : ""}>{value}</strong>
          </div>
        ))}
        <div className="mt-5 flex justify-between text-xl">
          <strong>Recommended safe amount</strong>
          <strong className="text-[var(--teal)]">$1,450.00</strong>
        </div>
      </Card>
    </AppShell>
  );
}
