"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDollarSign, Edit3, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { Button, Card, MetricCard, Pill } from "@/components/data-display/primitives";
import { formatMoney, parseMoneyToMinor } from "@/domain/money/money";

type CategoryDto = { id: string; name: string; group: string };
type SupportDto = {
  id: string;
  confidence: string;
  transaction: {
    id: string;
    normalizedMerchant: string;
    originalDescription: string;
    amountMinor: number;
    transactionDate: string;
    account: { name: string };
    category?: { name: string } | null;
  };
};
type RecurringDto = {
  id: string;
  displayName: string;
  serviceName?: string | null;
  merchantKey: string;
  categoryId?: string | null;
  frequency: string;
  typicalAmountMinor: number;
  minAmountMinor: number;
  maxAmountMinor: number;
  monthlyEquivalentMinor: number;
  annualEquivalentMinor: number;
  amountVariabilityBps: number;
  confidence: string;
  confidenceScore: number;
  status: string;
  classification: string;
  recommendation: string;
  recurringType: string;
  firstObservedDate: string;
  lastObservedDate: string;
  nextExpectedDate?: string | null;
  priceChangeAmountMinor: number;
  priceChangeBps: number;
  priceChangeEffectiveDate?: string | null;
  priceChangeCurrentAmountMinor?: number | null;
  priceChangePreviousAmountMinor?: number | null;
  userNotes?: string | null;
  canceledAt?: string | null;
  expectedFinalChargeDate?: string | null;
  reasons: string[];
  supportCount: number;
  support?: SupportDto[];
  category?: { name: string } | null;
};
type RecurringData = {
  household: { id: string };
  categories: CategoryDto[];
  items: RecurringDto[];
  summary: {
    monthlyTotalMinor: number;
    annualTotalMinor: number;
    essentialMinor: number;
    usefulMinor: number;
    optionalMinor: number;
    underReview: number;
    priceIncreases: number;
  };
};

const frequencyLabels: Record<string, string> = {
  WEEKLY: "Weekly",
  BI_WEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
  EVERY_TWO_MONTHS: "Every two months",
  QUARTERLY: "Quarterly",
  SEMIANNUAL: "Twice a year",
  ANNUAL: "Annual",
  IRREGULAR_RECURRING: "Irregular pattern",
};
const statusLabels: Record<string, string> = {
  SUGGESTED: "Suggested",
  NEEDS_REVIEW: "Needs review",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  CANCELED: "Canceled",
  INACTIVE: "Inactive",
};
const classificationLabels: Record<string, string> = {
  ESSENTIAL: "Essential",
  USEFUL: "Useful",
  OPTIONAL: "Optional",
  CANCELLATION_CANDIDATE: "Cancellation candidate",
  UNKNOWN: "Unknown",
  NEEDS_REVIEW: "Needs review",
};
const recommendationLabels: Record<string, string> = {
  KEEP: "Keep",
  REVIEW: "Review",
  CONSIDER_CANCELING: "Consider canceling",
  RENEGOTIATE: "Consider negotiating",
  UNKNOWN: "Unknown",
};
const typeLabels: Record<string, string> = {
  SUBSCRIPTION: "Subscription",
  RECURRING_BILL: "Recurring bill",
  UTILITY: "Utility",
  INSURANCE: "Insurance",
  LOAN_PAYMENT: "Loan payment",
  MEMBERSHIP: "Membership",
  SERVICE_CONTRACT: "Service contract",
  OTHER_RECURRING_EXPENSE: "Other recurring expense",
};

const frequencies = Object.keys(frequencyLabels);
const classifications = Object.keys(classificationLabels);
const recommendations = Object.keys(recommendationLabels);
const recurringTypes = Object.keys(typeLabels);

export function RecurringClient({ data }: { data: RecurringData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("CURRENT");
  const [classification, setClassification] = useState("");
  const [priceIncreasesOnly, setPriceIncreasesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecurringDto | null>(null);
  const [message, setMessage] = useState("");
  const [savings, setSavings] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter((item) => {
      const text = [item.displayName, item.serviceName ?? "", item.category?.name ?? ""]
        .join(" ")
        .toLowerCase();
      return (
        (!q || text.includes(q)) &&
        (!status ||
          (status === "CURRENT" ? !isHistoricalStatus(item.status) : item.status === status)) &&
        (!classification || item.classification === classification) &&
        (!priceIncreasesOnly || item.priceChangeAmountMinor > 0)
      );
    });
  }, [classification, data.items, priceIncreasesOnly, query, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, page * pageSize);

  async function refreshFromServer() {
    startTransition(() => router.refresh());
  }

  async function scan() {
    setMessage("Scanning local transactions.");
    const result = await postJson("/api/recurring/scan", {});
    setMessage(
      result.ok
        ? `Scan complete: ${result.result.createdCount + result.result.refreshedCount} candidates updated.`
        : result.error,
    );
    refreshFromServer();
  }

  async function action(id: string, path: string, body: Record<string, unknown>, done: string) {
    const result = await postJson(`/api/recurring/${id}/${path}`, body);
    setMessage(result.ok ? done : result.error);
    if (result.ok && ["reject", "cancel"].includes(path)) {
      setChecked((current) => current.filter((selectedId) => selectedId !== id));
    }
    refreshFromServer();
  }

  async function saveEdit(values: Partial<RecurringDto>) {
    if (!selected) return;
    const result = await patchJson(`/api/recurring/${selected.id}`, values);
    setMessage(result.ok ? "Recurring expense updated." : result.error);
    setSelected(null);
    refreshFromServer();
  }

  async function openRecurring(item: RecurringDto) {
    setMessage("Loading supporting transactions.");
    const response = await fetch(`/api/recurring/${item.id}`);
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(json.error ?? "Could not load supporting transactions.");
      return;
    }
    setSelected({ ...item, ...json.recurring, supportCount: item.supportCount });
    setMessage("");
  }

  async function calculateSavings() {
    const result = await postJson("/api/recurring/savings", { ids: checked });
    setSavings(
      result.ok
        ? `${formatMoney(result.savings.monthlySavingsMinor)} monthly, ${formatMoney(result.savings.annualSavingsMinor)} annual`
        : result.error,
    );
  }

  return (
    <>
      <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Monthly total" value={formatMoney(data.summary.monthlyTotalMinor)} />
        <MetricCard label="Annual total" value={formatMoney(data.summary.annualTotalMinor)} />
        <MetricCard
          label="Essential"
          value={formatMoney(data.summary.essentialMinor)}
          tone="positive"
        />
        <MetricCard label="Useful" value={formatMoney(data.summary.usefulMinor)} />
        <MetricCard
          label="Optional"
          value={formatMoney(data.summary.optionalMinor)}
          tone="warning"
        />
      </div>
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Review recurring activity</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Scan for new patterns, review suggestions, or add a recurring item manually.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.summary.underReview ? (
              <Pill tone="info">{data.summary.underReview} under review</Pill>
            ) : null}
            {data.summary.priceIncreases ? (
              <button
                type="button"
                aria-pressed={priceIncreasesOnly}
                aria-label={
                  priceIncreasesOnly
                    ? "Exit price-increase view"
                    : `Show ${data.summary.priceIncreases} recurring price ${data.summary.priceIncreases === 1 ? "increase" : "increases"}`
                }
                onClick={() => {
                  setPriceIncreasesOnly((current) => !current);
                  setStatus(priceIncreasesOnly ? "CURRENT" : "");
                  setPage(1);
                }}
              >
                <Pill tone="warn">
                  {priceIncreasesOnly ? (
                    <span className="inline-flex items-center gap-1">
                      <X className="h-3.5 w-3.5" /> Exit price-increase view
                    </span>
                  ) : (
                    <>
                      View {data.summary.priceIncreases} price{" "}
                      {data.summary.priceIncreases === 1 ? "increase" : "increases"}
                    </>
                  )}
                </Pill>
              </button>
            ) : null}
            {isPending ? <Pill tone="info">Refreshing</Pill> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          <Button onClick={() => setManualOpen(true)}>Create recurring item</Button>
          <Button variant="secondary" onClick={scan}>
            <RefreshCw className="h-4 w-4" /> Run scan
          </Button>
          <Button variant="secondary" disabled={!checked.length} onClick={calculateSavings}>
            <CircleDollarSign className="h-4 w-4" /> Calculate selected savings
          </Button>
        </div>
        <div aria-live="polite" className="mt-3 text-sm text-[var(--muted)]">
          {savings ||
            message ||
            "Detection stays local and excludes confirmed transfers, income, refunds, and card payments."}
        </div>
      </Card>
      <Card className="mb-5 p-5">
        <div className="grid items-end gap-3 lg:grid-cols-[minmax(240px,1.3fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
          <label className="text-sm text-[var(--muted)]">
            Search
            <div className="mt-2 flex h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3">
              <Search className="h-4 w-4" />
              <input
                className="w-full bg-transparent text-[var(--text)] outline-none"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </label>
          <Select
            label="Status"
            value={status}
            options={["CURRENT", "", ...Object.keys(statusLabels)]}
            labels={{ CURRENT: "Current & review", "": "All statuses", ...statusLabels }}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <Select
            label="Classification"
            value={classification}
            options={["", ...classifications]}
            labels={{ "": "All classifications", ...classificationLabels }}
            onChange={(value) => {
              setClassification(value);
              setPage(1);
            }}
          />
          <div className="flex min-h-11 items-center justify-between gap-3 text-sm text-[var(--muted)] lg:justify-end">
            <span>{resultRange(page, totalPages, pageSize, visible.length, filtered.length)}</span>
            {query || status !== "CURRENT" || classification || priceIncreasesOnly ? (
              <button
                className="whitespace-nowrap font-semibold text-[var(--teal)]"
                onClick={() => {
                  setQuery("");
                  setStatus("CURRENT");
                  setClassification("");
                  setPriceIncreasesOnly(false);
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="max-h-[680px] overflow-auto">
          <table className="w-full min-w-[1200px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-14" />
              <col className="w-[210px]" />
              <col className="w-[120px]" />
              <col className="w-[220px]" />
              <col className="w-[120px]" />
              <col className="w-[180px]" />
              <col className="w-[105px]" />
              <col className="w-[190px]" />
            </colgroup>
            <thead className="sticky top-0 bg-[var(--surface)] text-[var(--muted)]">
              <tr>
                {[
                  "Select",
                  "Recurring item",
                  "Amount",
                  "Schedule",
                  "Confidence",
                  "Decision",
                  "Evidence",
                  "Actions",
                ].map((head) => (
                  <th key={head} className="px-4 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-[var(--border)] align-top ${item.priceChangeAmountMinor > 0 ? "bg-[color-mix(in_srgb,var(--amber)_6%,transparent)]" : ""}`}
                >
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Select ${item.displayName} for savings`}
                      type="checkbox"
                      checked={checked.includes(item.id)}
                      onChange={(event) =>
                        setChecked((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className="text-left font-semibold hover:text-[var(--teal)]"
                      onClick={() => openRecurring(item)}
                    >
                      {item.displayName}
                    </button>
                    <div className="text-xs text-[var(--muted)]">
                      {item.serviceName || typeLabels[item.recurringType] || "Recurring expense"}
                    </div>
                    <div className="mt-2">
                      <Pill tone={statusTone(item.status)}>
                        {statusLabels[item.status] ?? item.status}
                      </Pill>
                    </div>
                    {item.priceChangeAmountMinor > 0 ? (
                      <div className="mt-2">
                        <Pill tone="warn">Price increased</Pill>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    {item.priceChangeAmountMinor > 0 &&
                    item.priceChangeCurrentAmountMinor != null ? (
                      <div className="font-semibold">
                        {item.priceChangePreviousAmountMinor != null ? (
                          <span className="mr-1 text-[var(--muted)] line-through">
                            {formatMoney(item.priceChangePreviousAmountMinor)}
                          </span>
                        ) : null}
                        <span>→ {formatMoney(item.priceChangeCurrentAmountMinor)}</span>
                      </div>
                    ) : (
                      <div>{formatMoney(item.typicalAmountMinor)}</div>
                    )}
                    <div className="text-xs text-[var(--muted)]">
                      {formatMoney(item.monthlyEquivalentMinor)}/mo
                    </div>
                    {item.priceChangeAmountMinor > 0 ? (
                      <>
                        <div className="mt-1 text-xs font-semibold text-[var(--amber)]">
                          +{formatMoney(item.priceChangeAmountMinor)} (+
                          {(item.priceChangeBps / 100).toFixed(1)}%)
                        </div>
                        {item.priceChangeEffectiveDate ? (
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            Detected {shortDate(item.priceChangeEffectiveDate)}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      {frequencyLabels[item.frequency] ?? item.frequency}
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      Last {shortDate(item.lastObservedDate)}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Next {nextExpectedLabel(item)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Pill
                      tone={
                        item.confidence === "HIGH"
                          ? "good"
                          : item.confidence === "MEDIUM"
                            ? "info"
                            : "warn"
                      }
                    >
                      {friendlyConfidence(item.confidence)} {item.confidenceScore}
                    </Pill>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      {classificationLabels[item.classification] ?? item.classification}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {recommendationLabels[item.recommendation] ?? item.recommendation}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className="text-left text-[var(--teal)] underline"
                      onClick={() => openRecurring(item)}
                    >
                      {item.supportCount} transactions
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {["SUGGESTED", "NEEDS_REVIEW"].includes(item.status) ? (
                        <>
                          <RowActionButton
                            label="Confirm"
                            onClick={() =>
                              action(
                                item.id,
                                "confirm",
                                { confirmation: "CONFIRM RECURRING" },
                                "Recurring item confirmed.",
                              )
                            }
                          >
                            <Check className="h-4 w-4" />
                          </RowActionButton>
                          <RowActionButton
                            label="Reject"
                            onClick={() =>
                              action(
                                item.id,
                                "reject",
                                { confirmation: "REJECT RECURRING" },
                                "Recurring suggestion rejected.",
                              )
                            }
                          >
                            <X className="h-4 w-4" />
                          </RowActionButton>
                        </>
                      ) : null}
                      <RowActionButton label="Edit" onClick={() => openRecurring(item)}>
                        <Edit3 className="h-4 w-4" />
                      </RowActionButton>
                      {item.status === "CANCELED" ? (
                        <RowActionButton
                          label="Reactivate"
                          onClick={() =>
                            action(
                              item.id,
                              "reactivate",
                              { confirmation: "CONFIRM RECURRING" },
                              "Recurring item reactivated.",
                            )
                          }
                        >
                          <RotateCcw className="h-4 w-4" />
                        </RowActionButton>
                      ) : (
                        <RowActionButton
                          label="Mark canceled"
                          onClick={() =>
                            action(
                              item.id,
                              "cancel",
                              {
                                confirmation: "MARK CANCELED",
                                canceledAt: new Date().toISOString(),
                                reactivateOnFutureMatch: true,
                              },
                              "Recurring item marked canceled.",
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </RowActionButton>
                      )}
                      {item.priceChangeAmountMinor > 0 ? (
                        <RowActionButton
                          label="Review increase"
                          onClick={() => openRecurring(item)}
                        >
                          <CircleDollarSign className="h-4 w-4" />
                        </RowActionButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="font-semibold">No recurring items match these filters.</div>
                    <button
                      className="mt-2 text-sm font-semibold text-[var(--teal)]"
                      onClick={() => {
                        setQuery("");
                        setStatus("CURRENT");
                        setClassification("");
                        setPriceIncreasesOnly(false);
                        setPage(1);
                      }}
                    >
                      Return to current items
                    </button>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] p-4">
          <span className="text-sm text-[var(--muted)]">
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
      {selected ? (
        <RecurringDrawer
          item={selected}
          categories={data.categories}
          onClose={() => setSelected(null)}
          onSave={saveEdit}
        />
      ) : null}
      {manualOpen ? (
        <ManualRecurringDialog
          householdId={data.household.id}
          categories={data.categories}
          onClose={() => setManualOpen(false)}
          onCreated={(ok, text) => {
            setManualOpen(false);
            setMessage(text);
            if (ok) refreshFromServer();
          }}
        />
      ) : null}
    </>
  );
}

function RecurringDrawer({
  item,
  categories,
  onClose,
  onSave,
}: {
  item: RecurringDto;
  categories: CategoryDto[];
  onClose: () => void;
  onSave: (values: Partial<RecurringDto>) => void;
}) {
  const [form, setForm] = useState({
    displayName: item.displayName,
    serviceName: item.serviceName ?? "",
    categoryId: item.categoryId ?? "",
    frequency: item.frequency,
    classification: item.classification,
    recommendation: item.recommendation,
    recurringType: item.recurringType,
    userNotes: item.userNotes ?? "",
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        className="ml-auto h-full w-full max-w-[620px] overflow-y-auto bg-[var(--surface)] p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close recurring drawer"
          className="float-right rounded-md border border-[var(--border)] px-3 py-1"
          onClick={onClose}
        >
          Close
        </button>
        <h2 className="text-2xl font-semibold">{item.displayName}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Review the supporting transactions before confirming or changing the classification.
        </p>
        {item.priceChangeAmountMinor > 0 ? (
          <section className="mt-6 rounded-lg border border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] p-4">
            <Pill tone="warn">Price increased</Pill>
            <h3 className="mt-3 font-semibold">Detected recurring price change</h3>
            <p className="mt-1 text-sm">
              {item.priceChangePreviousAmountMinor != null &&
              item.priceChangeCurrentAmountMinor != null
                ? `${formatMoney(item.priceChangePreviousAmountMinor)} → ${formatMoney(item.priceChangeCurrentAmountMinor)}`
                : `Increase of ${formatMoney(item.priceChangeAmountMinor)}`}
              {` · +${(item.priceChangeBps / 100).toFixed(1)}%`}
              {item.priceChangeEffectiveDate
                ? ` · detected ${shortDate(item.priceChangeEffectiveDate)}`
                : ""}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Review the supporting transactions below before changing its classification or
              recommendation.
            </p>
          </section>
        ) : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Display name"
            value={form.displayName}
            onChange={(displayName) => setForm({ ...form, displayName })}
          />
          <Field
            label="Service name"
            value={form.serviceName}
            onChange={(serviceName) => setForm({ ...form, serviceName })}
          />
          <Select
            label="Category"
            value={form.categoryId}
            options={["", ...categories.map((category) => category.id)]}
            labels={{
              "": "Uncategorized",
              ...Object.fromEntries(categories.map((category) => [category.id, category.name])),
            }}
            onChange={(categoryId) => setForm({ ...form, categoryId })}
          />
          <Select
            label="Frequency"
            value={form.frequency}
            options={frequencies}
            labels={frequencyLabels}
            onChange={(frequency) => setForm({ ...form, frequency })}
          />
          <Select
            label="Classification"
            value={form.classification}
            options={classifications}
            labels={classificationLabels}
            onChange={(classification) => setForm({ ...form, classification })}
          />
          <Select
            label="Recommendation"
            value={form.recommendation}
            options={recommendations}
            labels={recommendationLabels}
            onChange={(recommendation) => setForm({ ...form, recommendation })}
          />
          <Select
            label="Recurring type"
            value={form.recurringType}
            options={recurringTypes}
            labels={typeLabels}
            onChange={(recurringType) => setForm({ ...form, recurringType })}
          />
          <Field
            label="Notes"
            value={form.userNotes}
            onChange={(userNotes) => setForm({ ...form, userNotes })}
          />
        </div>
        <Button onClick={() => onSave({ ...form, categoryId: form.categoryId || null })}>
          Save changes
        </Button>
        <section className="mt-8">
          <h3 className="font-semibold">Why it was detected</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {item.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
        <section className="mt-8">
          <h3 className="font-semibold">Supporting transactions</h3>
          <div className="mt-3 space-y-3">
            {(item.support ?? []).map((link) => (
              <div key={link.id} className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-3">
                  <strong>{link.transaction.normalizedMerchant}</strong>
                  <span>{formatMoney(link.transaction.amountMinor)}</span>
                </div>
                <div className="mt-1 text-[var(--muted)]">
                  {shortDate(link.transaction.transactionDate)} · {link.transaction.account.name} ·{" "}
                  {link.transaction.category?.name ?? "Uncategorized"}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {link.transaction.originalDescription}
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ManualRecurringDialog({
  householdId,
  categories,
  onClose,
  onCreated,
}: {
  householdId: string;
  categories: CategoryDto[];
  onClose: () => void;
  onCreated: (ok: boolean, text: string) => void;
}) {
  const [form, setForm] = useState({
    displayName: "",
    serviceName: "",
    merchantPattern: "",
    categoryId: "",
    typicalAmount: "",
    frequency: "MONTHLY",
    classification: "NEEDS_REVIEW",
    recommendation: "REVIEW",
    recurringType: "OTHER_RECURRING_EXPENSE",
    nextExpectedDate: "",
    userNotes: "",
  });
  async function create() {
    let typicalAmountMinor = 0;
    try {
      typicalAmountMinor = parseMoneyToMinor(form.typicalAmount);
    } catch (error) {
      onCreated(false, error instanceof Error ? error.message : "Amount is invalid.");
      return;
    }
    const result = await postJson("/api/recurring", {
      householdId,
      ...form,
      categoryId: form.categoryId || null,
      typicalAmountMinor,
      nextExpectedDate: form.nextExpectedDate
        ? new Date(form.nextExpectedDate).toISOString()
        : null,
      serviceName: form.serviceName || null,
    });
    onCreated(result.ok, result.ok ? "Manual recurring item created." : result.error);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="mx-auto mt-10 max-h-[90vh] w-[min(720px,94vw)] overflow-y-auto rounded-lg bg-[var(--surface)] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">Create recurring item</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="Display name"
            value={form.displayName}
            onChange={(displayName) => setForm({ ...form, displayName })}
          />
          <Field
            label="Service name"
            value={form.serviceName}
            onChange={(serviceName) => setForm({ ...form, serviceName })}
          />
          <Field
            label="Merchant pattern"
            value={form.merchantPattern}
            onChange={(merchantPattern) => setForm({ ...form, merchantPattern })}
          />
          <Field
            label="Typical amount"
            value={form.typicalAmount}
            onChange={(typicalAmount) => setForm({ ...form, typicalAmount })}
          />
          <Select
            label="Category"
            value={form.categoryId}
            options={["", ...categories.map((category) => category.id)]}
            labels={{
              "": "Uncategorized",
              ...Object.fromEntries(categories.map((category) => [category.id, category.name])),
            }}
            onChange={(categoryId) => setForm({ ...form, categoryId })}
          />
          <Select
            label="Frequency"
            value={form.frequency}
            options={frequencies}
            labels={frequencyLabels}
            onChange={(frequency) => setForm({ ...form, frequency })}
          />
          <Select
            label="Classification"
            value={form.classification}
            options={classifications}
            labels={classificationLabels}
            onChange={(classification) => setForm({ ...form, classification })}
          />
          <Select
            label="Recommendation"
            value={form.recommendation}
            options={recommendations}
            labels={recommendationLabels}
            onChange={(recommendation) => setForm({ ...form, recommendation })}
          />
          <Select
            label="Recurring type"
            value={form.recurringType}
            options={recurringTypes}
            labels={typeLabels}
            onChange={(recurringType) => setForm({ ...form, recurringType })}
          />
          <label className="block text-sm text-[var(--muted)]">
            Next expected date
            <input
              type="date"
              className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
              value={form.nextExpectedDate}
              onChange={(event) => setForm({ ...form, nextExpectedDate: event.target.value })}
            />
          </label>
          <Field
            label="Notes"
            value={form.userNotes}
            onChange={(userNotes) => setForm({ ...form, userNotes })}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={create}>Create item</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-[var(--muted)]">
      {label}
      <select
        className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {labels[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-[var(--muted)]">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function RowActionButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--teal)] hover:bg-[var(--teal-soft)]"
      onClick={onClick}
    >
      {children}
      {label}
    </button>
  );
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return response.ok
    ? { ok: true, ...json }
    : { ok: false, error: json.error ?? "Request failed." };
}

async function patchJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return response.ok
    ? { ok: true, ...json }
    : { ok: false, error: json.error ?? "Request failed." };
}

function isHistoricalStatus(status: string) {
  return ["REJECTED", "CANCELED", "INACTIVE"].includes(status);
}

function nextExpectedLabel(item: RecurringDto) {
  if (item.nextExpectedDate) return shortDate(item.nextExpectedDate);
  return item.frequency === "IRREGULAR_RECURRING" ? "No reliable prediction" : "Needs review";
}

function resultRange(
  page: number,
  totalPages: number,
  pageSize: number,
  visibleCount: number,
  totalCount: number,
) {
  if (!totalCount) return "0 items";
  const currentPage = Math.min(page, totalPages);
  const first = (currentPage - 1) * pageSize + 1;
  const last = first + visibleCount - 1;
  return `${first}–${last} of ${totalCount}`;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function friendlyConfidence(value: string) {
  return value === "HIGH" ? "High" : value === "MEDIUM" ? "Medium" : "Low";
}

function statusTone(status: string): "good" | "bad" | "warn" | "info" {
  if (status === "CONFIRMED") return "good";
  if (status === "REJECTED" || status === "CANCELED") return "bad";
  if (status === "NEEDS_REVIEW") return "warn";
  return "info";
}
