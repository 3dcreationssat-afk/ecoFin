import { describe, expect, it } from "vitest";
import { plaidAmountToMinor } from "./money";

describe("Plaid amount conversion", () => {
  it("converts provider decimals without multiplication by floating point", () => {
    expect(plaidAmountToMinor("12.34")).toBe(1234);
    expect(plaidAmountToMinor(-5.2)).toBe(-520);
  });

  it("rejects amounts with unsupported precision", () => {
    expect(() => plaidAmountToMinor("1.005")).toThrow(/minor units/);
  });
});
