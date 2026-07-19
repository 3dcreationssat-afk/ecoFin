import { describe, expect, it } from "vitest";
import { reportCsv, reportHtml, type ReportExport } from "./export";

const report: ReportExport = {
  periodLabel: "July 2026",
  income: "$1,000.00",
  spending: "$500.00",
  netCashFlow: "$500.00",
  savingsRate: "50%",
  categories: [{ category: 'Food, dining & "fun" <test>', spending: "$500.00" }],
};

describe("local report exports", () => {
  it("produces quoted CSV with escaped category data", () => {
    const csv = reportCsv(report);
    expect(csv).toContain('"July 2026"');
    expect(csv).toContain('"Food, dining & ""fun"" <test>"');
  });

  it("produces standalone HTML without allowing category markup injection", () => {
    const html = reportHtml(report);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Food, dining &amp; &quot;fun&quot; &lt;test&gt;");
    expect(html).not.toContain("<test>");
  });
});
