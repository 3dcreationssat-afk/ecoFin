import { cn } from "@/lib/utils";
import type { WorkspaceState } from "@/domain/workspace/schema";

export function PageHeader({
  title,
  subtitle,
  action,
  workspaceState = "DEMONSTRATION",
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  workspaceState?: WorkspaceState;
}) {
  const badge = workspaceBadges[workspaceState];
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-normal text-[var(--text)]">{title}</h1>
          <span
            role="status"
            aria-label={`${badge.label}: ${badge.description}`}
            title={badge.description}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              workspaceState === "DEMONSTRATION" &&
                "border-[#efd9ae] bg-[var(--amber-soft)] text-[var(--amber)]",
              workspaceState === "EMPTY" && "border-sky-200 bg-sky-50 text-sky-700",
              workspaceState === "USER_DATA" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              workspaceState === "MIXED" && "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {badge.label}
          </span>
        </div>
        <p className="mt-1 text-base text-[var(--muted)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

const workspaceBadges: Record<WorkspaceState, { label: string; description: string }> = {
  DEMONSTRATION: {
    label: "Demonstration data",
    description: "Only the canonical sample dataset is present.",
  },
  EMPTY: {
    label: "Empty workspace",
    description: "No meaningful financial records are present yet.",
  },
  USER_DATA: {
    label: "Your data",
    description: "User-created or imported records are present without sample data.",
  },
  MIXED: {
    label: "Mixed data",
    description: "Sample records and user-created or imported records coexist.",
  },
};

export function Card({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  featured,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  featured?: boolean;
  tone?: "default" | "positive" | "warning" | "critical";
}) {
  return (
    <Card
      className={cn(
        "min-h-[120px] min-w-0 p-6",
        featured && "border-2 border-[rgb(37_139_127_/_0.45)]",
        tone === "warning" && "bg-[var(--amber-soft)]",
      )}
    >
      <div className="break-words text-sm font-medium text-[var(--muted)]">{label}</div>
      <div
        className={cn(
          "mt-3 break-words text-3xl font-semibold text-[var(--text)]",
          tone === "positive" && "text-[var(--green)]",
          tone === "critical" && "text-[var(--red)]",
          tone === "warning" && "text-[var(--amber)]",
        )}
      >
        {value}
      </div>
      {detail ? <div className="mt-2 break-words text-sm text-[var(--muted)]">{detail}</div> : null}
    </Card>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "bad" && "border-red-200 bg-red-50 text-red-700",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-700",
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  disabled = false,
  title,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold",
        variant === "primary" && "bg-[var(--teal)] text-white",
        variant === "secondary" && "border border-[var(--border)] bg-white text-[var(--text)]",
        disabled && "cursor-not-allowed opacity-55",
      )}
    >
      {children}
    </button>
  );
}

export function PlannedControl({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      disabled
      title="Planned for a later phase"
      className={cn(
        "inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--muted)] opacity-70",
        className,
      )}
    >
      {children}
      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]">
        Planned
      </span>
    </button>
  );
}
