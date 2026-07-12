"use client";

import { useState } from "react";
import { Archive, Copy, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, Card, MetricCard, Pill } from "@/components/data-display/primitives";
import { formatMoney, parseMoneyToMinor } from "@/domain/money/money";
import type { ScenarioEvaluation } from "@/domain/decisions/engine";

type ComponentRecord = {
  id: string;
  type: string;
  name: string;
  amountMinor: number | null;
  secondaryAmountMinor: number | null;
  frequency: string | null;
  startDate: Date | null;
  endDate: Date | null;
  durationMonths: number | null;
  essentiality: string | null;
  linkedAccountId: string | null;
  linkedDebtAccountId: string | null;
  linkedGoalId: string | null;
  linkedRecurringId: string | null;
  policyMode: string | null;
  targetBasisPoints: number | null;
  minimumDiscretionaryReserveMinor: number | null;
  extraSafetyReserveMinor: number | null;
  minimumCashRetainedMinor: number | null;
  insuranceIncreaseMinor: number | null;
  operatingIncreaseMinor: number | null;
  tradeInMinor: number | null;
};

type ScenarioRecord = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  archivedAt: Date | null;
  updatedAt: Date;
  components: ComponentRecord[];
};

type Dashboard = {
  scenarios: ScenarioRecord[];
  selected: ScenarioRecord | null;
  evaluation: ScenarioEvaluation | null;
  options: {
    accounts: { id: string; name: string; type: string }[];
    debts: { id: string; name: string }[];
    goals: { id: string; name: string }[];
    recurring: { id: string; name: string; monthlyMinor: number }[];
  };
};

const componentOptions = [
  ["RECURRING_EXPENSE", "Add monthly cost"],
  ["ONE_TIME_EXPENSE", "Add one-time purchase"],
  ["RECURRING_INCOME_CHANGE", "Change monthly income"],
  ["ONE_TIME_INCOME", "Add one-time income"],
  ["CANCEL_RECURRING", "Cancel subscription"],
  ["DEBT_EXTRA_PAYMENT", "Increase debt payment"],
  ["SAVINGS_CHANGE", "Change planned savings"],
  ["SAVINGS_POLICY_OVERRIDE", "Change savings policy"],
  ["CHECKING_BUFFER_OVERRIDE", "Change checking buffer"],
  ["VEHICLE_PAYMENT", "Add vehicle payment"],
] as const;

export function DecisionsClient({
  dashboard,
  emptyWorkspace,
}: {
  dashboard: Dashboard;
  emptyWorkspace: boolean;
}) {
  const { selected, evaluation } = dashboard;
  const [newName, setNewName] = useState("");
  const [type, setType] = useState<(typeof componentOptions)[number][0]>("RECURRING_EXPENSE");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [secondaryAmount, setSecondaryAmount] = useState("");
  const [startDate, setStartDate] = useState("2026-07-15");
  const [durationMonths, setDurationMonths] = useState("");
  const [linkedId, setLinkedId] = useState("");
  const [policyMode, setPolicyMode] = useState("BALANCED");
  const [targetPercent, setTargetPercent] = useState("50");
  const [reserveAmount, setReserveAmount] = useState("");
  const [safetyAmount, setSafetyAmount] = useState("");
  const [retainedAmount, setRetainedAmount] = useState("");
  const [insuranceAmount, setInsuranceAmount] = useState("");
  const [operatingAmount, setOperatingAmount] = useState("");
  const [tradeInAmount, setTradeInAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, options: RequestInit) {
    setBusy(true);
    setMessage("");
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error ?? "Scenario change could not be saved.");
      return null;
    }
    return body;
  }

  async function createScenario() {
    const created = await request("/api/decision-scenarios", {
      method: "POST",
      body: JSON.stringify({ name: newName }),
    });
    if (created) window.location.href = `/decisions?scenario=${created.id}`;
  }

  async function scenarioAction(action: "duplicate" | "rename" | "archive" | "delete") {
    if (!selected) return;
    if (action === "duplicate") {
      const copy = await request(`/api/decision-scenarios/${selected.id}/duplicate`, {
        method: "POST",
      });
      if (copy) window.location.href = `/decisions?scenario=${copy.id}`;
      return;
    }
    if (action === "rename") {
      const next = window.prompt("Scenario name", selected.name)?.trim();
      if (!next) return;
      const updated = await request(`/api/decision-scenarios/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: next, action: "RENAME" }),
      });
      if (updated) window.location.reload();
      return;
    }
    if (
      action === "delete" &&
      !window.confirm(`Delete ${selected.name}? This removes only the isolated scenario.`)
    )
      return;
    const updated = await request(`/api/decision-scenarios/${selected.id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      body: action === "archive" ? JSON.stringify({ action: "ARCHIVE" }) : undefined,
    });
    if (updated) window.location.href = "/decisions";
  }

  function editComponent(component: ComponentRecord) {
    setEditingId(component.id);
    setType(component.type as typeof type);
    setName(component.name);
    setAmount(component.amountMinor == null ? "" : (component.amountMinor / 100).toFixed(2));
    setSecondaryAmount(
      component.secondaryAmountMinor == null
        ? ""
        : (component.secondaryAmountMinor / 100).toFixed(2),
    );
    setStartDate(
      component.startDate ? new Date(component.startDate).toISOString().slice(0, 10) : "2026-07-15",
    );
    setDurationMonths(component.durationMonths?.toString() ?? "");
    setLinkedId(
      component.linkedRecurringId ??
        component.linkedDebtAccountId ??
        component.linkedGoalId ??
        component.linkedAccountId ??
        "",
    );
    setPolicyMode(component.policyMode ?? "BALANCED");
    setTargetPercent(
      component.targetBasisPoints == null ? "50" : String(component.targetBasisPoints / 100),
    );
    setReserveAmount(
      component.minimumDiscretionaryReserveMinor == null
        ? ""
        : (component.minimumDiscretionaryReserveMinor / 100).toFixed(2),
    );
    setSafetyAmount(
      component.extraSafetyReserveMinor == null
        ? ""
        : (component.extraSafetyReserveMinor / 100).toFixed(2),
    );
    setRetainedAmount(
      component.minimumCashRetainedMinor == null
        ? ""
        : (component.minimumCashRetainedMinor / 100).toFixed(2),
    );
    setInsuranceAmount(
      component.insuranceIncreaseMinor == null
        ? ""
        : (component.insuranceIncreaseMinor / 100).toFixed(2),
    );
    setOperatingAmount(
      component.operatingIncreaseMinor == null
        ? ""
        : (component.operatingIncreaseMinor / 100).toFixed(2),
    );
    setTradeInAmount(
      component.tradeInMinor == null ? "" : (component.tradeInMinor / 100).toFixed(2),
    );
  }

  function resetBuilder() {
    setEditingId(null);
    setName("");
    setAmount("");
    setSecondaryAmount("");
    setDurationMonths("");
    setLinkedId("");
    setReserveAmount("");
    setSafetyAmount("");
    setRetainedAmount("");
    setInsuranceAmount("");
    setOperatingAmount("");
    setTradeInAmount("");
  }

  async function saveComponent() {
    if (!selected) return;
    let amountMinor: number | null = null;
    let secondaryAmountMinor: number | null = null;
    try {
      if (amount) amountMinor = parseMoneyToMinor(amount);
      if (secondaryAmount) secondaryAmountMinor = parseMoneyToMinor(secondaryAmount);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enter valid amounts.");
      return;
    }
    const body = {
      type,
      name,
      amountMinor,
      secondaryAmountMinor,
      frequency: type.includes("ONE_TIME") ? "ONE_TIME" : "MONTHLY",
      startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`) : null,
      durationMonths: durationMonths ? Number(durationMonths) : null,
      essentiality: ["RECURRING_EXPENSE", "VEHICLE_PAYMENT"].includes(type) ? "ESSENTIAL" : null,
      linkedRecurringId: type === "CANCEL_RECURRING" ? linkedId : null,
      linkedDebtAccountId: type === "DEBT_EXTRA_PAYMENT" ? linkedId : null,
      linkedGoalId: type === "SAVINGS_CHANGE" && linkedId ? linkedId : null,
      linkedAccountId:
        ["ONE_TIME_EXPENSE", "ONE_TIME_INCOME", "VEHICLE_PAYMENT"].includes(type) && linkedId
          ? linkedId
          : null,
      policyMode: type === "SAVINGS_POLICY_OVERRIDE" ? policyMode : null,
      targetBasisPoints:
        type === "SAVINGS_POLICY_OVERRIDE" ? Math.round(Number(targetPercent) * 100) : null,
      minimumDiscretionaryReserveMinor:
        type === "SAVINGS_POLICY_OVERRIDE" && reserveAmount
          ? parseMoneyToMinor(reserveAmount)
          : null,
      extraSafetyReserveMinor:
        type === "SAVINGS_POLICY_OVERRIDE" && safetyAmount ? parseMoneyToMinor(safetyAmount) : null,
      minimumCashRetainedMinor:
        type === "SAVINGS_POLICY_OVERRIDE" && retainedAmount
          ? parseMoneyToMinor(retainedAmount)
          : null,
      insuranceIncreaseMinor:
        type === "VEHICLE_PAYMENT" && insuranceAmount ? parseMoneyToMinor(insuranceAmount) : null,
      operatingIncreaseMinor:
        type === "VEHICLE_PAYMENT" && operatingAmount ? parseMoneyToMinor(operatingAmount) : null,
      tradeInMinor:
        type === "VEHICLE_PAYMENT" && tradeInAmount ? parseMoneyToMinor(tradeInAmount) : null,
    };
    const saved = await request(
      editingId
        ? `/api/decision-scenario-components/${editingId}`
        : `/api/decision-scenarios/${selected.id}/components`,
      { method: editingId ? "PATCH" : "POST", body: JSON.stringify(body) },
    );
    if (saved) window.location.reload();
  }

  async function removeComponent(id: string) {
    const removed = await request(`/api/decision-scenario-components/${id}`, { method: "DELETE" });
    if (removed) window.location.reload();
  }

  const linkOptions =
    type === "CANCEL_RECURRING"
      ? dashboard.options.recurring
      : type === "DEBT_EXTRA_PAYMENT"
        ? dashboard.options.debts
        : type === "SAVINGS_CHANGE"
          ? dashboard.options.goals
          : ["ONE_TIME_EXPENSE", "ONE_TIME_INCOME", "VEHICLE_PAYMENT"].includes(type)
            ? dashboard.options.accounts
            : [];

  return (
    <div className="space-y-6">
      {emptyWorkspace ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">
            Explore a decision without changing real records.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Create an isolated scenario now, then add accounts, income, obligations, goals, or debts
            to unlock complete comparisons. Missing baseline information lowers confidence instead
            of being invented.
          </p>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {dashboard.scenarios.map((scenario) => (
            <a
              key={scenario.id}
              href={`/decisions?scenario=${scenario.id}`}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${selected?.id === scenario.id ? "border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]" : "border-[var(--border)] bg-white"}`}
            >
              {scenario.name}
              {scenario.archivedAt ? " · Archived" : ""}
            </a>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-4">
          <label className="min-w-[220px] flex-1 text-sm font-medium">
            New scenario name
            <input
              aria-label="New scenario name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="mt-2 w-full border border-[var(--border)] px-3"
            />
          </label>
          <Button disabled={!newName.trim() || busy} onClick={createScenario}>
            <Plus className="h-4 w-4" /> New scenario
          </Button>
          {selected ? (
            <>
              <Button variant="secondary" onClick={() => scenarioAction("rename")}>
                <Pencil className="h-4 w-4" /> Rename
              </Button>
              <Button variant="secondary" onClick={() => scenarioAction("duplicate")}>
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
              <Button variant="secondary" onClick={() => scenarioAction("archive")}>
                <Archive className="h-4 w-4" /> Archive
              </Button>
              <Button variant="secondary" onClick={() => scenarioAction("delete")}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          ) : null}
        </div>
        {message ? (
          <p role="alert" className="mt-3 text-sm text-[var(--red)]">
            {message}
          </p>
        ) : null}
      </Card>

      {!selected || !evaluation ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Create your first scenario.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Try a monthly cost, one-time purchase, income change, debt payment, or savings-policy
            change.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(330px,440px)_minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Scenario builder</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Assumptions stay isolated from actual records.
                    </p>
                  </div>
                  <Pill tone="info">Isolated</Pill>
                </div>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium">
                    Component type
                    <select
                      aria-label="Component type"
                      value={type}
                      onChange={(event) => {
                        setType(event.target.value as typeof type);
                        setLinkedId("");
                      }}
                      className="mt-2 w-full border border-[var(--border)] bg-white px-3"
                    >
                      {componentOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Name
                    <input
                      aria-label="Component name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mt-2 w-full border border-[var(--border)] px-3"
                    />
                  </label>
                  {!(["CANCEL_RECURRING", "SAVINGS_POLICY_OVERRIDE"] as string[]).includes(type) ? (
                    <label className="block text-sm font-medium">
                      {type === "RECURRING_INCOME_CHANGE" || type === "SAVINGS_CHANGE"
                        ? "Monthly change (negative reduces)"
                        : "Amount"}
                      <input
                        aria-label="Component amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="mt-2 w-full border border-[var(--border)] px-3"
                      />
                    </label>
                  ) : null}
                  {type === "VEHICLE_PAYMENT" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        Down payment
                        <input
                          aria-label="Down payment"
                          inputMode="decimal"
                          value={secondaryAmount}
                          onChange={(event) => setSecondaryAmount(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Trade-in proceeds
                        <input
                          aria-label="Trade-in proceeds"
                          inputMode="decimal"
                          value={tradeInAmount}
                          onChange={(event) => setTradeInAmount(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Insurance increase
                        <input
                          aria-label="Insurance increase"
                          inputMode="decimal"
                          value={insuranceAmount}
                          onChange={(event) => setInsuranceAmount(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Fuel and maintenance increase
                        <input
                          aria-label="Fuel and maintenance increase"
                          inputMode="decimal"
                          value={operatingAmount}
                          onChange={(event) => setOperatingAmount(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                    </div>
                  ) : null}
                  {linkOptions.length ? (
                    <label className="block text-sm font-medium">
                      Linked record
                      <select
                        aria-label="Linked record"
                        value={linkedId}
                        onChange={(event) => setLinkedId(event.target.value)}
                        className="mt-2 w-full border border-[var(--border)] bg-white px-3"
                      >
                        <option value="">Select…</option>
                        {linkOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {type === "SAVINGS_POLICY_OVERRIDE" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        Policy mode
                        <select
                          aria-label="Policy mode"
                          value={policyMode}
                          onChange={(event) => setPolicyMode(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] bg-white px-3"
                        >
                          {["CONSERVATIVE", "BALANCED", "AGGRESSIVE", "CUSTOM"].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-medium">
                        Savings target %
                        <input
                          aria-label="Savings target percent"
                          value={targetPercent}
                          onChange={(event) => setTargetPercent(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Discretionary reserve
                        <input
                          aria-label="Discretionary reserve"
                          inputMode="decimal"
                          value={reserveAmount}
                          onChange={(event) => setReserveAmount(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Extra safety reserve
                        <input
                          aria-label="Extra safety reserve"
                          inputMode="decimal"
                          value={safetyAmount}
                          onChange={(event) => setSafetyAmount(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Minimum retained cash
                        <input
                          aria-label="Minimum retained cash"
                          inputMode="decimal"
                          value={retainedAmount}
                          onChange={(event) => setRetainedAmount(event.target.value)}
                          className="mt-2 w-full border border-[var(--border)] px-3"
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Start date
                      <input
                        aria-label="Component start date"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="mt-2 w-full border border-[var(--border)] px-3"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Duration months
                      <input
                        aria-label="Duration months"
                        inputMode="numeric"
                        value={durationMonths}
                        onChange={(event) => setDurationMonths(event.target.value)}
                        className="mt-2 w-full border border-[var(--border)] px-3"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!name.trim() || busy} onClick={saveComponent}>
                      {editingId ? "Save component" : "Add component"}
                    </Button>
                    {editingId ? (
                      <Button variant="secondary" onClick={resetBuilder}>
                        <RotateCcw className="h-4 w-4" /> Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="text-xl font-semibold">Active components</h2>
                <div className="mt-4 space-y-3">
                  {selected.components.length ? (
                    selected.components.map((component) => (
                      <div
                        key={component.id}
                        className="rounded-lg border border-[var(--border)] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <strong>{component.name}</strong>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {friendlyType(component.type)} ·{" "}
                              {component.amountMinor == null
                                ? "Linked assumption"
                                : formatMoney(component.amountMinor)}
                              {component.startDate
                                ? ` · ${new Date(component.startDate).toISOString().slice(0, 10)}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              aria-label={`Edit ${component.name}`}
                              onClick={() => editComponent(component)}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`Remove ${component.name}`}
                              onClick={() => removeComponent(component.id)}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      No assumptions yet. Add one above.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <div className="min-w-0 space-y-6">
              <div className="metric-grid" aria-label="Scenario impact horizons">
                <MetricCard
                  label="Upfront impact"
                  value={formatSigned(evaluation.impacts.oneTimeMinor)}
                  detail="Net one-time cash events; never included in the monthly amount"
                />
                <MetricCard
                  label="Ongoing monthly impact"
                  value={formatSigned(evaluation.impacts.ongoingMonthlyMinor)}
                  detail="Recurring change for one modeled monthly occurrence"
                />
                <MetricCard
                  label="Current-period impact"
                  value={formatSigned(evaluation.impacts.currentPeriodMinor)}
                  detail="Only events and occurrences in the selected financial period"
                />
                <MetricCard
                  label="First 12-month impact"
                  value={formatSigned(evaluation.impacts.firstYearMinor)}
                  detail="Upfront events plus applicable recurring occurrences"
                />
              </div>
              <div className="metric-grid">
                <MetricCard
                  label="Scenario confidence"
                  value={titleCase(evaluation.confidence)}
                  detail={`${evaluation.validation.length} validation issues`}
                />
                <MetricCard
                  label="Projected month-end"
                  value={formatMoney(evaluation.scenario.projectedMonthEndMinor)}
                  detail={deltaText(
                    evaluation.scenario.projectedMonthEndMinor -
                      evaluation.baseline.projectedMonthEndMinor,
                  )}
                />
                <MetricCard
                  label="Safe to Save"
                  value={formatMoney(evaluation.scenario.recommendedSafeToSaveMinor)}
                  detail={deltaText(
                    evaluation.scenario.recommendedSafeToSaveMinor -
                      evaluation.baseline.recommendedSafeToSaveMinor,
                  )}
                />
                <MetricCard
                  label="Safe to Spend"
                  value={formatMoney(evaluation.scenario.safeToSpendMinor)}
                  detail={deltaText(
                    evaluation.scenario.safeToSpendMinor - evaluation.baseline.safeToSpendMinor,
                  )}
                />
              </div>
              <Card className="overflow-hidden">
                <div className="p-5">
                  <h2 className="text-xl font-semibold">Current plan vs. scenario</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Every difference is calculated by the validated Cash Flow engine.
                  </p>
                </div>
                <div className="overflow-x-auto" tabIndex={0} aria-label="Scenario comparison">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left">Metric</th>
                        <th className="px-4 py-3 text-right">Current</th>
                        <th className="px-4 py-3 text-right">Scenario</th>
                        <th className="px-4 py-3 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluation.metrics.map((metric) => (
                        <tr key={metric.key} className="border-t border-[var(--border)]">
                          <td className="px-4 py-3">
                            <strong>{metric.label}</strong>
                            <span className="mt-1 block text-xs text-[var(--muted)]">
                              {metric.explanation}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                            {formatMoney(metric.currentMinor)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                            {formatMoney(metric.scenarioMinor)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${metric.differenceMinor < 0 ? "text-[var(--red)]" : metric.differenceMinor > 0 ? "text-[var(--green)]" : ""}`}
                          >
                            {formatSigned(metric.differenceMinor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <details className="border-t border-[var(--border)]">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
                    Detailed impact-horizon breakdown
                  </summary>
                  <div
                    className="overflow-x-auto"
                    tabIndex={0}
                    aria-label="Impact horizon breakdown"
                  >
                    <table className="w-full min-w-[820px] text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left">Assumption</th>
                          <th className="px-4 py-3 text-right">Upfront</th>
                          <th className="px-4 py-3 text-right">Monthly</th>
                          <th className="px-4 py-3 text-right">Current period</th>
                          <th className="px-4 py-3 text-right">First 12 months</th>
                          <th className="px-4 py-3 text-right">Bounded total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluation.impacts.components.map((impact) => (
                          <tr key={impact.componentId} className="border-t border-[var(--border)]">
                            <td className="px-4 py-3">
                              <strong>{impact.name}</strong>
                              <span className="mt-1 block text-xs text-[var(--muted)]">
                                {impact.explanation}
                              </span>
                            </td>
                            {[
                              impact.oneTimeMinor,
                              impact.ongoingMonthlyMinor,
                              impact.currentPeriodMinor,
                              impact.firstYearMinor,
                            ].map((value, index) => (
                              <td
                                key={index}
                                className="whitespace-nowrap px-4 py-3 text-right tabular-nums"
                              >
                                {formatSigned(value)}
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                              {impact.boundedLongTermMinor == null
                                ? "Ongoing"
                                : formatSigned(impact.boundedLongTermMinor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm sm:grid-cols-3">
                    <span>
                      Current-period upfront:{" "}
                      <strong>{formatSigned(evaluation.impacts.currentPeriodOneTimeMinor)}</strong>
                    </span>
                    <span>
                      Current-period recurring:{" "}
                      <strong>
                        {formatSigned(evaluation.impacts.currentPeriodRecurringMinor)}
                      </strong>
                    </span>
                    <span>
                      Interaction/reconciliation:{" "}
                      <strong>
                        {formatSigned(evaluation.impacts.currentPeriodInteractionMinor)}
                      </strong>
                    </span>
                  </div>
                </details>
              </Card>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <h2 className="text-xl font-semibold">Interpretation and risks</h2>
                  <div className="mt-4 space-y-3">
                    {evaluation.interpretations.map((interpretation) => (
                      <p
                        key={interpretation}
                        className="rounded-lg bg-[var(--teal-soft)] p-3 text-sm"
                      >
                        {interpretation}
                      </p>
                    ))}
                    {evaluation.risks.map((risk) => (
                      <div key={risk.code} className="rounded-lg border border-[var(--border)] p-3">
                        <Pill
                          tone={
                            risk.level === "CRITICAL"
                              ? "bad"
                              : risk.level === "WARNING"
                                ? "warn"
                                : risk.level === "POSITIVE"
                                  ? "good"
                                  : "info"
                          }
                        >
                          {titleCase(risk.level)}
                        </Pill>
                        <strong className="mt-2 block">{risk.title}</strong>
                        <p className="mt-1 text-sm text-[var(--muted)]">{risk.explanation}</p>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <h2 className="text-xl font-semibold">Emergency-fund runway</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Immediate linked emergency-fund balance divided by average monthly essential
                    scheduled obligations, debt minimums, and essential scenario recurring costs.
                    Optional costs, goal contributions, and one-time costs are excluded from the
                    denominator.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-[var(--muted)]">Current</span>
                      <strong className="mt-1 block text-2xl tabular-nums">
                        {formatRunway(evaluation.baselineEmergencyRunwayBps)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-sm text-[var(--muted)]">Scenario</span>
                      <strong className="mt-1 block text-2xl tabular-nums">
                        {formatRunway(evaluation.scenarioEmergencyRunwayBps)}
                      </strong>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted)]">Immediate emergency balance</span>
                      <strong className="whitespace-nowrap tabular-nums">
                        {formatMoney(evaluation.baselineEmergencyBalanceMinor)} →{" "}
                        {formatMoney(evaluation.scenarioEmergencyBalanceMinor)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--muted)]">Essential monthly denominator</span>
                      <strong className="whitespace-nowrap tabular-nums">
                        {formatMoney(evaluation.baselineEssentialMonthlyMinor)} →{" "}
                        {formatMoney(evaluation.scenarioEssentialMonthlyMinor)}
                      </strong>
                    </div>
                  </div>
                  <details className="mt-4 border-t border-[var(--border)] pt-4">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Explain scenario runway composition
                    </summary>
                    <div className="mt-3 space-y-3 text-sm">
                      {evaluation.scenarioEmergencyRunway.sources.map((source) => (
                        <div key={source.goalId} className="flex justify-between gap-3">
                          <span>
                            {source.goalName} · {source.accountName}
                            <span className="block text-xs text-[var(--muted)]">
                              Ledger {formatMoney(source.ledgerBalanceMinor)} · protected{" "}
                              {formatMoney(source.protectedMinor)} · scenario withdrawal{" "}
                              {formatMoney(source.withdrawalMinor)}
                            </span>
                          </span>
                          <strong>{formatMoney(source.resultingEligibleMinor)}</strong>
                        </div>
                      ))}
                      <div className="border-t pt-3">
                        <strong>Essential monthly obligations</strong>
                        {evaluation.scenarioEmergencyRunway.obligations.map((obligation) => (
                          <div
                            key={obligation.id}
                            className="mt-2 flex justify-between gap-3 text-xs"
                          >
                            <span>
                              {obligation.label} ·{" "}
                              {obligation.source.toLowerCase().replace("_", " ")}
                            </span>
                            <strong>{formatMoney(obligation.monthlyMinor)}</strong>
                          </div>
                        ))}
                      </div>
                      <p className="border-t pt-3 text-xs text-[var(--muted)]">
                        Excludes optional costs, goal contributions, planned savings, extra debt
                        payments, buffers, one-time costs from the denominator, and linked duplicate
                        obligations.
                      </p>
                    </div>
                  </details>
                </Card>
              </div>
              <Card className="p-5">
                <h2 className="text-xl font-semibold">Goal impact</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {evaluation.goalImpacts.map((goal) => (
                    <div key={goal.id} className="rounded-lg border border-[var(--border)] p-3">
                      <strong>{goal.name}</strong>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Current {formatMonth(goal.currentDate)} · Scenario{" "}
                        {formatMonth(goal.scenarioDate)}
                      </p>
                      <p className="mt-1 text-sm">
                        {goal.differenceMonths == null
                          ? "Completion unavailable"
                          : goal.differenceMonths === 0
                            ? "No date change"
                            : goal.differenceMonths > 0
                              ? `${goal.differenceMonths} months delayed`
                              : `${Math.abs(goal.differenceMonths)} months improved`}
                      </p>
                      <p
                        className={`mt-2 text-xs ${goal.affordable ? "text-[var(--muted)]" : "font-semibold text-[var(--red)]"}`}
                      >
                        {goal.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="text-xl font-semibold">Debt impact</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Impact
                    label="Current debt-free"
                    value={formatMonth(evaluation.baselineDebt.debtFreeDate)}
                  />
                  <Impact
                    label="Scenario debt-free"
                    value={formatMonth(evaluation.scenarioDebt.debtFreeDate)}
                  />
                  <Impact
                    label="Interest change"
                    value={
                      evaluation.scenarioDebt.interestSavedMinor == null
                        ? "Unavailable"
                        : formatSigned(-evaluation.scenarioDebt.interestSavedMinor)
                    }
                  />
                  <Impact
                    label="Time change"
                    value={
                      evaluation.scenarioDebt.timeSavedMonths == null
                        ? "Unavailable"
                        : `${evaluation.scenarioDebt.timeSavedMonths} months saved`
                    }
                  />
                  <Impact
                    label="First-year additional payment"
                    value={formatMoney(
                      Math.abs(
                        evaluation.impacts.components
                          .filter((impact) => impact.type === "DEBT_EXTRA_PAYMENT")
                          .reduce((sum, impact) => sum + impact.firstYearMinor, 0),
                      ),
                    )}
                  />
                  <Impact
                    label="Bounded additional payment"
                    value={formatDebtBounded(evaluation)}
                  />
                </div>
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Interest savings are a long-term payoff estimate and are not counted as current
                  cash.
                </p>
              </Card>
              <Card className="p-5">
                <h2 className="text-xl font-semibold">Scenario timeline</h2>
                <div className="mt-4 space-y-2">
                  {evaluation.timeline.map((event) => (
                    <div
                      key={event.id}
                      className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[110px_1fr_auto]"
                    >
                      <span className="text-sm text-[var(--muted)]">
                        {new Date(event.date).toISOString().slice(0, 10)}
                      </span>
                      <span>
                        <strong>{event.label}</strong>
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          {event.id === "current"
                            ? "Existing recorded"
                            : event.amountMinor >= 0
                              ? "Scenario addition"
                              : "Scenario obligation"}
                        </span>
                      </span>
                      <strong className="whitespace-nowrap tabular-nums">
                        {formatSigned(event.amountMinor)}
                      </strong>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Impact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <strong className="mt-1 block whitespace-nowrap tabular-nums">{value}</strong>
    </div>
  );
}
function friendlyType(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${formatMoney(value)}`;
}
function deltaText(value: number) {
  return value === 0 ? "No change" : `${formatSigned(value)} vs. current`;
}
function formatMonth(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
        new Date(value),
      )
    : "Unavailable";
}
function formatRunway(value: number | null) {
  return value == null ? "Unavailable" : `${(value / 10_000).toFixed(1)} months`;
}
function formatDebtBounded(evaluation: ScenarioEvaluation) {
  const impacts = evaluation.impacts.components.filter(
    (impact) => impact.type === "DEBT_EXTRA_PAYMENT",
  );
  if (!impacts.length) return formatMoney(0);
  if (impacts.some((impact) => impact.boundedLongTermMinor == null)) return "Ongoing";
  return formatMoney(
    Math.abs(impacts.reduce((sum, impact) => sum + (impact.boundedLongTermMinor ?? 0), 0)),
  );
}
