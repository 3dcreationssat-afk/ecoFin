import { describe, expect, it } from "vitest";
import {
  detectDelimiter,
  isAmbiguousSlashDate,
  parseCsv,
  parseDateOnly,
  parseDebitCreditAmount,
  normalizeSignedAmount,
  parseSignedAmount,
  scoreDuplicate,
  sha256Text,
} from "./csv";

describe("csv import domain", () => {
  it("detects delimiters, headers, quoted commas, and UTF-8 BOM", () => {
    expect(detectDelimiter('Date,Description,Amount\n2026-07-01,"Coffee, Shop",-4.50')).toBe(",");
    expect(detectDelimiter("Date;Description;Amount\n2026-07-01;Coffee;-4.50")).toBe(";");
    const parsed = parseCsv({
      filename: "synthetic.csv",
      fileSize: 64,
      content: '\ufeffDate,Description,Amount\n2026-07-01,"Coffee, Shop",-4.50',
    });
    expect(parsed.encoding).toBe("UTF-8-BOM");
    expect(parsed.headers).toEqual(["Date", "Description", "Amount"]);
    expect(parsed.rows[0][1]).toBe("Coffee, Shop");
  });

  it("rejects malformed quoting, binary content, long fields, duplicate headers, and non-csv files", () => {
    expect(() =>
      parseCsv(
        { filename: "synthetic.csv", fileSize: 20, content: 'Date,Amount\n"bad,1.00' },
        { delimiter: "," },
      ),
    ).toThrow(/quoting/);
    expect(() =>
      parseCsv({ filename: "synthetic.csv", fileSize: 20, content: "Date\0Amount" }),
    ).toThrow(/binary/);
    expect(() =>
      parseCsv({
        filename: "synthetic.csv",
        fileSize: 600,
        content: `Date,Description,Amount\n2026-07-01,${"x".repeat(501)},1.00`,
      }),
    ).toThrow(/exceeds/);
    expect(() =>
      parseCsv({ filename: "synthetic.csv", fileSize: 32, content: "Date,Date\n2026-07-01,1.00" }),
    ).toThrow(/Duplicate/);
    expect(() =>
      parseCsv({
        filename: "../statement.txt",
        fileSize: 32,
        content: "Date,Amount\n2026-07-01,1.00",
      }),
    ).toThrow(/csv/);
  });

  it("parses explicit dates and requires explicit handling for ambiguous dates", () => {
    expect(parseDateOnly("07/11/2026", "MM/DD/YYYY").toISOString().slice(0, 10)).toBe("2026-07-11");
    expect(parseDateOnly("11/07/2026", "DD/MM/YYYY").toISOString().slice(0, 10)).toBe("2026-07-11");
    expect(parseDateOnly("2026-07-11", "YYYY-MM-DD").toISOString().slice(0, 10)).toBe("2026-07-11");
    expect(isAmbiguousSlashDate("03/04/2026")).toBe(true);
    expect(() => parseDateOnly("03/04/2026", "AUTO")).toThrow(/explicit/);
  });

  it("parses signed and debit-credit amounts without floating point", () => {
    expect(parseSignedAmount("$1,250.00", { decimalSeparator: ".", thousandsSeparator: "," })).toBe(
      125000,
    );
    expect(parseSignedAmount("(125.50)", { decimalSeparator: ".", thousandsSeparator: "," })).toBe(
      -12550,
    );
    expect(parseSignedAmount("-25.50", { decimalSeparator: ".", thousandsSeparator: "," })).toBe(
      -2550,
    );
    expect(parseSignedAmount("+12.75", { decimalSeparator: ".", thousandsSeparator: "," })).toBe(
      1275,
    );
    expect(
      normalizeSignedAmount("12.75", {
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_POSITIVE",
      }),
    ).toBe(-1275);
    expect(parseSignedAmount("1.250,75", { decimalSeparator: ",", thousandsSeparator: "." })).toBe(
      125075,
    );
    expect(() =>
      parseSignedAmount("12.345", { decimalSeparator: ".", thousandsSeparator: "," }),
    ).toThrow(/precision/);
    expect(
      parseDebitCreditAmount("125.50", "", {
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
      }),
    ).toBe(-12550);
    expect(
      parseDebitCreditAmount("", "2500.00", {
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
      }),
    ).toBe(250000);
  });

  it("hashes files and scores duplicates explainably", () => {
    expect(sha256Text("same")).toBe(sha256Text("same"));
    const date = new Date("2026-07-11T00:00:00.000Z");
    expect(
      scoreDuplicate(
        {
          accountId: "acct",
          transactionDate: date,
          amountMinor: -1000,
          originalDescription: "Coffee",
          normalizedMerchant: "Coffee",
        },
        [
          {
            accountId: "acct",
            transactionDate: date,
            amountMinor: -1000,
            originalDescription: "Coffee",
            normalizedMerchant: "Coffee",
          },
        ],
      ).status,
    ).toBe("EXACT_OVERLAP");
    expect(
      scoreDuplicate(
        {
          accountId: "acct",
          transactionDate: new Date("2026-08-11"),
          amountMinor: -1000,
          originalDescription: "Coffee",
          normalizedMerchant: "Coffee",
        },
        [
          {
            accountId: "acct",
            transactionDate: date,
            amountMinor: -1000,
            originalDescription: "Coffee",
            normalizedMerchant: "Coffee",
          },
        ],
      ).status,
    ).toBe("NONE");
    expect(
      scoreDuplicate(
        {
          accountId: "acct",
          transactionDate: new Date("2026-08-11"),
          amountMinor: -2000,
          originalDescription: "Changed",
          normalizedMerchant: "Changed",
          fileHash: "same-file",
          rowNumber: 7,
        },
        [
          {
            accountId: "acct",
            transactionDate: date,
            amountMinor: -1000,
            originalDescription: "Original",
            normalizedMerchant: "Original",
            fileHash: "same-file",
            rowNumber: 7,
          },
        ],
      ).status,
    ).toBe("EXACT");
  });
});
