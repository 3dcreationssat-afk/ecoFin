"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Shield,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { navSections } from "@/data/demo";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./notification-center";

const NAV_STORAGE_KEY = "financial-compass-nav";
const NAV_EVENT = "financial-compass-nav";
const THEME_STORAGE_KEY = "financial-compass-theme";
const THEME_EVENT = "financial-compass-theme";
type ThemePreference = "light" | "dark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeToNavPreference, getNavPreference, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  function closeMobileNav({ restoreFocus = true } = {}) {
    setMobileOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
    }
  }

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobileNav();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    window.localStorage.setItem(NAV_STORAGE_KEY, next ? "collapsed" : "expanded");
    window.dispatchEvent(new Event(NAV_EVENT));
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-0 sm:p-2">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-[var(--teal)] px-4 py-3 font-semibold text-white shadow-lg focus:translate-y-0"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex min-h-[calc(100vh-1rem)] max-w-[1900px] items-stretch rounded-lg border border-[var(--border)] bg-[var(--shell)] shadow-[var(--shadow)]">
        <Sidebar collapsed={collapsed} pathname={pathname} onToggle={toggleCollapsed} />
        {mobileOpen ? <MobileNav pathname={pathname} onClose={closeMobileNav} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[60px] min-w-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:gap-3 md:px-5">
            <button
              ref={mobileTriggerRef}
              className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-white lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative min-w-0 flex-1 sm:min-w-[160px]">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                className="h-9 w-full rounded-md border border-transparent bg-[var(--surface-muted)] pl-10 pr-3 text-sm"
                placeholder="Search transactions and merchants"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const query = search.trim();
                  window.location.href = query
                    ? `/transactions?q=${encodeURIComponent(query)}`
                    : "/transactions";
                }}
                aria-label="Search transactions"
              />
            </div>
            <QuickAddMenu />
            <Link
              href="/transactions?import=1"
              onClick={(event) => {
                if (pathname !== "/transactions") return;
                event.preventDefault();
                window.dispatchEvent(new CustomEvent("financial-compass:open-import"));
              }}
              className="hidden h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold hover:bg-[var(--surface-muted)] xl:flex"
            >
              <Upload className="h-4 w-4" /> Import
            </Link>
            <ThemeControl />
            <NotificationCenter />
          </header>
          <main id="main-content" className="min-w-0 flex-1 px-4 py-5 md:px-6 lg:px-7">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function QuickAddMenu() {
  const actions = [
    { href: "/transactions?period=ALL&manual=1", label: "Add transaction" },
    { href: "/transactions?period=ALL&import=1", label: "Import CSV" },
    { href: "/accounts", label: "Add account" },
    { href: "/goals", label: "Add goal" },
    { href: "/decisions", label: "Create scenario" },
    { href: "/settings#categories", label: "Add category" },
  ];
  return (
    <details className="group relative hidden xl:block">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
        <Plus className="h-4 w-4" /> Add
      </summary>
      <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="block px-4 py-2 text-sm hover:bg-[var(--surface-muted)]"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

function Sidebar({
  collapsed,
  pathname,
  onToggle,
}: {
  collapsed: boolean;
  pathname: string;
  onToggle: () => void;
}) {
  return (
    <aside
      data-testid="desktop-sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "sticky top-2 hidden max-h-[calc(100vh-1rem)] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 lg:flex lg:flex-col motion-reduce:transition-none",
        collapsed ? "w-[64px] max-w-[64px] basis-[64px]" : "w-[224px] max-w-[224px] basis-[224px]",
      )}
    >
      <div
        className={cn(
          "flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--border)] px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--teal)] text-white"
          aria-hidden="true"
        >
          ◉
        </div>
        {!collapsed ? <div className="truncate font-semibold">Financial Compass</div> : null}
        {collapsed ? <span className="sr-only">Financial Compass</span> : null}
      </div>
      <nav
        aria-label="Primary navigation"
        className={cn(
          "min-h-0 flex-1 py-3",
          collapsed ? "overflow-visible px-2" : "overflow-y-auto px-3",
        )}
      >
        {navSections.map((section, index) => (
          <SidebarGroup
            key={section.title ?? index}
            title={section.title}
            collapsed={collapsed}
            pathname={pathname}
          />
        ))}
      </nav>
      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <LocalDataIndicator collapsed={collapsed} />
        <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
      </div>
    </aside>
  );
}

function SidebarGroup({
  title,
  collapsed,
  pathname,
}: {
  title?: string;
  collapsed: boolean;
  pathname: string;
}) {
  const section = navSections.find((candidate) => candidate.title === title);
  const items = section?.items ?? navSections.find((candidate) => !candidate.title)?.items ?? [];

  return (
    <div className={cn("mb-4", collapsed && "mb-3")}>
      {title && !collapsed ? (
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {title}
        </div>
      ) : null}
      <div className="space-y-1">
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  );
}

function SidebarItem({
  item,
  active,
  collapsed,
}: {
  item: (typeof navSections)[number]["items"][number];
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <div className="group relative">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          "relative flex h-9 items-center rounded-md text-sm font-medium text-slate-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgb(37_139_127_/_0.35)]",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
          active && "bg-[var(--teal)] text-white shadow-sm",
        )}
      >
        {active ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute rounded-full bg-current opacity-80",
              collapsed ? "right-2 top-2 h-1.5 w-1.5" : "left-1 h-5 w-1 bg-white",
            )}
          />
        ) : null}
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="truncate">{item.label}</span>
            {active ? <span className="sr-only">current page</span> : null}
          </>
        ) : null}
      </Link>
      {collapsed ? <Tooltip>{item.label}</Tooltip> : null}
    </div>
  );
}

function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? "Expand navigation" : "Collapse navigation";
  return (
    <div className="group relative mt-3">
      <button
        className="flex h-9 w-full items-center justify-center rounded-md border border-[var(--border)] bg-white text-slate-600"
        onClick={onToggle}
        aria-label={label}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>
      {collapsed ? <Tooltip>{label}</Tooltip> : null}
    </div>
  );
}

function LocalDataIndicator({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="group relative">
      <div
        role="status"
        aria-label="Local data stored on this device"
        className={cn(
          "flex items-center gap-3 rounded-md bg-[var(--teal-soft)] p-2.5 text-sm",
          collapsed && "h-9 justify-center px-0",
        )}
      >
        <Shield className="h-5 w-5 shrink-0 text-[var(--green)]" />
        {!collapsed ? (
          <div>
            <div className="font-semibold text-[var(--teal)]">Local data</div>
            <div className="text-xs text-slate-500">Stored on this device</div>
          </div>
        ) : null}
      </div>
      {collapsed ? <Tooltip>Local data stored on this device</Tooltip> : null}
    </div>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] opacity-0 shadow-[var(--shadow)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
    >
      {children}
    </span>
  );
}

function MobileNav({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: (options?: { restoreFocus?: boolean }) => void;
}) {
  return (
    <div
      data-testid="mobile-nav-backdrop"
      className="fixed inset-0 z-50 bg-black/50 lg:hidden"
      onClick={() => onClose()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        data-testid="mobile-nav"
        className="h-full w-[min(320px,calc(100vw-2rem))] overflow-y-auto bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 font-semibold">
            <div
              className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--teal)] text-white"
              aria-hidden="true"
            >
              ◉
            </div>
            Financial Compass
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-white"
            aria-label="Close navigation"
            onClick={() => onClose()}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Mobile navigation">
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
                      onClick={() => onClose({ restoreFocus: false })}
                      className={cn(
                        "relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700",
                        active && "bg-[var(--teal)] text-white shadow-sm",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-1 h-5 w-1 rounded-full bg-white"
                        />
                      ) : null}
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <LocalDataIndicator collapsed={false} />
      </aside>
    </div>
  );
}

function subscribeToNavPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(NAV_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(NAV_EVENT, callback);
  };
}

function getNavPreference() {
  return window.localStorage.getItem(NAV_STORAGE_KEY) === "collapsed";
}

function ThemeControl() {
  const preference = useSyncExternalStore(
    subscribeToThemePreference,
    getThemePreference,
    () => "light" as ThemePreference,
  );
  useEffect(() => applyThemePreference(preference), [preference]);
  const next: ThemePreference = preference === "light" ? "dark" : "light";
  const Icon = preference === "light" ? Moon : Sun;
  return (
    <button
      className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)]"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      data-icon={preference === "light" ? "moon" : "sun"}
      onClick={() => {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
        window.dispatchEvent(new Event(THEME_EVENT));
      }}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function subscribeToThemePreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyThemePreference(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = preference;
}
