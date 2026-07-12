"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Pill } from "@/components/data-display/primitives";
import { parseMoneyToMinor, minorToDecimalString } from "@/domain/money/money";

type HouseholdDto = {
  id: string;
  name: string;
  currency: string;
  financialMonthStart: number;
  incomeSchedule: string;
  checkingBufferMinor: number;
  emergencyFundTargetMinor: number;
  debtStrategy: string;
};

type CategoryDto = {
  id: string;
  name: string;
  group: string;
  type: string;
  parentId?: string | null;
  budgetMinor: number;
  sortOrder: number;
  archivedAt?: string | null;
};
type MerchantRuleDto = {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  matchField: string;
  matchType: string;
  pattern: string;
  normalizedMerchant?: string | null;
  categoryId?: string | null;
  transactionType?: string | null;
  markReviewed: boolean;
  notes?: string | null;
  lastAppliedAt?: string | null;
  category?: { name: string } | null;
};

type BackupRecordDto = {
  id: string;
  filename: string;
  sizeBytes: number;
  hash: string;
  appVersion: string;
  schemaVersion: string;
  countsJson: string;
  status: string;
  deletedAt?: string | null;
  isPreRestore: boolean;
  createdAt: string;
  notes?: string | null;
};

type BackupDashboardDto = {
  records: BackupRecordDto[];
  counts: {
    households: number;
    accounts: number;
    transactions: number;
    categories: number;
    goals: number;
    importBatches: number;
    transferMatches?: number;
    recurringExpenses?: number;
    recurringLinks?: number;
    auditLogs: number;
  };
  storageLabel: string;
  encryptionStatus: string;
};

const incomeScheduleLabels: Record<string, string> = {
  WEEKLY: "Weekly",
  BI_WEEKLY: "Every other week",
  SEMI_MONTHLY: "Twice a month",
  MONTHLY: "Monthly",
};

const debtStrategyLabels: Record<string, string> = {
  AVALANCHE: "Highest interest first",
  SNOWBALL: "Smallest balance first",
  CUSTOM: "Custom order",
};

const categoryTypeLabels: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
};

const backupStatusLabels: Record<string, string> = {
  READY: "Ready",
  DELETED: "Deleted",
  CREATED: "Created",
};

const backupCompatibilityLabels: Record<string, string> = {
  SUPPORTED_SAME_SCHEMA: "Compatible backup",
  SUPPORTED_MIGRATION_REQUIRED: "Compatible after migration",
  UNSUPPORTED: "Unsupported backup",
};

export function SettingsClient({
  household,
  categories,
  backup,
  merchantRules,
}: {
  household: HouseholdDto;
  categories: CategoryDto[];
  backup: BackupDashboardDto;
  merchantRules: MerchantRuleDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("household");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const resetAlertRef = useRef<HTMLDivElement | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetCounts, setResetCounts] = useState<BackupDashboardDto["counts"] | null>(null);
  const [resetDatabase, setResetDatabase] = useState<null | {
    provider: string;
    filename: string;
    urlHash: string;
  }>(null);
  const startFreshAlertRef = useRef<HTMLDivElement | null>(null);
  const [startFreshConfirmation, setStartFreshConfirmation] = useState("");
  const [startFreshMessage, setStartFreshMessage] = useState("");
  const [startFreshCounts, setStartFreshCounts] = useState<{
    before: BackupDashboardDto["counts"];
    after: BackupDashboardDto["counts"];
  } | null>(null);
  const [startFreshDatabase, setStartFreshDatabase] = useState<null | {
    provider: string;
    filename: string;
    urlHash: string;
  }>(null);
  const [deleteBackupConfirmation, setDeleteBackupConfirmation] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<null | {
    validation: {
      filename: string;
      compatibility: string;
      integrityCheck: string;
      manifest: {
        createdAt: string;
        applicationVersion: string;
        schemaVersion: string;
        counts: BackupDashboardDto["counts"];
        demonstrationDataPresent: boolean;
      };
    };
    currentCounts: BackupDashboardDto["counts"];
  }>(null);
  const [form, setForm] = useState({
    name: household.name,
    currency: household.currency,
    financialMonthStart: String(household.financialMonthStart),
    incomeSchedule: household.incomeSchedule,
    checkingBuffer: minorToDecimalString(household.checkingBufferMinor),
    emergencyFundTarget: minorToDecimalString(household.emergencyFundTargetMinor),
    debtStrategy: household.debtStrategy,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    group: "Discretionary",
    type: "EXPENSE",
    parentId: "",
    budget: "0.00",
    sortOrder: "120",
  });
  const emptyRule = {
    name: "",
    priority: "100",
    active: true,
    matchField: "ORIGINAL_DESCRIPTION",
    matchType: "CONTAINS",
    pattern: "",
    normalizedMerchant: "",
    categoryId: "",
    transactionType: "",
    markReviewed: false,
    notes: "",
  };
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [editingRuleId, setEditingRuleId] = useState("");
  const [ruleSearch, setRuleSearch] = useState("");
  const [ruleFilter, setRuleFilter] = useState("all");
  const [rulePreview, setRulePreview] = useState<null | {
    matchedCount: number;
    eligibleCount: number;
    protectedCount: number;
    conflict: boolean;
    conflictingRuleNames: string[];
    samples: { id: string; merchant: string; type: string; protections: string[] }[];
  }>(null);

  useEffect(() => {
    const readHash = () => setActiveTab(window.location.hash.replace("#", "") || "household");
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  function chooseTab(tab: string) {
    setActiveTab(tab);
    window.history.pushState(null, "", `#${tab}`);
  }

  async function saveHousehold() {
    setStatus("saving");
    setError("");
    const response = await fetch("/api/household", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        currency: "USD",
        financialMonthStart: Number(form.financialMonthStart),
        incomeSchedule: form.incomeSchedule,
        checkingBufferMinor: parseMoneyToMinor(form.checkingBuffer),
        emergencyFundTargetMinor: parseMoneyToMinor(form.emergencyFundTarget),
        debtStrategy: form.debtStrategy,
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to save household settings.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  async function createCategory() {
    setStatus("saving");
    setError("");
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        householdId: household.id,
        name: categoryForm.name,
        group: categoryForm.group,
        type: categoryForm.type,
        parentId: categoryForm.parentId || null,
        budgetMinor: parseMoneyToMinor(categoryForm.budget),
        sortOrder: Number(categoryForm.sortOrder),
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to save category.");
      setStatus("error");
      return;
    }
    setCategoryForm({ ...categoryForm, name: "" });
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  async function archiveCategory(id: string, action: "archive" | "restore") {
    setStatus("saving");
    const response = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setStatus(response.ok ? "saved" : "error");
    startTransition(() => router.refresh());
  }

  async function resetDemo() {
    setStatus("saving");
    setError("");
    setResetMessage("");
    setResetCounts(null);
    setResetDatabase(null);
    const response = await fetch("/api/demo-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const body = await response.json().catch(() => ({
      ok: false,
      message: "Demonstration data could not be reset.",
    }));
    if (!response.ok) {
      setError(body.message ?? body.error ?? "Demonstration data could not be reset.");
      setStatus("error");
      requestAnimationFrame(() => resetAlertRef.current?.focus());
      return;
    }
    setConfirmation("");
    setResetMessage(body.message ?? "Demonstration data was reset.");
    setResetCounts(body.counts ?? null);
    setResetDatabase(body.database ?? null);
    setStatus("saved");
    requestAnimationFrame(() => resetAlertRef.current?.focus());
    startTransition(() => {
      router.refresh();
    });
  }

  async function startFresh() {
    setStatus("saving");
    setError("");
    setStartFreshMessage("");
    setStartFreshCounts(null);
    setStartFreshDatabase(null);
    const response = await fetch("/api/workspace/start-fresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: startFreshConfirmation }),
    });
    const body = await response.json().catch(() => ({
      ok: false,
      message: "Fresh workspace could not be created.",
    }));
    if (!response.ok) {
      setError(body.message ?? body.error ?? "Fresh workspace could not be created.");
      setStatus("error");
      requestAnimationFrame(() => startFreshAlertRef.current?.focus());
      return;
    }
    setStartFreshConfirmation("");
    setStartFreshMessage(body.message ?? "Fresh workspace is ready.");
    setStartFreshCounts(
      body.before && body.after ? { before: body.before, after: body.after } : null,
    );
    setStartFreshDatabase(body.database ?? null);
    setStatus("saved");
    requestAnimationFrame(() => startFreshAlertRef.current?.focus());
    startTransition(() => {
      router.refresh();
    });
  }

  async function createBackup() {
    setStatus("saving");
    setError("");
    const response = await fetch("/api/backups", { method: "POST" });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to create backup.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  async function deleteBackup(id: string) {
    setStatus("saving");
    setError("");
    const response = await fetch(`/api/backups/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: deleteBackupConfirmation }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to delete backup.");
      setStatus("error");
      return;
    }
    setDeleteBackupConfirmation("");
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  async function previewRestore() {
    if (!restoreFile) return;
    setStatus("saving");
    setError("");
    const form = new FormData();
    form.append("file", restoreFile);
    const response = await fetch("/api/restore/preview", { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Unable to validate backup.");
      setStatus("error");
      return;
    }
    setRestorePreview(body);
    setStatus("saved");
  }

  async function confirmRestore() {
    if (!restoreFile) return;
    setStatus("saving");
    setError("");
    const form = new FormData();
    form.append("file", restoreFile);
    form.append("confirmation", restoreConfirmation);
    const response = await fetch("/api/restore/confirm", { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Unable to restore backup.");
      setStatus("error");
      return;
    }
    setRestoreConfirmation("");
    setRestorePreview(null);
    setStatus("saved");
    startTransition(() => router.refresh());
  }

  function rulePayload() {
    return {
      name: ruleForm.name,
      priority: Number(ruleForm.priority),
      active: ruleForm.active,
      matchField: ruleForm.matchField,
      matchType: ruleForm.matchType,
      pattern: ruleForm.pattern,
      normalizedMerchant: ruleForm.normalizedMerchant || null,
      categoryId: ruleForm.categoryId || null,
      transactionType: ruleForm.transactionType || null,
      markReviewed: ruleForm.markReviewed,
      notes: ruleForm.notes || null,
    };
  }
  async function previewRule() {
    setStatus("saving");
    setError("");
    const response = await fetch("/api/merchant-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rulePayload()),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Rule preview failed.");
      setStatus("error");
      return;
    }
    setRulePreview(body);
    setStatus("saved");
  }
  async function saveRule(applyExisting: boolean) {
    if (
      applyExisting &&
      !window.confirm(
        "Apply this rule to all eligible matching historical transactions? Protected manual, transfer, and recurring values will be skipped.",
      )
    )
      return;
    setStatus("saving");
    setError("");
    const response = await fetch(
      editingRuleId ? `/api/merchant-rules/${editingRuleId}` : "/api/merchant-rules",
      {
        method: editingRuleId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: rulePayload(), applyExisting }),
      },
    );
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Rule could not be saved.");
      setStatus("error");
      return;
    }
    setRuleForm(emptyRule);
    setEditingRuleId("");
    setRulePreview(null);
    setStatus("saved");
    startTransition(() => router.refresh());
  }
  async function ruleAction(id: string, action: "disable" | "enable" | "archive") {
    if (
      action === "archive" &&
      !window.confirm("Archive this merchant rule? It will no longer apply to future imports.")
    )
      return;
    setStatus("saving");
    const response = await fetch(`/api/merchant-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Rule action failed.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
  }
  function editRule(rule: MerchantRuleDto) {
    setEditingRuleId(rule.id);
    setRuleForm({
      name: rule.name,
      priority: String(rule.priority),
      active: rule.active,
      matchField: rule.matchField,
      matchType: rule.matchType,
      pattern: rule.pattern,
      normalizedMerchant: rule.normalizedMerchant ?? "",
      categoryId: rule.categoryId ?? "",
      transactionType: rule.transactionType ?? "",
      markReviewed: rule.markReviewed,
      notes: rule.notes ?? "",
    });
    setRulePreview(null);
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-3">
        {[
          ["household", "Household"],
          ["categories", "Categories"],
          ["merchant-rules", "Merchant Rules"],
          ["backup", "Backup & Data"],
          ["privacy", "Privacy"],
        ].map(([tab, label]) => (
          <button
            key={tab}
            className={`rounded-md px-4 py-2 shadow-sm ${activeTab === tab ? "bg-[var(--teal)] text-white" : "bg-white"}`}
            aria-current={activeTab === tab ? "page" : undefined}
            onClick={() => chooseTab(tab)}
          >
            {label}
          </button>
        ))}
        {status === "saving" || isPending ? <Pill tone="info">Saving</Pill> : null}
        {status === "saved" ? <Pill tone="good">Saved</Pill> : null}
      </div>
      {error ? (
        <div
          ref={resetAlertRef}
          role="alert"
          tabIndex={-1}
          className="mb-4 rounded-md border border-[var(--red)] bg-[var(--red-soft)] p-3 text-sm"
        >
          {error}
        </div>
      ) : null}
      {activeTab === "household" ? (
        <Card className="p-7">
          <h2 className="text-xl font-semibold">Household Settings</h2>
          <p className="mb-8 text-[var(--muted)]">
            Set the defaults used for planning, monthly views, and household-level targets.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <Field
              label="Household name"
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={() => setForm({ ...form, currency: "USD" })}
              options={["USD"]}
            />
            <Field
              label="Financial month start"
              help="The calendar day that starts your household financial month. Use 1 for calendar months."
              value={form.financialMonthStart}
              onChange={(financialMonthStart) => setForm({ ...form, financialMonthStart })}
            />
            <Select
              label="Income schedule"
              help="How often primary income normally arrives. This helps future cash timing views."
              value={form.incomeSchedule}
              onChange={(incomeSchedule) => setForm({ ...form, incomeSchedule })}
              options={["WEEKLY", "BI_WEEKLY", "SEMI_MONTHLY", "MONTHLY"]}
              labels={incomeScheduleLabels}
            />
            <Field
              label="Checking buffer"
              help="The target cushion to keep in checking before moving money elsewhere."
              value={form.checkingBuffer}
              onChange={(checkingBuffer) => setForm({ ...form, checkingBuffer })}
            />
            <Field
              label="Emergency fund target"
              help="The total emergency savings target for the household."
              value={form.emergencyFundTarget}
              onChange={(emergencyFundTarget) => setForm({ ...form, emergencyFundTarget })}
            />
            <Select
              label="Debt strategy"
              help="Avalanche targets highest interest first. Snowball targets smallest balances first."
              value={form.debtStrategy}
              onChange={(debtStrategy) => setForm({ ...form, debtStrategy })}
              options={["AVALANCHE", "SNOWBALL", "CUSTOM"]}
              labels={debtStrategyLabels}
            />
          </div>
          <button
            disabled={status === "saving"}
            onClick={saveHousehold}
            className="mt-6 h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
          >
            Save household
          </button>
        </Card>
      ) : null}
      {activeTab === "categories" ? (
        <Card className="mt-7 p-7">
          <h2 className="text-xl font-semibold">Category Management</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Field
              label="Category name"
              help="The label used on transactions, such as Groceries or Paycheck."
              value={categoryForm.name}
              onChange={(name) => setCategoryForm({ ...categoryForm, name })}
            />
            <Field
              label="Group"
              help="A reporting bucket such as Fixed, Essential Variable, Discretionary, or Income."
              value={categoryForm.group}
              onChange={(group) => setCategoryForm({ ...categoryForm, group })}
            />
            <Select
              label="Type"
              help="Income categories count toward money in; expense categories count toward spending; transfer categories are neutral."
              value={categoryForm.type}
              onChange={(type) => setCategoryForm({ ...categoryForm, type })}
              options={["INCOME", "EXPENSE", "TRANSFER"]}
              labels={categoryTypeLabels}
            />
            <Select
              label="Parent category"
              help="Optional hierarchy. Parent categories group child categories in reports."
              value={categoryForm.parentId}
              onChange={(parentId) => setCategoryForm({ ...categoryForm, parentId })}
              options={["", ...categories.filter((x) => !x.archivedAt).map((x) => x.id)]}
              labels={{
                "": "No parent",
                ...Object.fromEntries(categories.map((x) => [x.id, x.name])),
              }}
            />
            <Field
              label="Budget"
              help="Monthly planned amount for budget comparisons."
              value={categoryForm.budget}
              onChange={(budget) => setCategoryForm({ ...categoryForm, budget })}
            />
            <Field
              label="Sort order"
              help="Lower numbers appear earlier in category lists."
              value={categoryForm.sortOrder}
              onChange={(sortOrder) => setCategoryForm({ ...categoryForm, sortOrder })}
            />
          </div>
          <button
            disabled={status === "saving"}
            onClick={createCategory}
            className="mt-6 h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
          >
            Add category
          </button>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-md border border-[var(--border)] p-4"
              >
                <div>
                  <strong>{category.name}</strong>
                  <p className="text-sm text-[var(--muted)]">
                    {category.group} · {categoryTypeLabels[category.type] ?? category.type}
                    {category.archivedAt ? " · Archived" : ""}
                  </p>
                </div>
                <button
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                  onClick={() =>
                    archiveCategory(category.id, category.archivedAt ? "restore" : "archive")
                  }
                >
                  {category.archivedAt ? "Restore" : "Archive"}
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {activeTab === "merchant-rules" ? (
        <div className="mt-7 grid gap-6">
          <Card className="p-7">
            <h2 className="text-xl font-semibold">
              {editingRuleId ? "Edit Merchant Rule" : "Create Merchant Rule"}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Rules use normalized, case-insensitive text matching. Lower priority numbers win;
              exact matches outrank starts/ends-with, then contains. Saving alone affects future
              imports. Historical changes always require a separate confirmation.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Field
                label="Rule name"
                value={ruleForm.name}
                onChange={(name) => setRuleForm({ ...ruleForm, name })}
              />
              <Field
                label="Priority"
                help="Lower numbers run first."
                value={ruleForm.priority}
                onChange={(priority) => setRuleForm({ ...ruleForm, priority })}
              />
              <Select
                label="Match field"
                help="Choose the immutable original description, current merchant, or either."
                value={ruleForm.matchField}
                onChange={(matchField) => setRuleForm({ ...ruleForm, matchField })}
                options={["ORIGINAL_DESCRIPTION", "NORMALIZED_MERCHANT", "EITHER"]}
                labels={{
                  ORIGINAL_DESCRIPTION: "Original description",
                  NORMALIZED_MERCHANT: "Normalized merchant",
                  EITHER: "Description or merchant",
                }}
              />
              <Select
                label="Match type"
                help="Matching ignores case and repeated whitespace. Regular expressions are intentionally unsupported."
                value={ruleForm.matchType}
                onChange={(matchType) => setRuleForm({ ...ruleForm, matchType })}
                options={["EXACT", "CONTAINS", "STARTS_WITH", "ENDS_WITH"]}
                labels={{
                  EXACT: "Exact",
                  CONTAINS: "Contains",
                  STARTS_WITH: "Starts with",
                  ENDS_WITH: "Ends with",
                }}
              />
              <Field
                label="Pattern"
                help="Required text, limited to 160 characters."
                value={ruleForm.pattern}
                onChange={(pattern) => setRuleForm({ ...ruleForm, pattern })}
              />
              <Field
                label="Normalized merchant"
                value={ruleForm.normalizedMerchant}
                onChange={(normalizedMerchant) => setRuleForm({ ...ruleForm, normalizedMerchant })}
              />
              <Select
                label="Category"
                value={ruleForm.categoryId}
                onChange={(categoryId) => setRuleForm({ ...ruleForm, categoryId })}
                options={[
                  "",
                  ...categories
                    .filter((category) => !category.archivedAt)
                    .map((category) => category.id),
                ]}
                labels={{
                  "": "Do not change",
                  ...Object.fromEntries(categories.map((category) => [category.id, category.name])),
                }}
              />
              <Select
                label="Transaction type"
                help="Transfer types are excluded; rules cannot confirm transfers."
                value={ruleForm.transactionType}
                onChange={(transactionType) => setRuleForm({ ...ruleForm, transactionType })}
                options={[
                  "",
                  "DEBIT",
                  "CREDIT",
                  "INCOME",
                  "EXPENSE",
                  "REFUND",
                  "FEE",
                  "INTEREST",
                  "UNKNOWN",
                  "OTHER",
                ]}
                labels={{
                  "": "Do not change",
                  DEBIT: "Money out",
                  CREDIT: "Money in",
                  INCOME: "Income",
                  EXPENSE: "Expense",
                  REFUND: "Refund",
                  FEE: "Fee",
                  INTEREST: "Interest",
                  UNKNOWN: "Other / unknown",
                  OTHER: "Other",
                }}
              />
              <Field
                label="Notes"
                value={ruleForm.notes}
                onChange={(notes) => setRuleForm({ ...ruleForm, notes })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ruleForm.markReviewed}
                  onChange={(event) =>
                    setRuleForm({ ...ruleForm, markReviewed: event.target.checked })
                  }
                />{" "}
                Mark matching transactions reviewed
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
                onClick={previewRule}
              >
                Test and preview
              </button>
              <button
                className="h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
                onClick={() => saveRule(false)}
              >
                Save for future only
              </button>
              <button
                className="h-10 rounded-md border border-[var(--teal)] px-4 text-sm font-semibold text-[var(--teal)]"
                onClick={() => saveRule(true)}
              >
                Save and apply eligible history
              </button>
              {editingRuleId ? (
                <button
                  className="h-10 rounded-md border border-[var(--border)] px-4 text-sm"
                  onClick={() => {
                    setEditingRuleId("");
                    setRuleForm(emptyRule);
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
            {rulePreview ? (
              <div className="mt-5 rounded-md border border-[var(--border)] p-4" aria-live="polite">
                <div className="flex flex-wrap gap-2">
                  <Pill tone="info">{rulePreview.matchedCount} matched</Pill>
                  <Pill tone="good">{rulePreview.eligibleCount} eligible</Pill>
                  <Pill tone={rulePreview.protectedCount ? "warn" : "neutral"}>
                    {rulePreview.protectedCount} protected
                  </Pill>
                  {rulePreview.conflict ? (
                    <Pill tone="bad">Conflict: {rulePreview.conflictingRuleNames.join(", ")}</Pill>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {rulePreview.samples.map((sample) => (
                    <div key={sample.id} className="text-sm">
                      <strong>{sample.merchant}</strong> · {sample.type}
                      {sample.protections.length
                        ? ` · Protected: ${sample.protections.join(", ")}`
                        : " · Eligible"}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
          <Card className="p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Merchant Rules</h2>
                <p className="text-sm text-[var(--muted)]">
                  Deterministic future-import normalization and categorization.
                </p>
              </div>
              <div className="flex gap-2">
                <Field label="Search rules" value={ruleSearch} onChange={setRuleSearch} />
                <Select
                  label="Status"
                  value={ruleFilter}
                  onChange={setRuleFilter}
                  options={["all", "active", "inactive"]}
                  labels={{ all: "All", active: "Active", inactive: "Inactive" }}
                />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {merchantRules
                .filter(
                  (rule) =>
                    (!ruleSearch ||
                      `${rule.name} ${rule.pattern}`
                        .toLocaleLowerCase()
                        .includes(ruleSearch.toLocaleLowerCase())) &&
                    (ruleFilter === "all" || (ruleFilter === "active") === rule.active),
                )
                .map((rule) => (
                  <div key={rule.id} className="rounded-md border border-[var(--border)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <strong>{rule.name}</strong>{" "}
                        <Pill tone={rule.active ? "good" : "neutral"}>
                          {rule.active ? "Active" : "Inactive"}
                        </Pill>
                        <p className="text-sm text-[var(--muted)]">
                          Priority {rule.priority} ·{" "}
                          {rule.matchField.replaceAll("_", " ").toLocaleLowerCase()}{" "}
                          {rule.matchType.replaceAll("_", " ").toLocaleLowerCase()} “{rule.pattern}”
                          →{" "}
                          {rule.normalizedMerchant ??
                            rule.category?.name ??
                            rule.transactionType ??
                            "Reviewed"}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          Last applied:{" "}
                          {rule.lastAppliedAt
                            ? new Date(rule.lastAppliedAt).toLocaleString()
                            : "Never"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border px-3 py-2 text-sm"
                          onClick={() => editRule(rule)}
                        >
                          Edit / test
                        </button>
                        <button
                          className="rounded-md border px-3 py-2 text-sm"
                          onClick={() => ruleAction(rule.id, rule.active ? "disable" : "enable")}
                        >
                          {rule.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="rounded-md border border-[var(--red)] px-3 py-2 text-sm text-[var(--red)]"
                          onClick={() => ruleAction(rule.id, "archive")}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      ) : null}
      {activeTab === "backup" ? (
        <Card className="mt-7 p-7">
          <h2 className="text-xl font-semibold">Backup & Data</h2>
          <p className="mt-2 text-[var(--muted)]">
            Backups are local ZIP packages stored in an application-controlled backup directory.
            They contain sensitive, unencrypted financial data. Store them on an encrypted drive or
            another secure local location.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Metric label="Households" value={String(backup.counts.households)} />
            <Metric label="Accounts" value={String(backup.counts.accounts)} />
            <Metric label="Transactions" value={String(backup.counts.transactions)} />
            <Metric label="Import batches" value={String(backup.counts.importBatches)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
              onClick={createBackup}
              disabled={status === "saving"}
            >
              Create backup
            </button>
            <button
              className="h-10 cursor-not-allowed rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-[var(--muted)] opacity-70"
              disabled
              title="Delete all data is not implemented in Phase 2B"
            >
              Delete all data unavailable
            </button>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr>
                  {["Created", "Filename", "Status", "Size", "Hash", "Actions"].map((head) => (
                    <th key={head} className="py-3 pr-4">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backup.records.map((record) => (
                  <tr key={record.id} className="border-t border-[var(--border)]">
                    <td className="py-3 pr-4">{new Date(record.createdAt).toLocaleString()}</td>
                    <td className="py-3 pr-4">{record.filename}</td>
                    <td className="py-3 pr-4">
                      <Pill
                        tone={
                          record.status === "READY"
                            ? "good"
                            : record.status === "DELETED"
                              ? "warn"
                              : "info"
                        }
                      >
                        {backupStatusLabels[record.status] ?? record.status}
                      </Pill>
                      {record.isPreRestore ? (
                        <span className="ml-2 text-xs">Pre-restore</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">{Math.round(record.sizeBytes / 1024)} KB</td>
                    <td className="py-3 pr-4 font-mono text-xs">{record.hash.slice(0, 12)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        {record.status === "READY" ? (
                          <a
                            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                            href={`/api/backups/${record.id}/download`}
                          >
                            Download
                          </a>
                        ) : null}
                        {record.status !== "DELETED" ? (
                          <button
                            className="rounded-md border border-[var(--red)] px-3 py-2 text-sm text-[var(--red)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--muted)]"
                            disabled={record.status !== "READY"}
                            onClick={() => deleteBackup(record.id)}
                            title={
                              record.status !== "READY"
                                ? "Only ready local backup files can be deleted"
                                : undefined
                            }
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <input
              aria-label="Delete backup confirmation"
              className="h-10 rounded-md border border-[var(--border)] px-3"
              value={deleteBackupConfirmation}
              onChange={(event) => setDeleteBackupConfirmation(event.target.value)}
              placeholder="DELETE BACKUP"
            />
          </div>
          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold">Restore from backup</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Restore validates the package, creates a mandatory pre-restore safety backup, then
              replaces the active local database. If post-restore validation fails, the prior
              database is restored automatically.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                aria-label="Restore backup file"
                type="file"
                accept=".zip,application/zip"
                className="max-w-full"
                onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
              />
              <button
                className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
                onClick={previewRestore}
              >
                Validate restore package
              </button>
            </div>
            {restorePreview ? (
              <div className="mt-4 rounded-md border border-[var(--border)] p-4">
                <Pill tone="good">
                  {backupCompatibilityLabels[restorePreview.validation.compatibility] ??
                    restorePreview.validation.compatibility}
                </Pill>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Metric
                    label="Backup transactions"
                    value={String(restorePreview.validation.manifest.counts.transactions)}
                  />
                  <Metric
                    label="Current transactions"
                    value={String(restorePreview.currentCounts.transactions)}
                  />
                  <Metric label="Integrity" value={restorePreview.validation.integrityCheck} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    aria-label="Restore confirmation"
                    className="h-10 rounded-md border border-[var(--border)] px-3"
                    value={restoreConfirmation}
                    onChange={(event) => setRestoreConfirmation(event.target.value)}
                    placeholder="RESTORE BACKUP"
                  />
                  <button
                    className="h-10 rounded-md border border-[var(--red)] px-4 text-sm font-semibold text-[var(--red)]"
                    onClick={confirmRestore}
                  >
                    Restore backup
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <h2 className="text-xl font-semibold">Workspace</h2>
            <div className="mt-5 rounded-md border border-[var(--border)] p-5">
              <h3 className="text-lg font-semibold">Start fresh</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Removes the sample financial records and creates an empty local workspace for your
                own data. Browser preferences and backup ZIP files are preserved.
              </p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>All current local demo accounts will be removed.</li>
                <li>All demo transactions will be removed.</li>
                <li>All demo goals will be removed.</li>
                <li>Demo categories are removed; no starter categories are required.</li>
                <li>
                  Import history, transfer matches, recurring patterns, and audit records are
                  cleared.
                </li>
                <li>Backup files are not deleted.</li>
                <li>Navigation and theme preferences are preserved.</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
                  onClick={createBackup}
                  disabled={status === "saving"}
                >
                  Create backup first
                </button>
                <button
                  className="h-10 rounded-md border border-[var(--border)] px-4 text-sm font-semibold"
                  onClick={() => {
                    setStartFreshConfirmation("");
                    setStartFreshMessage("");
                    setStartFreshCounts(null);
                  }}
                >
                  Cancel
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  aria-label="Start fresh confirmation"
                  className="h-10 rounded-md border border-[var(--border)] px-3"
                  value={startFreshConfirmation}
                  onChange={(event) => {
                    setStartFreshConfirmation(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="START FRESH"
                />
                <button
                  className="h-10 rounded-md border border-[var(--red)] px-4 text-sm font-semibold text-[var(--red)]"
                  onClick={startFresh}
                  disabled={status === "saving" || startFreshConfirmation !== "START FRESH"}
                >
                  {status === "saving" ? "Starting fresh..." : "Start fresh"}
                </button>
              </div>
              {startFreshConfirmation !== "START FRESH" ? (
                <p className="mt-2 text-sm text-[var(--red)]">
                  Type START FRESH to confirm removing local sample data.
                </p>
              ) : null}
              {startFreshMessage ? (
                <div
                  ref={startFreshAlertRef}
                  role="status"
                  tabIndex={-1}
                  className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm outline-none"
                >
                  <p className="font-semibold">{startFreshMessage}</p>
                  {startFreshCounts ? (
                    <p className="mt-2 text-[var(--muted)]">
                      Before: {startFreshCounts.before.accounts} accounts,{" "}
                      {startFreshCounts.before.categories} categories,{" "}
                      {startFreshCounts.before.goals} goals, {startFreshCounts.before.transactions}{" "}
                      transactions. After: {startFreshCounts.after.accounts} accounts,{" "}
                      {startFreshCounts.after.categories} categories, {startFreshCounts.after.goals}{" "}
                      goals, {startFreshCounts.after.transactions} transactions.
                    </p>
                  ) : null}
                  {startFreshDatabase ? (
                    <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                      Active database: {startFreshDatabase.provider}/{startFreshDatabase.filename} #
                      {startFreshDatabase.urlHash}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-6 rounded-md border border-[var(--border)] p-5">
              <h3 className="text-lg font-semibold">Restore demonstration data</h3>
              <p className="text-[var(--muted)]">
                Replaces the current workspace with the original sample accounts, transactions,
                goals, and settings.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  aria-label="Reset confirmation"
                  className="h-10 rounded-md border border-[var(--border)] px-3"
                  value={confirmation}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="RESET DEMO DATA"
                />
                <button
                  className="h-10 rounded-md border border-[var(--red)] px-4 text-sm font-semibold text-[var(--red)]"
                  onClick={resetDemo}
                  disabled={status === "saving" || confirmation !== "RESET DEMO DATA"}
                >
                  {status === "saving" ? "Restoring..." : "Reset to sample data"}
                </button>
              </div>
              {confirmation !== "RESET DEMO DATA" ? (
                <p className="mt-2 text-sm text-[var(--red)]">
                  Type RESET DEMO DATA to confirm restoring the single-household sample workspace.
                </p>
              ) : null}
              {resetMessage ? (
                <div
                  ref={resetAlertRef}
                  role="status"
                  tabIndex={-1}
                  className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm outline-none"
                >
                  <p className="font-semibold">{resetMessage}</p>
                  {resetCounts ? (
                    <p className="mt-2 text-[var(--muted)]">
                      Result: {resetCounts.households} household, {resetCounts.accounts} accounts,{" "}
                      {resetCounts.categories} categories, {resetCounts.goals} goals,{" "}
                      {resetCounts.transactions} transactions, {resetCounts.importBatches} import
                      batches, {resetCounts.transferMatches ?? 0} transfer matches,{" "}
                      {resetCounts.recurringExpenses ?? 0} recurring records, and{" "}
                      {resetCounts.auditLogs} audit events.
                    </p>
                  ) : null}
                  {resetDatabase ? (
                    <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                      Active database: {resetDatabase.provider}/{resetDatabase.filename} #
                      {resetDatabase.urlHash}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}
      {activeTab === "privacy" ? (
        <Card className="mt-7 p-7">
          <h2 className="text-xl font-semibold">Privacy</h2>
          <p className="mt-2 text-[var(--muted)]">
            Financial Compass is local-first. Normal use does not send household financial data,
            transaction imports, backups, or settings to external services.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <PrivacyItem
              title="What is stored locally"
              text="Household settings, accounts, categories, goals, transactions, imports, transfers, audit records, and backup metadata are stored in the local app database."
            />
            <PrivacyItem
              title="Browser preferences"
              text="The browser stores lightweight interface preferences such as the navigation collapsed state."
            />
            <PrivacyItem
              title="Backups are sensitive"
              text="Backup ZIP files contain complete unencrypted financial data. Keep them in a secure local location."
            />
            <PrivacyItem
              title="No telemetry"
              text="The app does not include analytics, ads, telemetry, external AI, bank credentials, or direct bank connectivity."
            />
            <PrivacyItem
              title="Future connections"
              text="If connected-account features are added later, they will require a separate consent and security review."
            />
            <PrivacyItem
              title="Deletion and export"
              text="Demo reset clears the synthetic local dataset. General delete-all-data and export workflows are not yet implemented."
            />
          </div>
        </Card>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-4">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      {help ? <span className="ml-2 text-xs text-[var(--muted)]">Info: {help}</span> : null}
      <input
        className="mt-2 h-12 w-full rounded-md border border-[var(--border)] bg-white px-4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  help,
  value,
  options,
  labels = {},
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
      {help ? <span className="ml-2 text-xs text-[var(--muted)]">Info: {help}</span> : null}
      <select
        className="mt-2 h-12 w-full rounded-md border border-[var(--border)] bg-white px-4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PrivacyItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}
