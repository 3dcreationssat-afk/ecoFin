export type ReportExport = {
  periodLabel: string;
  income: string;
  spending: string;
  netCashFlow: string;
  savingsRate: string;
  categories: { category: string; spending: string }[];
};

export function reportCsv(report: ReportExport) {
  const rows = [
    ["Financial Compass report", report.periodLabel],
    ["Income", report.income],
    ["Spending", report.spending],
    ["Net cash flow", report.netCashFlow],
    ["Savings rate", report.savingsRate],
    [],
    ["Category", "Spending"],
    ...report.categories.map((row) => [row.category, row.spending]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function reportHtml(report: ReportExport) {
  const categoryRows = report.categories
    .map(
      (row) => `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.spending)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Financial Compass ${escapeHtml(report.periodLabel)}</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;color:#17202a}table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>Financial Compass</h1><h2>${escapeHtml(report.periodLabel)}</h2><dl><dt>Income</dt><dd>${escapeHtml(report.income)}</dd><dt>Spending</dt><dd>${escapeHtml(report.spending)}</dd><dt>Net cash flow</dt><dd>${escapeHtml(report.netCashFlow)}</dd><dt>Savings rate</dt><dd>${escapeHtml(report.savingsRate)}</dd></dl><h2>Spending by category</h2><table><thead><tr><th>Category</th><th>Spending</th></tr></thead><tbody>${categoryRows}</tbody></table><p>Generated locally by Financial Compass.</p></body></html>`;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
