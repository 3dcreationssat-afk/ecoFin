"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Save } from "lucide-react";
import { Button, Card, MetricCard, Pill } from "@/components/data-display/primitives";
import {
  calculatePayoff,
  compareStrategy,
  orderDebts,
  validateDebtInputs,
  weightedAprBasisPoints,
  type DebtInput,
  type DebtStrategy,
} from "@/domain/debt/payoff";
import { formatMoney, minorToDecimalString, parseMoneyToMinor } from "@/domain/money/money";

type Strategy = Exclude<DebtStrategy, "MINIMUM_ONLY">;

export function DebtPlanner({
  debts,
  initialStrategy,
  initialExtraPaymentMinor,
  initialCustomOrder,
  initiallySaved,
  asOfIso,
  mixedWorkspace,
}: {
  debts: DebtInput[];
  initialStrategy: Strategy;
  initialExtraPaymentMinor: number;
  initialCustomOrder: string[];
  initiallySaved: boolean;
  asOfIso: string;
  mixedWorkspace: boolean;
}) {
  const normalizedDebts = useMemo(
    () =>
      debts.map((debt) => ({
        ...debt,
        archivedAt: debt.archivedAt ? new Date(debt.archivedAt) : null,
        lastReconciledAt: debt.lastReconciledAt ? new Date(debt.lastReconciledAt) : null,
      })),
    [debts],
  );
  const eligible = useMemo(
    () => validateDebtInputs(normalizedDebts, "AVALANCHE").eligible,
    [normalizedDebts],
  );
  const defaultOrder = useMemo(
    () => orderDebts(eligible, "AVALANCHE").map((debt) => debt.id),
    [eligible],
  );
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [extraText, setExtraText] = useState(minorToDecimalString(initialExtraPaymentMinor));
  const [customOrder, setCustomOrder] = useState(
    initialCustomOrder.length === eligible.length ? initialCustomOrder : defaultOrder,
  );
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error" | "temporary">(
    initiallySaved ? "saved" : "temporary",
  );
  const [message, setMessage] = useState("");
  const [visiblePeriods, setVisiblePeriods] = useState(12);

  let extraPaymentMinor = 0;
  let inputError = "";
  try {
    extraPaymentMinor = parseMoneyToMinor(extraText || "0");
    if (extraPaymentMinor < 0 || extraPaymentMinor > 100_000_000)
      inputError = "Enter an amount from $0.00 through $1,000,000.00.";
  } catch (error) {
    inputError = error instanceof Error ? error.message : "Enter a valid amount.";
  }
  const asOf = useMemo(() => new Date(asOfIso), [asOfIso]);
  const baseline = useMemo(
    () => calculatePayoff({ debts: normalizedDebts, strategy: "MINIMUM_ONLY", asOf }),
    [normalizedDebts, asOf],
  );
  const result = useMemo(
    () =>
      calculatePayoff({
        debts: normalizedDebts,
        strategy,
        extraPaymentMinor: inputError ? 0 : extraPaymentMinor,
        customOrder,
        asOf,
      }),
    [normalizedDebts, strategy, extraPaymentMinor, inputError, customOrder, asOf],
  );
  const comparison = compareStrategy(result, baseline);
  const debtById = new Map(normalizedDebts.map((debt) => [debt.id, debt]));
  const totalDebtMinor = eligible.reduce((sum, debt) => sum + debt.balanceMinor, 0);
  const minimumsMinor = eligible.reduce((sum, debt) => sum + (debt.minimumPaymentMinor ?? 0), 0);
  const weightedApr = weightedAprBasisPoints(eligible);
  const highestApr = eligible.reduce(
    (highest, debt) => Math.max(highest, debt.aprBasisPoints ?? 0),
    0,
  );

  function changeStrategy(next: Strategy) {
    setStrategy(next);
    setSaveState("temporary");
    setMessage("");
  }

  function move(id: string, delta: -1 | 1) {
    const index = customOrder.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= customOrder.length) return;
    const next = [...customOrder];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setCustomOrder(next);
    setSaveState("temporary");
  }

  async function savePlan() {
    if (inputError || !result.available) return;
    setSaveState("saving");
    setMessage("");
    const response = await fetch("/api/debt-plan", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        strategy,
        extraPaymentMinor,
        customOrder: strategy === "CUSTOM" ? customOrder : [],
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage(body.error ?? "Debt plan could not be saved.");
      setSaveState("error");
      return;
    }
    setMessage("Plan saved. Cash Flow remains unchanged.");
    setSaveState("saved");
  }

  return (
    <div className="space-y-7">
      {mixedWorkspace ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          Mixed demonstration and user data lowers payoff confidence. Review account provenance and
          balances before relying on the estimate.
        </div>
      ) : null}
      <div className="metric-grid">
        <MetricCard label="Total debt" value={formatMoney(totalDebtMinor)} />
        <MetricCard label="Required monthly minimums" value={formatMoney(minimumsMinor)} />
        <MetricCard label="Weighted APR" value={formatApr(weightedApr)} />
        <MetricCard label="Highest APR" value={formatApr(highestApr)} tone="critical" />
        <MetricCard
          label="Estimated debt-free date"
          value={result.debtFreeDate ? formatMonth(result.debtFreeDate) : "Not available"}
          detail={
            result.available
              ? `${result.monthsToPayoff} months · ${result.confidence} confidence`
              : "Review calculation issues"
          }
        />
        <MetricCard
          label="Estimated remaining interest"
          value={
            result.totalInterestMinor == null
              ? "Not available"
              : formatMoney(result.totalInterestMinor)
          }
          detail="Monthly-rate estimate"
        />
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold">Payoff strategy</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Switching options recalculates locally. Save only when you want to retain the plan.
            </p>
          </div>
          <Pill tone={saveState === "saved" ? "good" : saveState === "error" ? "bad" : "info"}>
            {saveState === "saving"
              ? "Saving"
              : saveState === "saved"
                ? "Saved plan"
                : saveState === "error"
                  ? "Save failed"
                  : "Temporary scenario"}
          </Pill>
        </div>
        <div
          className="mt-5 grid gap-3 lg:grid-cols-3"
          role="radiogroup"
          aria-label="Payoff strategy"
        >
          {(
            [
              ["AVALANCHE", "Avalanche", "Highest APR first; usually minimizes interest."],
              ["SNOWBALL", "Snowball", "Smallest balance first; prioritizes faster wins."],
              ["CUSTOM", "Custom", "Use your own complete debt order."],
            ] as const
          ).map(([value, label, help]) => (
            <button
              key={value}
              role="radio"
              aria-checked={strategy === value}
              onClick={() => changeStrategy(value)}
              className={`rounded-xl border p-4 text-left ${strategy === value ? "border-[var(--teal)] bg-[var(--teal-soft)] ring-1 ring-[var(--teal)]" : "border-[var(--border)] bg-white"}`}
            >
              <strong>{label}</strong>
              <span className="mt-1 block text-sm leading-5 text-[var(--muted)]">{help}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 border-t border-[var(--border)] pt-5 md:grid-cols-[minmax(220px,320px)_1fr_auto] md:items-end">
          <label className="text-sm font-medium">
            Extra monthly payment
            <span className="relative mt-2 flex items-center">
              <span className="absolute left-3 text-[var(--muted)]">$</span>
              <input
                aria-label="Extra monthly payment"
                inputMode="decimal"
                value={extraText}
                onChange={(event) => {
                  setExtraText(event.target.value);
                  setSaveState("temporary");
                }}
                className="w-full border border-[var(--border)] bg-white pl-7 pr-3"
              />
            </span>
            {inputError ? (
              <span role="alert" className="mt-1 block text-xs text-[var(--red)]">
                {inputError}
              </span>
            ) : null}
          </label>
          <div className="text-sm text-[var(--muted)]">
            Current planned monthly payment
            <strong className="mt-1 block whitespace-nowrap text-lg text-[var(--text)] tabular-nums">
              {formatMoney(minimumsMinor + (inputError ? 0 : extraPaymentMinor))}
            </strong>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setExtraText("0.00");
                setSaveState("temporary");
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button
              disabled={Boolean(inputError) || !result.available || saveState === "saving"}
              onClick={savePlan}
            >
              <Save className="h-4 w-4" /> Save plan
            </Button>
          </div>
        </div>
        {message ? (
          <p role={saveState === "error" ? "alert" : "status"} className="mt-3 text-sm">
            {message}
          </p>
        ) : null}
      </Card>

      {!result.available ? (
        <Card className="border-red-200 bg-red-50 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Payoff estimate needs attention</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            No payoff date is generated until every included debt can amortize.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {result.issues
              .filter((item) => item.severity !== "INFO")
              .map((item) => (
                <li
                  key={`${item.debtId}-${item.code}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3"
                >
                  <span>
                    <strong>{debtById.get(item.debtId)?.name ?? "Debt plan"}:</strong>{" "}
                    {item.message}
                  </span>
                  <a href="/accounts" className="font-semibold text-[var(--teal)]">
                    Review account
                  </a>
                </li>
              ))}
          </ul>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
            <Card className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Payoff order</h2>
              <p className="mb-5 mt-1 text-sm text-[var(--muted)]">
                All minimums continue; available extra and rolled payments follow this order.
              </p>
              <div className="space-y-3">
                {result.orderedDebtIds.map((id, index) => {
                  const debt = debtById.get(id)!;
                  const milestone = result.milestones.find((item) => item.debtId === id);
                  const firstPeriod = result.schedule[0]?.debts.find((item) => item.debtId === id);
                  return (
                    <div
                      key={id}
                      className="grid gap-3 rounded-xl border border-[var(--border)] p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--teal)] font-semibold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{debt.name}</strong>
                          <Pill>{friendlyType(debt.type)}</Pill>
                        </div>
                        <div className="mt-1 text-sm text-[var(--muted)]">
                          {formatApr(debt.aprBasisPoints ?? 0)} APR ·{" "}
                          {formatMoney(debt.minimumPaymentMinor ?? 0)} minimum ·{" "}
                          {Math.round((debt.balanceMinor * 100) / totalDebtMinor)}% of debt
                        </div>
                        <div className="mt-1 text-sm">
                          Estimated payoff:{" "}
                          <strong>
                            {milestone
                              ? formatMonth(new Date(`${milestone.period}-01T00:00:00.000Z`))
                              : "—"}
                          </strong>
                        </div>
                      </div>
                      <div className="md:text-right">
                        <div className="whitespace-nowrap font-semibold tabular-nums">
                          {formatMoney(debt.balanceMinor)}
                        </div>
                        <div className="whitespace-nowrap text-sm text-[var(--muted)]">
                          {formatMoney(firstPeriod?.extraPaymentMinor ?? 0)} extra initially
                        </div>
                        {strategy === "CUSTOM" ? (
                          <div className="mt-2 flex gap-1 md:justify-end">
                            <button
                              aria-label={`Move ${debt.name} up`}
                              disabled={index === 0}
                              onClick={() => move(id, -1)}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] disabled:opacity-40"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`Move ${debt.name} down`}
                              disabled={index === result.orderedDebtIds.length - 1}
                              onClick={() => move(id, 1)}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] disabled:opacity-40"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Strategy impact</h2>
              <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
                Compared with paying each account’s minimum only.
              </p>
              {[
                [
                  "Estimated debt-free date",
                  result.debtFreeDate ? formatMonth(result.debtFreeDate) : "—",
                ],
                ["Estimated total interest", formatMoney(result.totalInterestMinor ?? 0)],
                ["Interest saved", formatMoney(comparison.interestSavedMinor ?? 0)],
                ["Time saved", `${comparison.timeSavedMonths ?? 0} months`],
                ["Initial monthly payment", formatMoney(result.initialMonthlyPaymentMinor)],
                ["First payoff", result.firstDebtPaidOff?.name ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-4 text-sm"
                >
                  <span className="text-[var(--muted)]">{label}</span>
                  <strong className="whitespace-nowrap text-right tabular-nums">{value}</strong>
                </div>
              ))}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Estimated monthly schedule</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Monthly interest is applied before payment. Expand in bounded groups of twelve
                periods.
              </p>
            </div>
            <div className="overflow-x-auto" tabIndex={0} aria-label="Debt payoff schedule">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Period",
                      "Starting debt",
                      "Interest",
                      "Required minimums",
                      "Extra",
                      "Total payment",
                      "Principal",
                      "Ending debt",
                      "Remaining",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.slice(0, visiblePeriods).map((period) => (
                    <tr key={period.period} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium">{period.period}</td>
                      {[
                        period.startingDebtMinor,
                        period.interestMinor,
                        period.requiredMinimumsMinor,
                        period.extraPaymentMinor,
                        period.totalPaymentMinor,
                        period.principalMinor,
                        period.endingDebtMinor,
                      ].map((value, index) => (
                        <td
                          key={index}
                          className="whitespace-nowrap px-4 py-3 text-right tabular-nums"
                        >
                          {formatMoney(value)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {period.remainingActiveDebts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visiblePeriods < result.schedule.length ? (
              <div className="border-t border-[var(--border)] p-4 text-center">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setVisiblePeriods((value) => Math.min(value + 12, result.schedule.length))
                  }
                >
                  Show next 12 months
                </Button>
              </div>
            ) : null}
          </Card>
        </>
      )}

      <Card className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold">How this estimate works</h2>
        <div className="mt-4 grid gap-4 text-sm leading-6 text-[var(--muted)] md:grid-cols-2 xl:grid-cols-4">
          <p>
            <strong className="text-[var(--text)]">Minimum-only:</strong> each debt receives only
            its required payment; finished payments are not redirected.
          </p>
          <p>
            <strong className="text-[var(--text)]">Rollover:</strong> strategy plans keep the
            initial total payment constant and redirect freed payments to the next priority.
          </p>
          <p>
            <strong className="text-[var(--text)]">Interest:</strong> APR is divided into a monthly
            periodic rate, rounded to cents, then payment is applied.
          </p>
          <p>
            <strong className="text-[var(--text)]">Limitations:</strong> lenders may use daily
            balances, fees, statement timing, and different rounding. Estimates are planning
            support, not lender statements or advice.
          </p>
        </div>
      </Card>
    </div>
  );
}

function formatApr(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}
function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
function friendlyType(type: string) {
  return type === "CREDIT" ? "Credit card" : type.charAt(0) + type.slice(1).toLowerCase();
}
