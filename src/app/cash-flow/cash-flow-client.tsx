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
import type { CashFlowProjection } from "@/domain/cash-flow/engine";

const tone = (confidence: string) =>
  confidence === "HIGH" ? "good" : confidence === "MODERATE" ? "warn" : "bad";

export function CashFlowClient({ projection }: { projection: CashFlowProjection }) {
  let running = projection.startingUsableLiquidCashMinor;
  const timeline = [{ day: "Current", balance: running }];
  for (const event of projection.events.filter((event) => new Date(event.date) > new Date())) {
    running += event.amountMinor;
    timeline.push({
      day: new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      balance: running,
    });
  }
  timeline.push({ day: "Month end", balance: projection.projectedMonthEndMinor });
  return (
    <>
      {projection.workspaceWarning ? (
        <Card className="mb-5 border-amber-300 bg-amber-50 p-4 text-sm">
          {projection.workspaceWarning}
        </Card>
      ) : null}
      <div className="metric-grid mb-7">
        <MetricCard
          label="Current Cash Position"
          value={formatMoney(projection.startingUsableLiquidCashMinor)}
          detail="Anchored liquid ledgers; fresh lower available balances cap liquidity"
        />
        <MetricCard
          label="Remaining Expected Income"
          value={formatMoney(projection.remainingExpectedIncomeMinor)}
          detail="Confirmed persisted sources only"
        />
        <MetricCard
          label="Remaining Expenses"
          value={formatMoney(
            projection.remainingEssentialObligationsMinor + projection.debtMinimumPaymentsMinor,
          )}
          detail="Confirmed obligations and debt minimums"
        />
        <MetricCard
          label="Projected Month-End"
          value={formatMoney(projection.projectedMonthEndMinor)}
          detail="Before discretionary saving or spending"
          featured
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <Card>
          <div className="border-b border-[var(--border)] p-6">
            <h2 className="text-xl font-semibold">Cash-Flow Timeline</h2>
            <p className="text-sm text-[var(--muted)]">
              Recorded ledger activity and persisted future commitments
            </p>
          </div>
          <div className="h-72 p-4" aria-label="Projected running balance chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(v) => formatMoney(Number(v))} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Area dataKey="balance" stroke="#258b7f" fill="#d9eeea" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div
            className="max-h-80 overflow-auto border-t border-[var(--border)] px-6 py-3"
            tabIndex={0}
          >
            {projection.events.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[90px_minmax(0,1fr)_auto] gap-3 border-b border-[var(--border)] py-3 text-sm"
              >
                <span>
                  {new Date(event.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span>
                  <strong>{event.label}</strong>
                  <span className="block text-xs text-[var(--muted)]">
                    {event.kind.toLowerCase()} · {event.source}
                  </span>
                </span>
                <strong>{formatMoney(event.amountMinor)}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Confidence</h2>
            <Pill tone={tone(projection.confidence)}>{projection.confidence}</Pill>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Deterministic factors; no opaque score.
          </p>
          <div className="mt-5 space-y-3">
            {projection.confidenceFactors.map((factor) => (
              <a
                key={factor.label}
                href={factor.href ?? "/cash-flow"}
                className="block rounded-md border border-[var(--border)] p-3 text-sm"
              >
                <strong className={factor.positive ? "text-[var(--green)]" : "text-[var(--amber)]"}>
                  {factor.positive ? "Ready" : "Review"}: {factor.label}
                </strong>
                <span className="mt-1 block text-[var(--muted)]">{factor.explanation}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Buffer and Protection</h2>
          <div className="mt-4 space-y-3 text-sm">
            {[
              [
                "Configured checking target",
                projection.checkingBufferTargetMinor,
                "Household-level combined checking reserve",
              ],
              [
                "Qualifying checking balance",
                projection.checkingCashMinor,
                "Current anchored checking ledgers",
              ],
              [
                "Checking reserve required",
                projection.checkingBufferReserveMinor,
                "Only the target shortfall is reserved",
              ],
              [
                "Emergency target",
                projection.emergencyFundTargetMinor,
                "Configured household target",
              ],
              [
                "Explicitly protected amount",
                projection.emergencyProtectedMinor,
                "Linked emergency-fund goal only",
              ],
              [
                "Emergency protection remaining",
                projection.emergencyFundShortfallMinor,
                "Target shortfall; only mapped funds are protected from spending",
              ],
            ].map(([label, value, help]) => (
              <div
                key={String(label)}
                className="flex justify-between gap-4 border-b border-[var(--border)] py-2"
                title={String(help)}
              >
                <span>
                  {label}
                  <span className="block text-xs text-[var(--muted)]">{help}</span>
                </span>
                <strong>{formatMoney(Number(value))}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Data-Quality Reserve</h2>
          <p className="text-sm text-[var(--muted)]">
            Explicit known amounts only—never a blanket percentage.
          </p>
          <div className="mt-4 space-y-3">
            {projection.reserveComponents.length ? (
              projection.reserveComponents.map((reserve) => (
                <a
                  href={reserve.href}
                  key={reserve.id}
                  className="flex justify-between gap-4 border-b border-[var(--border)] py-2 text-sm"
                >
                  <span>
                    <strong>{reserve.label}</strong>
                    <span className="block text-xs text-[var(--muted)]">{reserve.explanation}</span>
                  </span>
                  <strong>{formatMoney(reserve.amountMinor)}</strong>
                </a>
              ))
            ) : (
              <p className="text-sm text-[var(--green)]">
                No quantified uncertainty reserve is currently required.
              </p>
            )}
          </div>
        </Card>
      </div>
      <div id="calculation">
        <Card className="mt-7 p-6">
          <h2 className="text-xl font-semibold">Safe to Save — Full Calculation</h2>
          <p className="text-sm text-[var(--muted)]">
            All values are integer minor-unit calculations from repository records.
          </p>
          <div className="mt-5">
            {projection.calculationLines.map((line) => (
              <div
                key={line.label}
                title={line.help}
                className="flex justify-between gap-4 border-b border-[var(--border)] py-3"
              >
                <span>
                  {line.label}
                  <span className="block text-xs text-[var(--muted)]">{line.help}</span>
                </span>
                <strong>
                  {line.amountMinor >= 0 ? "+" : ""}
                  {formatMoney(line.amountMinor)}
                </strong>
              </div>
            ))}
          </div>
          <div
            className="mt-6 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4"
            aria-label="Cash allocation reconciliation"
          >
            {[
              [
                "Cash after obligations and protections",
                projection.cashAfterObligationsAndProtectionsMinor,
                "After income, obligations, buffers, emergency protection, and data-quality reserve.",
              ],
              [
                "Retained safety reserve",
                -projection.retainedSafetyReserveMinor,
                "Policy cash excluded from both saving and spending allocations.",
              ],
              [
                "Allocatable surplus",
                projection.allocatableSurplusMinor,
                "The exact base divided between recommended saving and Safe to Spend.",
              ],
              [
                "Recommended savings transfer",
                -projection.recommendedSafeToSaveMinor,
                "Policy percentage applied to allocatable surplus.",
              ],
              [
                "Safe to Spend",
                projection.safeToSpendMinor,
                "Allocatable surplus remaining after the recommendation.",
              ],
              [
                "Unallocated surplus",
                projection.unallocatedSurplusMinor,
                "Explicit reconciliation remainder; normally zero.",
              ],
            ].map(([label, value, help]) => (
              <div
                key={String(label)}
                title={String(help)}
                className="flex justify-between gap-4 border-b border-[var(--border)] py-3 last:border-0"
              >
                <span>
                  <strong>{label}</strong>
                  <span className="block text-xs text-[var(--muted)]">{help}</span>
                </span>
                <strong>
                  {Number(value) >= 0 ? "+" : ""}
                  {formatMoney(Number(value))}
                </strong>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Allocatable Surplus"
              value={formatMoney(projection.allocatableSurplusMinor)}
              detail="Cash after protections minus retained safety reserve"
            />
            <MetricCard
              label="Recommended Safe to Save"
              value={formatMoney(projection.recommendedSafeToSaveMinor)}
              detail="Configured policy share of allocatable surplus"
              featured
            />
            <MetricCard
              label="Conservative Safe to Save"
              value={formatMoney(projection.conservativeSafeToSaveMinor)}
              detail={
                projection.confidence === "HIGH"
                  ? "Equals Recommended at High confidence"
                  : `Reduced by ${formatMoney(projection.conservativeReductionMinor)} for ${projection.confidence} confidence`
              }
            />
            <MetricCard
              label="Safe to Spend"
              value={formatMoney(projection.safeToSpendMinor)}
              detail={
                projection.shortfallMinor
                  ? `Shortfall: ${formatMoney(projection.shortfallMinor)}`
                  : "Remaining after recommended saving"
              }
            />
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Policy: {projection.savingsPolicyMode} · Effective target:{" "}
            {projection.effectiveSavingsTargetBps / 100}% · Retained safety reserve:{" "}
            {formatMoney(projection.retainedSafetyReserveMinor)} · Recommendation cap:{" "}
            {formatMoney(projection.savingsPolicyCapMinor)}
          </p>
        </Card>
      </div>
    </>
  );
}
