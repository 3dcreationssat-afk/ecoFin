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

export function SettingsClient({
  household,
  categories,
}: {
  household: HouseholdDto;
  categories: CategoryDto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
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
