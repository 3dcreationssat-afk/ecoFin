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
  userNotes?: string | null;
  canceledAt?: string | null;
  expectedFinalChargeDate?: string | null;
  reasons: string[];
  support: SupportDto[];
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
  const [status, setStatus] = useState("");
  const [classification, setClassification] = useState("");
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
        (!status || item.status === status) &&
        (!classification || item.classification === classification)
      );
    });
  }, [classification, data.items, query, status]);
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
    refreshFromServer();
  }

  async function saveEdit(values: Partial<RecurringDto>) {
    if (!selected) return;
    const result = await patchJson(`/api/recurring/${selected.id}`, values);
    setMessage(result.ok ? "Recurring expense updated." : result.error);
    setSelected(null);
    refreshFromServer();
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
      <div className="mb-7 grid gap-4 md:grid-cols-3 2xl:grid-cols-6">
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
        <MetricCard label="Under review" value={String(data.summary.underReview)} />
      </div>
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={scan}>
            <RefreshCw className="h-4 w-4" /> Run scan
          </Button>
          <Button onClick={() => setManualOpen(true)}>Create recurring item</Button>
          <Button variant="secondary" disabled={!checked.length} onClick={calculateSavings}>
            <CircleDollarSign className="h-4 w-4" /> Calculate selected savings
          </Button>
          {data.summary.priceIncreases ? (
            <Pill tone="warn">{data.summary.priceIncreases} price increases</Pill>
          ) : null}
          {isPending ? <Pill tone="info">Refreshing</Pill> : null}
        </div>
        <div aria-live="polite" className="mt-3 text-sm text-[var(--muted)]">
          {savings ||
            message ||
            "Detection stays local and excludes confirmed transfers, income, refunds, and card payments."}
        </div>
      </Card>
      <Card className="mb-5 p-5">
        <div className="grid gap-3 md:grid-cols-4">
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
            options={["", ...Object.keys(statusLabels)]}
            labels={{ "": "All statuses", ...statusLabels }}
            onChange={setStatus}
          />
          <Select
            label="Classification"
            value={classification}
            options={["", ...classifications]}
            labels={{ "": "All classifications", ...classificationLabels }}
            onChange={setClassification}
          />
          <div className="self-end text-sm text-[var(--muted)]">
            Showing {visible.length} of {filtered.length} recurring items
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="max-h-[680px] overflow-auto">
          <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
            <thead className="sticky top-0 bg-[var(--surface)] text-[var(--muted)]">
              <tr>
                {[
                  "Save",
                  "Merchant",
                  "Amount",
                  "Cadence",
                  "Next",
                  "Confidence",
                  "Classification",
                  "Recommendation",
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
                <tr key={item.id} className="border-t border-[var(--border)] align-top">
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
                    <div className="font-semibold">{item.displayName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {item.serviceName || typeLabels[item.recurringType] || "Recurring expense"}
                    </div>
                    <div className="mt-2">
                      <Pill tone={statusTone(item.status)}>
                        {statusLabels[item.status] ?? item.status}
                      </Pill>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>{formatMoney(item.typicalAmountMinor)}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatMoney(item.monthlyEquivalentMinor)}/mo
                    </div>
                    {item.priceChangeAmountMinor > 0 ? (
                      <div className="mt-1 text-xs font-semibold text-[var(--amber)]">
                        +{formatMoney(item.priceChangeAmountMinor)} recent change
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">{frequencyLabels[item.frequency] ?? item.frequency}</td>
                  <td className="px-4 py-4">
                    {item.nextExpectedDate ? shortDate(item.nextExpectedDate) : "Needs review"}
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
                    {classificationLabels[item.classification] ?? item.classification}
                  </td>
                  <td className="px-4 py-4">
                    {recommendationLabels[item.recommendation] ?? item.recommendation}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className="text-left text-[var(--teal)] underline"
                      onClick={() => setSelected(item)}
                    >
                      {item.support.length} transactions
                    </button>
                  </td>
                  <td className="space-y-2 px-4 py-4">
                    {["SUGGESTED", "NEEDS_REVIEW"].includes(item.status) ? (
                      <>
                        <IconButton
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
                        </IconButton>
                        <IconButton
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
                        </IconButton>
                      </>
                    ) : null}
                    <IconButton label="Edit" onClick={() => setSelected(item)}>
                      <Edit3 className="h-4 w-4" />
                    </IconButton>
                    {item.status === "CANCELED" ? (
                      <IconButton
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
                      </IconButton>
                    ) : (
                      <IconButton
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
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
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
            {item.support.map((link) => (
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

function IconButton({
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
      className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--teal)]"
      onClick={onClick}
    >
      {children}
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
