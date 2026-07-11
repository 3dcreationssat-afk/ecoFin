import { describe, expect, it } from "vitest";
import { addMinor, formatMoney, subtractMinor } from "./money";

describe("money helpers", () => {
  it("formats integer minor units as USD", () => {
    expect(formatMoney(1025)).toBe("$10.25");
    expect(formatMoney(-284730)).toBe("-$2,847.30");
  });

  it("adds and subtracts without floating point money arithmetic", () => {
    expect(addMinor([1005, 20, -25])).toBe(1000);
    expect(subtractMinor(5000, [1250, 750])).toBe(3000);
  });
});
