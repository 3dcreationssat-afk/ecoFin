"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Moon, Plus, Search, Shield, Upload } from "lucide-react";
import { navSections } from "@/data/demo";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)] p-3">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1900px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--shell)] shadow-[var(--shadow)]">
        <aside className="hidden w-[282px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center gap-3 border-b border-[var(--border)] px-5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--teal)] text-white">◉</div>
            <div className="font-semibold">Financial Compass</div>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4">
            {navSections.map((section, index) => (
              <div key={section.title ?? index} className="mb-5">
                {section.title ? (
                  <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {section.title}
                  </div>
                ) : null}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700",
                          active && "bg-[var(--teal)] text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-[var(--border)] p-4">
            <div className="flex items-center gap-3 rounded-md bg-[var(--teal-soft)] p-3 text-sm">
              <Shield className="h-5 w-5 text-[var(--green)]" />
              <div>
                <div className="font-semibold text-[var(--teal)]">Local data</div>
                <div className="text-xs text-slate-500">Stored on this device</div>
              </div>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[72px] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:px-6">
            <select className="h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm">
              <option>This Month · Jul 2026</option>
            </select>
            <select className="hidden h-10 rounded-md border-0 bg-transparent px-3 text-sm md:block">
              <option>Our Household</option>
            </select>
            <div className="relative min-w-[160px] flex-1">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                className="h-10 w-full rounded-md border border-transparent bg-[var(--surface-muted)] pl-10 pr-3 text-sm"
                placeholder="Search transactions, merchants..."
              />
            </div>
            <button className="hidden h-10 items-center gap-2 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white md:flex">
              <Plus className="h-4 w-4" /> Add
            </button>
            <button className="hidden h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold md:flex">
              <Upload className="h-4 w-4" /> Import
            </button>
            <Moon className="hidden h-5 w-5 text-slate-700 md:block" />
            <div className="relative hidden md:block">
              <Bell className="h-5 w-5 text-slate-700" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--amber)]" />
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--teal)] text-sm font-semibold text-white">
              JD
            </button>
            <ChevronDown className="hidden h-4 w-4 text-slate-500 md:block" />
          </header>
          <main className="min-w-0 flex-1 overflow-auto px-4 py-6 md:px-7 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

