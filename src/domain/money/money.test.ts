import { describe, expect, it } from "vitest";
import { addMinor, formatMoney, parseMoneyToMinor, subtractMinor } from "./money";

describe("money helpers", () => {
  it("formats integer minor units as USD", () => {
    expect(formatMoney(1025)).toBe("$10.25");
    expect(formatMoney(-284730)).toBe("-$2,847.30");
  });

  it("adds and subtracts without floating point money arithmetic", () => {
    expect(addMinor([1005, 20, -25])).toBe(1000);
    expect(subtractMinor(5000, [1250, 750])).toBe(3000);
  });

  it.each([
    ["0.01", 1],
    ["10.25", 1025],
    ["-10.25", -1025],
    ["1,234,567.89", 123456789],
    ["$42.00", 4200],
  ])("parses %s to integer minor units", (input, expected) => {
    expect(parseMoneyToMinor(input)).toBe(expected);
  });

  it.each(["", "abc", "1.234", "$1.2.3"])("rejects invalid money input %s", (input) => {
    expect(() => parseMoneyToMinor(input)).toThrow();
  });
});
