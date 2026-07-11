"use client";

import { useState, useTransition } from "react";
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
    auditLogs: number;
  };
  storageLabel: string;
  encryptionStatus: string;
};

export function SettingsClient({
  household,
  categories,
  backup,
}: {
  household: HouseholdDto;
  categories: CategoryDto[];
  backup: BackupDashboardDto;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
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
    const response = await fetch("/api/demo-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to reset demo data.");
      setStatus("error");
      return;
    }
    setConfirmation("");
    setStatus("saved");
    startTransition(() => router.refresh());
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

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-3">
        {["Household", "Categories", "Backup & Data", "Privacy"].map((x) => (
          <span key={x} className="rounded-md bg-white px-4 py-2 shadow-sm">
            {x}
          </span>
        ))}
        {status === "saving" || isPending ? <Pill tone="info">Saving</Pill> : null}
        {status === "saved" ? <Pill tone="good">Saved to SQLite</Pill> : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-[var(--red)] bg-[var(--red-soft)] p-3 text-sm"
        >
          {error}
        </div>
      ) : null}
      <Card className="p-7">
        <h2 className="text-xl font-semibold">Household Settings</h2>
        <p className="mb-8 text-[var(--muted)]">
          SQLite is the source of truth. Browser local storage is reserved for UI preferences such
          as navigation state.
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
            value={form.financialMonthStart}
            onChange={(financialMonthStart) => setForm({ ...form, financialMonthStart })}
          />
          <Select
            label="Income schedule"
            value={form.incomeSchedule}
            onChange={(incomeSchedule) => setForm({ ...form, incomeSchedule })}
            options={["WEEKLY", "BI_WEEKLY", "SEMI_MONTHLY", "MONTHLY"]}
          />
          <Field
            label="Checking buffer"
            value={form.checkingBuffer}
            onChange={(checkingBuffer) => setForm({ ...form, checkingBuffer })}
          />
          <Field
            label="Emergency fund target"
            value={form.emergencyFundTarget}
            onChange={(emergencyFundTarget) => setForm({ ...form, emergencyFundTarget })}
          />
          <Select
            label="Debt strategy"
            value={form.debtStrategy}
            onChange={(debtStrategy) => setForm({ ...form, debtStrategy })}
            options={["AVALANCHE", "SNOWBALL", "CUSTOM"]}
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
      <Card className="mt-7 p-7">
        <h2 className="text-xl font-semibold">Category Management</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field
            label="Category name"
            value={categoryForm.name}
            onChange={(name) => setCategoryForm({ ...categoryForm, name })}
          />
          <Field
            label="Group"
            value={categoryForm.group}
            onChange={(group) => setCategoryForm({ ...categoryForm, group })}
          />
          <Select
            label="Type"
            value={categoryForm.type}
            onChange={(type) => setCategoryForm({ ...categoryForm, type })}
            options={["INCOME", "EXPENSE", "TRANSFER"]}
          />
          <Select
            label="Parent category"
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
            value={categoryForm.budget}
            onChange={(budget) => setCategoryForm({ ...categoryForm, budget })}
          />
          <Field
            label="Sort order"
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
                  {category.group} · {category.type}
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
      <Card className="mt-7 p-7">
        <h2 className="text-xl font-semibold">Backup & Data</h2>
        <p className="mt-2 text-[var(--muted)]">
          Backups are local ZIP packages stored in an application-controlled backup directory. They
          contain sensitive, unencrypted SQLite financial data. Store them on an encrypted drive or
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
                      {record.status}
                    </Pill>
                    {record.isPreRestore ? <span className="ml-2 text-xs">Pre-restore</span> : null}
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
            replaces the active SQLite database. If post-restore validation fails, the prior
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
              <Pill tone="good">{restorePreview.validation.compatibility}</Pill>
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
      </Card>
      <Card className="mt-7 p-7">
        <h2 className="text-xl font-semibold">Demonstration Data Reset</h2>
        <p className="text-[var(--muted)]">
          This resets the single-household synthetic SQLite dataset and preserves browser UI
          preferences such as navigation state.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            aria-label="Reset confirmation"
            className="h-10 rounded-md border border-[var(--border)] px-3"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="RESET DEMO DATA"
          />
          <button
            className="h-10 rounded-md border border-[var(--red)] px-4 text-sm font-semibold text-[var(--red)]"
            onClick={resetDemo}
          >
            Reset demo data
          </button>
        </div>
      </Card>
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
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
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
  value,
  options,
  labels = {},
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm text-[var(--muted)]">{label}</span>
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
