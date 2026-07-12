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
import { Card, MetricCard, Pill } from "@/components/data-display/primitives";
import { formatMoney } from "@/domain/money/money";

export function CashFlowClient({
  currentCashMinor,
  recordedIncomeMinor,
  recordedSpendingMinor,
  projectedMonthEndMinor,
  timeline,
}: {
  currentCashMinor: number;
  recordedIncomeMinor: number;
  recordedSpendingMinor: number;
  projectedMonthEndMinor: number;
  timeline: { day: string; balance: number }[];
}) {
  return (
    <>
      <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Current Cash Position"
          value={formatMoney(currentCashMinor)}
          detail="Active cash accounts"
        />
        <MetricCard
          label="Recorded Income"
          value={formatMoney(recordedIncomeMinor)}
          detail="Current month"
        />
        <MetricCard
          label="Recorded Spending"
          value={formatMoney(recordedSpendingMinor)}
          detail="Transfers excluded"
        />
        <MetricCard
          label="Projected Month-End"
          value={formatMoney(projectedMonthEndMinor)}
          detail="Preliminary: cash plus recorded net flow"
          featured
        />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-6">
          <div>
            <h2 className="text-xl font-semibold">Cash-Flow Timeline</h2>
            <p className="text-sm text-[var(--muted)]">
              Recorded cash movement for the current month; scheduled forecasting is not enabled
            </p>
          </div>
          <div className="flex gap-2 text-sm text-[var(--muted)]">
            <Pill tone="good">Recorded</Pill>
            <Pill tone="info">Preliminary</Pill>
          </div>
        </div>
        <div className="h-[440px] p-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="cash" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#258b7f" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#258b7f" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e0d8" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(value) => `$${Number(value) / 100000}k`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip formatter={(value) => [formatMoney(Number(value)), "Balance"]} />
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
        <h2 className="text-xl font-semibold">Safe to Save - Full Calculation</h2>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Production recommendation engine is not enabled
        </p>
        {[
          ["Current cash position", formatMoney(currentCashMinor)],
          ["Recorded income", `+${formatMoney(recordedIncomeMinor)}`],
          ["Recorded spending", `-${formatMoney(recordedSpendingMinor)}`],
          ["Scheduled income", "Unavailable"],
          ["Upcoming bills", "Unavailable"],
          ["Checking buffer", "Unavailable"],
          ["Emergency fund protection", "Unavailable"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-[var(--border)] py-3">
            <span className="text-[var(--muted)]">{label}</span>
            <strong className={value.startsWith("-") ? "text-[var(--red)]" : ""}>{value}</strong>
          </div>
        ))}
        <div className="mt-5 flex justify-between text-xl">
          <strong>Recommended safe amount</strong>
          <strong className="text-[var(--amber)]">Preliminary</strong>
        </div>
      </Card>
    </>
  );
}
