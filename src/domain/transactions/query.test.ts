import { describe, expect, it } from "vitest";
import {
  financialPeriodBounds,
  parseTransactionQuery,
  serializeTransactionQuery,
  withTransactionQueryChange,
} from "./query";

describe("transaction query state", () => {
  it("parses, validates, and omits defaults", () => {
    const query = parseTransactionQuery(
      new URLSearchParams("q=coffee&page=-3&pageSize=999&type=bogus&excluded=excluded"),
    );
    expect(query).toMatchObject({ q: "coffee", page: 1, pageSize: 25, excluded: "excluded" });
    expect(query.type).toBeUndefined();
    expect(serializeTransactionQuery(query).toString()).toBe("q=coffee&excluded=excluded");
  });

  it("resets the page for material changes and preserves it for pagination", () => {
    const query = parseTransactionQuery(new URLSearchParams("page=4&pageSize=50"));
    expect(withTransactionQueryChange(query, { source: "CSV_IMPORT" }).page).toBe(1);
    expect(withTransactionQueryChange(query, { page: 3 }, true).page).toBe(3);
  });

  it("uses the configured financial-month start", () => {
    expect(financialPeriodBounds("CURRENT_MONTH", 15, new Date("2026-07-12T12:00:00Z"))).toEqual({
      from: "2026-06-15",
      to: "2026-07-14",
    });
    expect(financialPeriodBounds("PREVIOUS_MONTH", 15, new Date("2026-07-20T12:00:00Z"))).toEqual({
      from: "2026-06-15",
      to: "2026-07-14",
    });
  });

  it("drops invalid or reversed custom ranges", () => {
    const parsed = parseTransactionQuery(
      new URLSearchParams("period=CUSTOM&from=2026-08-01&to=2026-07-01"),
    );
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
  });
});
