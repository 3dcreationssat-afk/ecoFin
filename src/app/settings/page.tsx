"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";

const defaults = {
  household: "Our Household",
  currency: "USD ($)",
  monthStart: "1",
  incomeSchedule: "Bi-weekly",
  checkingBuffer: "1500",
  emergencyTarget: "15000",
  debtStrategy: "Avalanche (highest APR)",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return defaults;
    const stored = window.localStorage.getItem("financial-compass-settings");
    return stored ? (JSON.parse(stored) as typeof defaults) : defaults;
  });
  const [saved, setSaved] = useState(false);

  function update(key: keyof typeof defaults, value: string) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    window.localStorage.setItem("financial-compass-settings", JSON.stringify(next));
    setSaved(true);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title={pageMeta["/settings"].title}
          subtitle={pageMeta["/settings"].subtitle}
          action={saved ? <Pill tone="good">Saved locally</Pill> : null}
        />
        <div className="mb-7 flex flex-wrap gap-3">
          {[
            "Household",
            "Categories",
            "Merchant Rules",
            "Import Profiles",
            "Backup & Data",
            "Privacy",
          ].map((x, i) => (
            <button
              disabled={i !== 0}
              title={i === 0 ? "Current settings tab" : `${x} is planned`}
              key={x}
              className={`rounded-md px-4 py-2 ${i === 0 ? "bg-white shadow-sm" : "cursor-not-allowed text-[var(--muted)] opacity-60"}`}
            >
              {x}
            </button>
          ))}
        </div>
        <Card className="p-7">
          <h2 className="text-xl font-semibold">Household Settings</h2>
          <p className="mb-3 text-[var(--muted)]">Basic configuration</p>
          <p className="mb-8 rounded-md border border-[var(--amber)] bg-[var(--amber-soft)] p-3 text-sm text-[var(--muted)]">
            These settings persist in this browser via local storage. The Prisma household API
            exists, but this form is not yet wired to SQLite.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries({
              household: "Household name",
              currency: "Currency",
              monthStart: "Financial month start",
              incomeSchedule: "Income schedule",
              checkingBuffer: "Checking buffer",
              emergencyTarget: "Emergency fund target",
              debtStrategy: "Debt strategy",
            }).map(([key, label]) => (
              <label key={key} className={key === "debtStrategy" ? "md:col-span-2" : ""}>
                <span className="text-sm text-[var(--muted)]">{label}</span>
                <input
                  className="mt-2 h-12 w-full rounded-md border border-[var(--border)] bg-white px-4"
                  value={settings[key as keyof typeof defaults]}
                  onChange={(e) => update(key as keyof typeof defaults, e.target.value)}
                />
              </label>
            ))}
          </div>
        </Card>
        <Card className="mt-7 p-7">
          <h2 className="text-xl font-semibold">Category Management</h2>
          <p className="mb-4 text-[var(--muted)]">
            Phase 1 displays synthetic category groups only. Create, edit, archive, and
            parent-category workflows are planned.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {["Fixed", "Essential Variable", "Discretionary"].map((x) => (
              <div key={x} className="rounded-md border border-[var(--border)] p-4">
                <strong>{x}</strong>
                <p className="text-sm text-[var(--muted)]">Demonstration category group</p>
              </div>
            ))}
          </div>
          <button
            disabled
            title="Demo reset needs safe user-data separation before exposure"
            className="mt-6 h-10 cursor-not-allowed rounded-md border border-[var(--border)] px-4 text-sm font-semibold opacity-60"
          >
            Reset demonstration data · Disabled
          </button>
        </Card>
      </div>
    </AppShell>
  );
}
