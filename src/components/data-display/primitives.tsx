import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-normal text-[var(--text)]">{title}</h1>
          <span className="rounded-full border border-[#efd9ae] bg-[var(--amber-soft)] px-3 py-1 text-xs font-semibold text-[var(--amber)]">
            Demonstration data
          </span>
        </div>
        <p className="mt-1 text-base text-[var(--muted)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

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
        "min-h-[120px] p-6",
        featured && "border-2 border-[rgb(37_139_127_/_0.45)]",
        tone === "warning" && "bg-[var(--amber-soft)]",
      )}
    >
      <div className="text-sm font-medium text-[var(--muted)]">{label}</div>
      <div
        className={cn(
          "mt-3 text-3xl font-semibold text-[var(--text)]",
          tone === "positive" && "text-[var(--green)]",
          tone === "critical" && "text-[var(--red)]",
          tone === "warning" && "text-[var(--amber)]",
        )}
      >
        {value}
      </div>
      {detail ? <div className="mt-2 text-sm text-[var(--muted)]">{detail}</div> : null}
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
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      disabled={disabled}
      title={title}
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
