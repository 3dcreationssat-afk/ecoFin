"use client";

import { FileDown, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/data-display/primitives";
import { reportCsv, reportHtml, type ReportExport } from "@/domain/reports/export";

export function ReportControls({
  month,
  months,
  view,
  comparison,
  report,
}: {
  month: string;
  months: { value: string; label: string }[];
  view: "SUMMARY" | "CATEGORIES";
  comparison: "NONE" | "PRIOR_MONTH" | "PRIOR_YEAR";
  report: ReportExport;
}) {
  const router = useRouter();
  function navigate(next: { month?: string; view?: string; comparison?: string }) {
    const params = new URLSearchParams({ month, view, comparison, ...next });
    router.replace(`/reports?${params.toString()}`, { scroll: false });
  }
  function downloadCsv() {
    download(`financial-compass-${month}.csv`, reportCsv(report), "text/csv;charset=utf-8");
  }
  function downloadHtml() {
    download(`financial-compass-${month}.html`, reportHtml(report), "text/html;charset=utf-8");
  }
  return (
    <div className="mb-7 flex flex-wrap items-end gap-3 print:hidden">
      <label className="text-sm font-medium">
        Report
        <select
          className="mt-1 block h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3"
          value={view}
          onChange={(event) => navigate({ view: event.target.value })}
        >
          <option value="SUMMARY">Monthly summary</option>
          <option value="CATEGORIES">Category detail</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Period
        <select
          className="mt-1 block h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3"
          value={month}
          onChange={(event) => navigate({ month: event.target.value })}
        >
          {months.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Compare with
        <select
          className="mt-1 block h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3"
          value={comparison}
          onChange={(event) => navigate({ comparison: event.target.value })}
        >
          <option value="NONE">No comparison</option>
          <option value="PRIOR_MONTH">Prior month</option>
          <option value="PRIOR_YEAR">Same month last year</option>
        </select>
      </label>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
        <Button variant="secondary" onClick={downloadCsv}>
          <FileDown className="h-4 w-4" /> CSV
        </Button>
        <Button variant="secondary" onClick={downloadHtml}>
          <FileDown className="h-4 w-4" /> HTML
        </Button>
      </div>
    </div>
  );
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
