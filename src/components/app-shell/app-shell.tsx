"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { navSections } from "@/data/demo";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeToNavPreference, getNavPreference, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    window.localStorage.setItem("financial-compass-nav", next ? "collapsed" : "expanded");
    window.dispatchEvent(new Event("financial-compass-nav"));
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-3">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1900px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--shell)] shadow-[var(--shadow)]">
        <aside
          className={cn(
            "hidden shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-[width] lg:flex lg:flex-col",
            collapsed ? "w-[76px]" : "w-[282px]",
          )}
        >
          <div
            className={cn(
              "flex h-[72px] items-center gap-3 border-b border-[var(--border)] px-5",
              collapsed && "justify-center px-0",
            )}
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--teal)] text-white">
              ◉
            </div>
            {!collapsed ? <div className="font-semibold">Financial Compass</div> : null}
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4">
            {navSections.map((section, index) => (
              <div key={section.title ?? index} className="mb-5">
                {section.title && !collapsed ? (
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
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700",
                          collapsed && "justify-center px-0",
                          active && "bg-[var(--teal)] text-white",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {!collapsed ? item.label : <span className="sr-only">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-[var(--border)] p-4">
            <div
              title="Local data stored on this device"
              className={cn(
                "flex items-center gap-3 rounded-md bg-[var(--teal-soft)] p-3 text-sm",
                collapsed && "justify-center px-0",
              )}
            >
              <Shield className="h-5 w-5 text-[var(--green)]" />
              {!collapsed ? (
                <div>
                  <div className="font-semibold text-[var(--teal)]">Local data</div>
                  <div className="text-xs text-slate-500">Stored on this device</div>
                </div>
              ) : (
                <span className="sr-only">Local data stored on this device</span>
              )}
            </div>
            <button
              className="mt-3 flex h-9 w-full items-center justify-center rounded-md border border-[var(--border)] bg-white text-slate-600"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
        </aside>
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              className="h-full w-[300px] overflow-y-auto bg-[var(--surface)] p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="font-semibold">Financial Compass</div>
                <button aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
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
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMobileOpen(false)}
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
              <div className="flex items-center gap-3 rounded-md bg-[var(--teal-soft)] p-3 text-sm">
                <Shield className="h-5 w-5 text-[var(--green)]" />
                <div>
                  <div className="font-semibold text-[var(--teal)]">Local data</div>
                  <div className="text-xs text-slate-500">Stored on this device</div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[72px] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:px-6">
            <button
              className="grid h-10 w-10 place-items-center rounded-md border border-[var(--border)] bg-white lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <select className="hidden h-10 rounded-md border border-[var(--border)] bg-white px-3 text-sm sm:block">
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
            <button
              disabled
              title="Add workflows are planned for a later phase"
              className="hidden h-10 cursor-not-allowed items-center gap-2 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white opacity-60 md:flex"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
            <button
              disabled
              title="Import is planned for a later phase"
              className="hidden h-10 cursor-not-allowed items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold opacity-60 md:flex"
            >
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

function subscribeToNavPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("financial-compass-nav", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("financial-compass-nav", callback);
  };
}

function getNavPreference() {
  return window.localStorage.getItem("financial-compass-nav") === "collapsed";
}
