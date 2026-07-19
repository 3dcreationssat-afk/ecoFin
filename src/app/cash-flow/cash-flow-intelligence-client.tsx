"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CircleDollarSign, ShieldCheck, TrendingDown } from "lucide-react";
import { Button, Card, Pill } from "@/components/data-display/primitives";
import type { CashFlowProjection } from "@/domain/cash-flow/engine";
import { formatMoney, parseMoneyToMinor } from "@/domain/money/money";

type Rule = {
  id: string;
  name: string;
  merchantKey: string;
  direction: string;
  cadence: string;
  nextExpectedDate: Date | string;
  typicalAmountMinor: number;
  minAmountMinor: number;
  maxAmountMinor: number;
  dateToleranceDays: number;
  amountToleranceBps: number;
  confidence: string;
  confidenceScore: number;
  state: string;
  reasons: string[];
  account: { id: string; name: string } | null;
};
type Account = { id: string; name: string; type: string };
type ForecastEvent = CashFlowProjection["events"][number];
type PayrollSummary = {
  currentMonthIncomeMinor: number;
  currentMonthIncomeCount: number;
  payrollIncomeMinor: number;
  payrollIncomeCount: number;
  typicalPaycheckMinor: number | null;
  normalizedMonthlyPayrollMinor: number | null;
  nextExpectedPaycheck: string | null;
  mostRecentPaycheck: { id: string; date: string; amountMinor: number } | null;
  unusualIncomeMinor: number;
  unusualIncomeCount: number;
  confidence: string;
  confidenceScore: number;
  warnings: string[];
  reasons: string[];
  primary: {
    merchantKey: string;
    displayName: string;
    cadence: string;
    minAmountMinor: number;
    maxAmountMinor: number;
    contributingTransactions: {
      id: string;
      date: string;
      amountMinor: number;
      merchant: string;
      accountName: string;
      sourceType: string;
      unusual: boolean;
    }[];
  } | null;
};

export function CashFlowIntelligenceClient({
  projection,
  rules,
  accounts,
  householdId,
  payrollSummary,
}: {
  projection: CashFlowProjection;
  rules: Rule[];
  accounts: Account[];
  householdId: string;
  payrollSummary: PayrollSummary;
}) {
  const router = useRouter();
  const [scenario, setScenario] = useState<"confirmed" | "likely" | "conservative">("confirmed");
  const [detail, setDetail] = useState<"monthEnd" | "lowest" | "spend" | "confidence" | null>(null);
  const [modal, setModal] = useState<"income" | "expense" | "rule" | "occurrence" | null>(null);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ForecastEvent | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const scenarioResult = projection.scenarios[scenario];
  const futureEvents = useMemo(
    () =>
      [...projection.events, ...projection.inferredEvents]
        .filter((event) => event.id !== "current" && event.date >= projection.period.start)
        .sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id),
        ),
    [projection],
  );
  const detected = rules.filter((rule) => rule.state === "DETECTED");
  const payroll = detected.filter((rule) => rule.direction === "INCOME");
  const attentionCount = projection.confidenceFactors.filter((factor) => !factor.positive).length;

  async function send(url: string, method: string, body: unknown) {
    setMessage("");
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Action failed.");
      return false;
    }
    setMessage("Forecast updated.");
    startTransition(() => router.refresh());
    return true;
  }

  async function ruleAction(id: string, action: string) {
    await send(`/api/forecast-rules/${id}`, "PATCH", { action });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div
          role="status"
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
        >
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
          aria-label="Forecast scenario"
        >
          {(["confirmed", "likely", "conservative"] as const).map((item) => (
            <button
              key={item}
              aria-pressed={scenario === item}
              onClick={() => setScenario(item)}
              className={`rounded-md px-3 py-2 text-sm font-semibold capitalize ${scenario === item ? "bg-[var(--teal)] text-white" : "text-[var(--muted)]"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {scenario === "confirmed"
            ? "Confirmed rules and explicit one-time items"
            : scenario === "likely"
              ? "Confirmed activity plus high-confidence inferred patterns"
              : "Confirmed income with inferred expense risk and protections"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OutcomeCard
          label="Projected month-end"
          value={formatMoney(scenarioResult.projectedMonthEndMinor)}
          detail={`${capitalize(scenario)} scenario`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          active={detail === "monthEnd"}
          onClick={() => setDetail(detail === "monthEnd" ? null : "monthEnd")}
        />
        <OutcomeCard
          label="Lowest projected balance"
          value={formatMoney(scenarioResult.lowestBalanceMinor)}
          detail={shortDate(scenarioResult.lowestBalanceDate)}
          icon={<TrendingDown className="h-5 w-5" />}
          active={detail === "lowest"}
          onClick={() => setDetail(detail === "lowest" ? null : "lowest")}
        />
        <OutcomeCard
          label="Safe to spend"
          value={formatMoney(projection.safeToSpendMinor)}
          detail="After protected savings and recommended saving"
          icon={<ShieldCheck className="h-5 w-5" />}
          active={detail === "spend"}
          onClick={() => setDetail(detail === "spend" ? null : "spend")}
        />
        <OutcomeCard
          label="Forecast confidence"
          value={capitalize(projection.confidence)}
          detail={`${attentionCount} input${attentionCount === 1 ? "" : "s"} affect confidence`}
          icon={<AlertTriangle className="h-5 w-5" />}
          active={detail === "confidence"}
          onClick={() => setDetail(detail === "confidence" ? null : "confidence")}
        />
      </div>

      {detail ? <HeadlineDetail detail={detail} projection={projection} /> : null}

      <div id="payroll">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Pill tone={payrollSummary.confidence === "HIGH" ? "good" : "warn"}>
                {payrollSummary.confidence} payroll confidence
              </Pill>
              <h2 className="mt-2 text-xl font-semibold">Payroll and income drilldown</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Cadence, amount stability, account identity, transfer exclusions, and normalized
                source text determine payroll. Categories alone do not.
              </p>
            </div>
            <a
              className="text-sm font-semibold text-[var(--teal)]"
              href="/transactions?period=ALL&type=INCOME"
            >
              Review all income
            </a>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PayrollMetric
              label="Current-month income"
              value={formatMoney(payrollSummary.currentMonthIncomeMinor)}
              detail={`${payrollSummary.currentMonthIncomeCount} contributing transactions`}
              href="/transactions?period=CURRENT_MONTH&type=INCOME"
            />
            <PayrollMetric
              label="Payroll income"
              value={formatMoney(payrollSummary.payrollIncomeMinor)}
              detail={`${payrollSummary.payrollIncomeCount} payroll deposits this month`}
              href={`/transactions?period=ALL&q=${encodeURIComponent(payrollSummary.primary?.merchantKey ?? "payroll")}`}
            />
            <PayrollMetric
              label="Typical paycheck"
              value={
                payrollSummary.typicalPaycheckMinor == null
                  ? "Unavailable"
                  : formatMoney(payrollSummary.typicalPaycheckMinor)
              }
              detail={
                payrollSummary.primary
                  ? cadenceLabel(payrollSummary.primary.cadence)
                  : "More history required"
              }
              href={`/transactions?period=ALL&q=${encodeURIComponent(payrollSummary.primary?.merchantKey ?? "payroll")}`}
            />
            <PayrollMetric
              label="Normalized monthly payroll"
              value={
                payrollSummary.normalizedMonthlyPayrollMinor == null
                  ? "Unavailable"
                  : formatMoney(payrollSummary.normalizedMonthlyPayrollMinor)
              }
              detail="Typical check × annual cadence ÷ 12"
              href={`/transactions?period=ALL&q=${encodeURIComponent(payrollSummary.primary?.merchantKey ?? "payroll")}`}
            />
            <PayrollMetric
              label="Most recent paycheck"
              value={
                payrollSummary.mostRecentPaycheck
                  ? formatMoney(payrollSummary.mostRecentPaycheck.amountMinor)
                  : "Unavailable"
              }
              detail={
                payrollSummary.mostRecentPaycheck
                  ? longDate(payrollSummary.mostRecentPaycheck.date)
                  : "No qualifying payroll"
              }
              href={`/transactions?period=ALL&q=${encodeURIComponent(payrollSummary.primary?.merchantKey ?? "payroll")}`}
            />
            <PayrollMetric
              label="Next expected paycheck"
              value={
                payrollSummary.nextExpectedPaycheck
                  ? longDate(payrollSummary.nextExpectedPaycheck)
                  : "Unavailable"
              }
              detail={payrollSummary.primary?.displayName ?? "No stable pattern"}
              href={`/transactions?period=ALL&q=${encodeURIComponent(payrollSummary.primary?.merchantKey ?? "payroll")}`}
            />
            <PayrollMetric
              label="Unusual income"
              value={formatMoney(payrollSummary.unusualIncomeMinor)}
              detail={`${payrollSummary.unusualIncomeCount} non-payroll or outlier transactions`}
              href="/transactions?period=CURRENT_MONTH&type=INCOME&status=NEEDS_REVIEW"
            />
            <PayrollMetric
              label="Detection confidence"
              value={`${payrollSummary.confidenceScore}%`}
              detail={payrollSummary.warnings[0] ?? "Evidence is internally consistent"}
              href={`/transactions?period=ALL&q=${encodeURIComponent(payrollSummary.primary?.merchantKey ?? "payroll")}`}
            />
          </div>
          {payrollSummary.warnings.length ? (
            <ul className="mt-4 list-disc pl-5 text-sm text-[var(--amber)]">
              {payrollSummary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {payrollSummary.reasons.length ? (
            <details className="mt-5">
              <summary className="cursor-pointer font-semibold">
                Detection reasoning and contributing transactions
              </summary>
              <ul className="mt-3 list-disc pl-5 text-sm text-[var(--muted)]">
                {payrollSummary.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr>
                      {["Date", "Source", "Account", "Amount", "Provenance", "Evidence"].map(
                        (label) => (
                          <th key={label} className="py-2 pr-3">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {payrollSummary.primary?.contributingTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-t border-[var(--border)]">
                        <td className="py-2 pr-3">
                          <a
                            className="underline"
                            href={`/transactions?period=ALL&q=${encodeURIComponent(transaction.merchant)}`}
                          >
                            {shortDate(transaction.date)}
                          </a>
                        </td>
                        <td className="py-2 pr-3">{transaction.merchant}</td>
                        <td className="py-2 pr-3">{transaction.accountName}</td>
                        <td className="py-2 pr-3 font-semibold">
                          {formatMoney(transaction.amountMinor)}
                        </td>
                        <td className="py-2 pr-3">{transaction.sourceType.replaceAll("_", " ")}</td>
                        <td className="py-2 pr-3">
                          {transaction.unusual ? (
                            <Pill tone="warn">Unusual amount</Pill>
                          ) : (
                            <Pill tone="good">Typical</Pill>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </Card>
      </div>

      {payroll.length ? (
        <Card className="border-[var(--teal)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Pill tone="info">Payroll detected</Pill>
              <h2 className="mt-2 text-xl font-semibold">{payroll[0].name}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {cadenceLabel(payroll[0].cadence)} · usually {weekday(payroll[0].nextExpectedDate)}{" "}
                · typical {formatMoney(payroll[0].typicalAmountMinor)}
              </p>
              <p className="mt-1 text-sm">
                Next expected: <strong>{longDate(payroll[0].nextExpectedDate)}</strong> ·
                Confidence: <strong>{capitalize(payroll[0].confidence)}</strong>
              </p>
              <p className="mt-2 max-w-3xl text-xs text-[var(--muted)]">
                {payroll[0].reasons.join(" ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => ruleAction(payroll[0].id, "CONFIRM")} disabled={pending}>
                Confirm pattern
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedRule(payroll[0]);
                  setModal("rule");
                }}
              >
                Edit
              </Button>
              <Button variant="secondary" onClick={() => ruleAction(payroll[0].id, "IGNORE")}>
                Ignore
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-xl font-semibold">Projected cash-flow timeline</h2>
            <p className="text-sm text-[var(--muted)]">
              Daily balance, scenario range, commitments, and the lowest projected point.
            </p>
          </div>
          <div className="text-right text-sm">
            <span className="block text-[var(--muted)]">Protected-cash threshold</span>
            <strong>
              {formatMoney(
                projection.emergencyFundProtectionMinor + projection.checkingBufferReserveMinor,
              )}
            </strong>
          </div>
        </div>
        <ForecastChart projection={projection} />
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-xl font-semibold">Expected activity</h2>
            <p className="text-sm text-[var(--muted)]">
              Generated from rules; posted matches are not counted twice.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModal("income")}>
              Add one-time income
            </Button>
            <Button variant="secondary" onClick={() => setModal("expense")}>
              Add upcoming bill
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr>
                {["Date", "Item", "Amount", "Source", "Status", "Confidence", "Action"].map(
                  (label) => (
                    <th key={label} className="px-4 py-3">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {futureEvents.slice(0, 80).map((event) => (
                <tr key={`${event.kind}-${event.id}`} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">{shortDate(event.date)}</td>
                  <td className="px-4 py-3 font-semibold">{event.label}</td>
                  <td
                    className={`px-4 py-3 font-semibold ${event.amountMinor > 0 ? "text-[var(--green)]" : ""}`}
                  >
                    {formatMoney(event.amountMinor)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{event.source}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        event.kind === "INFERRED"
                          ? "warn"
                          : event.status === "CHANGED"
                            ? "info"
                            : "good"
                      }
                    >
                      {event.status ?? event.kind}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">{event.confidence}</td>
                  <td className="px-4 py-3">
                    {event.ruleId ? (
                      <div className="flex gap-3">
                        {event.kind === "INFERRED" ? (
                          <button
                            className="font-semibold text-[var(--teal)]"
                            onClick={() => ruleAction(event.ruleId!, "CONFIRM")}
                          >
                            Confirm pattern
                          </button>
                        ) : (
                          <button
                            className="underline"
                            onClick={() =>
                              send("/api/forecast-occurrences", "POST", {
                                ruleId: event.ruleId,
                                expectedDate: event.date,
                                action: "SKIP",
                              })
                            }
                          >
                            Skip once
                          </button>
                        )}
                        {event.kind !== "INFERRED" ? (
                          <button
                            className="underline"
                            onClick={() => {
                              setSelectedEvent(event);
                              setModal("occurrence");
                            }}
                          >
                            Change once
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!futureEvents.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                    No future activity is confirmed yet. Detected patterns will appear here for
                    review.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div id="needs-attention">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Needs attention</h2>
              <p className="mt-1 text-sm">
                {attentionCount
                  ? `${attentionCount} items affect forecast confidence.`
                  : "Forecast inputs are complete for this period."}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                {projection.confidenceFactors
                  .filter((factor) => !factor.positive)
                  .slice(0, 4)
                  .map((factor) => (
                    <li key={factor.label}>{factor.label}</li>
                  ))}
              </ul>
            </div>
            <a
              href="/data-quality"
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold"
            >
              Review forecast inputs
            </a>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <p className="text-sm font-semibold text-[var(--muted)]">Safe to save now</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <strong className="text-4xl tabular-nums">
            {formatMoney(projection.recommendedSafeToSaveMinor)}
          </strong>
          <Pill tone={projection.confidence === "HIGH" ? "good" : "warn"}>
            {projection.confidence} confidence
          </Pill>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Based on available cash, upcoming commitments, protected savings, retained reserve, and
          the configured savings policy.
        </p>
        <details className="mt-5 border-t border-[var(--border)] pt-4">
          <summary className="cursor-pointer font-semibold">Show full calculation</summary>
          <div className="mt-4 space-y-2">
            {projection.calculationLines.map((line) => (
              <div key={line.label} className="flex justify-between gap-4 border-b py-2 text-sm">
                <span>
                  {line.label}
                  <span className="block text-xs text-[var(--muted)]">{line.help}</span>
                </span>
                <strong>{formatMoney(line.amountMinor)}</strong>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <CompactMetric
              label="Available cash"
              value={projection.startingUsableLiquidCashMinor}
            />
            <CompactMetric
              label="Protected savings"
              value={
                projection.emergencyFundProtectionMinor + projection.retainedSafetyReserveMinor
              }
            />
            <CompactMetric label="Free cash" value={projection.allocatableSurplusMinor} />
          </div>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-semibold">
              Emergency runway details
            </summary>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {projection.emergencyRunway.runwayBasisPoints == null
                ? "Unavailable until emergency-fund sources and essential obligations are configured."
                : `${(projection.emergencyRunway.runwayBasisPoints / 10_000).toFixed(1)} months of essential obligations.`}
            </p>
          </details>
        </details>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-semibold">Forecast setup</h2>
        <p className="text-sm text-[var(--muted)]">
          Confirm a pattern once; future dates are generated automatically.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rules
            .filter((rule) => !["ARCHIVED", "IGNORED"].includes(rule.state))
            .slice(0, 12)
            .map((rule) => (
              <div key={rule.id} className="rounded-md border border-[var(--border)] p-4">
                <div className="flex justify-between gap-3">
                  <strong>{rule.name}</strong>
                  <Pill
                    tone={
                      rule.state === "CONFIRMED"
                        ? "good"
                        : rule.state === "DETECTED"
                          ? "warn"
                          : "info"
                    }
                  >
                    {rule.state}
                  </Pill>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {cadenceLabel(rule.cadence)} · {formatMoney(rule.typicalAmountMinor)} · next{" "}
                  {shortDate(rule.nextExpectedDate)}
                </p>
                <div className="mt-3 flex gap-3 text-sm">
                  {rule.state === "DETECTED" ? (
                    <button
                      className="font-semibold text-[var(--teal)]"
                      onClick={() => ruleAction(rule.id, "CONFIRM")}
                    >
                      Confirm
                    </button>
                  ) : null}
                  <button
                    className="underline"
                    onClick={() => {
                      setSelectedRule(rule);
                      setModal("rule");
                    }}
                  >
                    Edit
                  </button>
                  {rule.state === "CONFIRMED" ? (
                    <button className="underline" onClick={() => ruleAction(rule.id, "PAUSE")}>
                      Pause
                    </button>
                  ) : rule.state === "PAUSED" ? (
                    <button className="underline" onClick={() => ruleAction(rule.id, "RESUME")}>
                      Resume
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      </Card>

      {modal ? (
        <ForecastModal
          kind={modal}
          householdId={householdId}
          accounts={accounts}
          rule={selectedRule}
          event={selectedEvent}
          onClose={() => {
            setModal(null);
            setSelectedRule(null);
            setSelectedEvent(null);
          }}
          send={send}
        />
      ) : null}
    </div>
  );
}

function PayrollMetric({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <a
      className="rounded-md border border-[var(--border)] p-4 hover:border-[var(--teal)]"
      href={href}
    >
      <span className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</span>
      <strong className="mt-1 block text-lg">{value}</strong>
      <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span>
    </a>
  );
}

function OutcomeCard({
  label,
  value,
  detail,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-expanded={active} className="text-left">
      <Card
        className={`h-full p-5 transition ${active ? "border-[var(--teal)] ring-2 ring-[var(--teal-soft)]" : ""}`}
      >
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span className="text-sm font-semibold">{label}</span>
          {icon}
        </div>
        <strong className="mt-3 block text-2xl tabular-nums">{value}</strong>
        <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span>
      </Card>
    </button>
  );
}

function HeadlineDetail({
  detail,
  projection,
}: {
  detail: "monthEnd" | "lowest" | "spend" | "confidence";
  projection: CashFlowProjection;
}) {
  const rows =
    detail === "monthEnd"
      ? projection.headlineExplanations.projectedMonthEnd
      : detail === "lowest"
        ? projection.headlineExplanations.lowestBalance
        : detail === "spend"
          ? projection.calculationLines.map((line, index) => ({
              id: String(index),
              label: line.label,
              amountMinor: line.amountMinor,
              date: projection.period.monthEnd,
              source: line.help,
              status: "CALCULATION",
            }))
          : [];
  return (
    <Card className="p-5">
      <h2 className="font-semibold">
        {detail === "confidence" ? "What affects confidence" : "What makes up this number"}
      </h2>
      {detail === "confidence" ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {projection.confidenceFactors.map((factor) => (
            <a
              href={factor.href ?? "#"}
              key={factor.label}
              className="rounded-md border p-3 text-sm"
            >
              <strong>{factor.label}</strong>
              <span className="block text-xs text-[var(--muted)]">{factor.explanation}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.length ? (
            rows.map((row) => (
              <div key={row.id} className="flex justify-between gap-4 border-b py-2 text-sm">
                <span>
                  {row.label}
                  <span className="block text-xs text-[var(--muted)]">{row.source}</span>
                </span>
                <strong>{formatMoney(row.amountMinor)}</strong>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No confirmed future activity contributes yet. Confirm a detected pattern or add a
              one-time item.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function ForecastChart({ projection }: { projection: CashFlowProjection }) {
  const rows = projection.dailyTimeline;
  if (!rows.length)
    return <p className="p-6 text-sm text-[var(--muted)]">No forecast dates are available.</p>;
  const values = rows.flatMap((row) => [
    row.confirmedBalanceMinor,
    row.likelyBalanceMinor,
    row.conservativeBalanceMinor,
  ]);
  const min = Math.min(...values, 0),
    max = Math.max(...values, 1),
    width = 900,
    height = 260,
    pad = 36;
  const x = (index: number) => pad + (index * (width - pad * 2)) / Math.max(1, rows.length - 1);
  const y = (value: number) =>
    height - pad - ((value - min) * (height - pad * 2)) / Math.max(1, max - min);
  const points = (
    key: "confirmedBalanceMinor" | "likelyBalanceMinor" | "conservativeBalanceMinor",
  ) => rows.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
  return (
    <div className="p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Projected daily balance from ${shortDate(rows[0].date)} to ${shortDate(rows.at(-1)!.date)}. Confirmed month-end ${formatMoney(rows.at(-1)!.confirmedBalanceMinor)}.`}
        className="h-auto w-full"
      >
        <line x1={pad} y1={y(0)} x2={width - pad} y2={y(0)} stroke="var(--border)" />
        <polyline
          points={points("conservativeBalanceMinor")}
          fill="none"
          stroke="var(--amber)"
          strokeWidth="2"
          strokeDasharray="7 5"
          aria-label="Conservative balance"
        />
        <polyline
          points={points("likelyBalanceMinor")}
          fill="none"
          stroke="var(--blue)"
          strokeWidth="2"
          strokeDasharray="3 4"
          aria-label="Likely balance"
        />
        <polyline
          points={points("confirmedBalanceMinor")}
          fill="none"
          stroke="var(--teal)"
          strokeWidth="4"
          aria-label="Confirmed balance"
        />
        <circle
          cx={x(
            rows.findIndex(
              (row) => row.confirmedBalanceMinor === projection.lowestProjectedBalanceMinor,
            ),
          )}
          cy={y(projection.lowestProjectedBalanceMinor)}
          r="6"
          fill="var(--red)"
        />
        <text x={pad} y={height - 8} fontSize="12" fill="var(--muted)">
          {shortDate(rows[0].date)}
        </text>
        <text x={width - pad} y={height - 8} textAnchor="end" fontSize="12" fill="var(--muted)">
          {shortDate(rows.at(-1)!.date)}
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-5 text-xs">
        <span>
          <i className="mr-2 inline-block h-1 w-6 bg-[var(--teal)]" />
          Confirmed
        </span>
        <span>
          <i className="mr-2 inline-block h-1 w-6 bg-[var(--blue)]" />
          Likely (dotted)
        </span>
        <span>
          <i className="mr-2 inline-block h-1 w-6 bg-[var(--amber)]" />
          Conservative (dashed)
        </span>
        <span>
          <i className="mr-2 inline-block h-3 w-3 rounded-full bg-[var(--red)]" />
          Lowest balance
        </span>
      </div>
    </div>
  );
}

function ForecastModal({
  kind,
  householdId,
  accounts,
  rule,
  event,
  onClose,
  send,
}: {
  kind: "income" | "expense" | "rule" | "occurrence";
  householdId: string;
  accounts: Account[];
  rule: Rule | null;
  event: ForecastEvent | null;
  onClose: () => void;
  send: (url: string, method: string, body: unknown) => Promise<boolean>;
}) {
  async function submit(form: FormData) {
    let ok = false;
    if (kind === "rule" && rule)
      ok = await send(`/api/forecast-rules/${rule.id}`, "PATCH", {
        name: String(form.get("name")),
        accountId: String(form.get("accountId")) || null,
        cadence: String(form.get("cadence")),
        typicalAmountMinor: parseMoneyToMinor(String(form.get("amount"))),
        nextExpectedDate: String(form.get("date")),
        dateToleranceDays: Number(form.get("dateTolerance")),
        amountToleranceBps: Number(form.get("amountTolerance")),
      });
    else if (kind === "occurrence" && event)
      ok = await send("/api/forecast-occurrences", "POST", {
        ruleId: event.ruleId,
        expectedDate: event.date,
        action: "CHANGE",
        overrideDate: String(form.get("date")) || null,
        overrideAmountMinor: parseMoneyToMinor(String(form.get("amount"))),
      });
    else if (kind === "income")
      ok = await send("/api/planning/income", "POST", {
        householdId,
        name: String(form.get("name")),
        amountMinor: parseMoneyToMinor(String(form.get("amount"))),
        frequency: "ONE_TIME",
        nextExpectedDate: String(form.get("date")),
        accountId: String(form.get("accountId")) || null,
        sourceType: "USER_ENTERED",
        confidence: "HIGH",
        active: true,
      });
    else if (kind === "expense")
      ok = await send("/api/planning/obligations", "POST", {
        householdId,
        name: String(form.get("name")),
        amountMinor: parseMoneyToMinor(String(form.get("amount"))),
        frequency: "ONE_TIME",
        dueDate: String(form.get("date")),
        accountId: String(form.get("accountId")) || null,
        obligationType: "OTHER",
        sourceType: "USER_ENTERED",
        essentiality: "ESSENTIAL",
        confidence: "HIGH",
        active: true,
      });
    if (ok) onClose();
  }
  const title =
    kind === "rule"
      ? "Edit forecast rule"
      : kind === "occurrence"
        ? "Change this occurrence"
        : kind === "income"
          ? "Add one-time income"
          : "Add upcoming bill";
  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="forecast-modal-title"
        className="mx-auto mt-12 max-w-xl rounded-lg bg-[var(--surface)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between gap-3">
          <h2 id="forecast-modal-title" className="text-xl font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close forecast dialog">
            Close
          </button>
        </div>
        <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Name
            <input
              name="name"
              required
              defaultValue={rule?.name ?? event?.label ?? ""}
              className="mt-1 h-10 w-full rounded-md border px-3"
            />
          </label>
          <label className="text-sm">
            Account
            <select
              name="accountId"
              defaultValue={rule?.account?.id ?? ""}
              className="mt-1 h-10 w-full rounded-md border px-3"
            >
              <option value="">Any / not linked</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Amount
            <input
              name="amount"
              required
              defaultValue={(
                (rule?.typicalAmountMinor ?? Math.abs(event?.amountMinor ?? 0)) / 100
              ).toFixed(2)}
              className="mt-1 h-10 w-full rounded-md border px-3"
            />
          </label>
          <label className="text-sm">
            {kind === "expense" ? "Due date" : "Next date"}
            <input
              name="date"
              type="date"
              required
              defaultValue={dateInput(rule?.nextExpectedDate ?? event?.date)}
              className="mt-1 h-10 w-full rounded-md border px-3"
            />
          </label>
          {kind === "rule" ? (
            <>
              <label className="text-sm">
                Cadence
                <select
                  name="cadence"
                  defaultValue={rule?.cadence}
                  className="mt-1 h-10 w-full rounded-md border px-3"
                >
                  {[
                    "WEEKLY",
                    "BIWEEKLY",
                    "SEMIMONTHLY",
                    "MONTHLY",
                    "QUARTERLY",
                    "ANNUAL",
                    "IRREGULAR",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Date tolerance (days)
                <input
                  name="dateTolerance"
                  type="number"
                  min="0"
                  max="10"
                  defaultValue={rule?.dateToleranceDays ?? 3}
                  className="mt-1 h-10 w-full rounded-md border px-3"
                />
              </label>
              <label className="text-sm">
                Amount tolerance (basis points)
                <input
                  name="amountTolerance"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue={rule?.amountToleranceBps ?? 1500}
                  className="mt-1 h-10 w-full rounded-md border px-3"
                />
              </label>
            </>
          ) : null}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <strong className="mt-1 block">{formatMoney(value)}</strong>
    </div>
  );
}
function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
function cadenceLabel(value: string) {
  return (
    (
      {
        BI_WEEKLY: "Every two weeks",
        BIWEEKLY: "Every two weeks",
        SEMIMONTHLY: "Twice monthly",
        MONTHLY: "Monthly",
        WEEKLY: "Weekly",
        QUARTERLY: "Quarterly",
        ANNUAL: "Annual",
        ONE_TIME: "One-time",
      } as Record<string, string>
    )[value] ?? value.toLowerCase().replaceAll("_", " ")
  );
}
function shortDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function longDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function weekday(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: "long" });
}
function dateInput(value?: Date | string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}
