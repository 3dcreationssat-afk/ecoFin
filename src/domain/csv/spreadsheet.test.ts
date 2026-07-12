import { describe, expect, it } from "vitest";
import { spreadsheetSafeCsvCell } from "./spreadsheet";

describe("spreadsheet-safe CSV cells", () => {
  it.each([
    ['=HYPERLINK("https://example.invalid","Click")', "'=HYPERLINK"],
    ["=1+1", "'=1+1"],
    ["+SUM(1,2)", "'+SUM"],
    ["-10+20", "'-10+20"],
    ["@SUM(1,2)", "'@SUM"],
  ])("neutralizes executable text without changing the source value", (value, expected) => {
    expect(spreadsheetSafeCsvCell(value, "text")).toContain(expected);
    expect(value.startsWith("'")).toBe(false);
  });

  it.each(["AplPay ALIMENTACION MADRID ES", "FOREIGN TRANSACTION FEE", "-92002", "-25.50"])(
    "preserves safe text %s",
    (value) => expect(spreadsheetSafeCsvCell(value, "text")).toBe(value),
  );

  it("preserves numeric cells and quotes commas, quotes, and line breaks", () => {
    expect(spreadsheetSafeCsvCell(6.88, "number")).toBe("6.88");
    expect(spreadsheetSafeCsvCell(-25.5, "number")).toBe("-25.5");
    expect(spreadsheetSafeCsvCell('safe, "quoted"\ntext', "text")).toBe('"safe, ""quoted""\ntext"');
  });
});
