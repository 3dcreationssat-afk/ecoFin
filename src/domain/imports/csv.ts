import { createHash } from "node:crypto";
import type { dateFormats } from "./schema";

export const IMPORT_LIMITS = {
  maxFileBytes: 512 * 1024,
  maxRows: 10_000,
  maxFieldChars: 500,
  previewRows: 8,
};

export type ParsedCsv = {
  encoding: "UTF-8" | "UTF-8-BOM";
  delimiter: "," | ";" | "\t";
  hasHeader: boolean;
  headers: string[];
  rows: string[][];
  sampleRows: string[][];
  warnings: string[];
};

export function sha256Text(input: string) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function safeFilename(filename: string) {
  return filename.replace(/[/\\]/g, "").trim().slice(0, 180) || "import.csv";
}

export function validateFilename(filename: string) {
  const safe = safeFilename(filename);
  if (!/\.csv$/i.test(safe)) throw new Error("Only .csv files are supported.");
  return safe;
}

export function stripUtf8Bom(content: string) {
  return content.charCodeAt(0) === 0xfeff
    ? { content: content.slice(1), encoding: "UTF-8-BOM" as const }
    : { content, encoding: "UTF-8" as const };
}

export function rejectUnsafeText(content: string, fileSize: number) {
  if (fileSize > IMPORT_LIMITS.maxFileBytes) throw new Error("CSV file exceeds the 512 KB limit.");
  if (!content.trim()) throw new Error("CSV file is empty.");
  if (/\0/.test(content)) throw new Error("CSV appears to contain unsupported binary data.");
}

export function detectDelimiter(content: string): "," | ";" | "\t" | null {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 5);
  const scores = ([",", ";", "\t"] as const).map((delimiter) => {
    const counts = lines.map((line) => splitCsvLine(line, delimiter).length);
    const consistent = counts.every((count) => count === counts[0]);
    return { delimiter, columns: counts[0] ?? 0, consistent };
  });
  const viable = scores.filter((score) => score.consistent && score.columns > 1);
  viable.sort((a, b) => b.columns - a.columns);
  if (viable.length === 0) return null;
  if (viable.length > 1 && viable[0].columns === viable[1].columns) return null;
  return viable[0].delimiter;
}

export function looksLikeHeader(row: string[]) {
  const textCount = row.filter((cell) => /[A-Za-z]/.test(cell)).length;
  const dateOrAmountCount = row.filter((cell) => /\d{1,4}[/-]\d{1,2}|^-?\$?\d/.test(cell)).length;
  return textCount > 0 && textCount >= dateOrAmountCount;
}

export function parseCsv(
  input: { filename: string; fileSize: number; content: string },
  options: { delimiter?: "," | ";" | "\t"; hasHeader?: boolean } = {},
): ParsedCsv {
  validateFilename(input.filename);
  rejectUnsafeText(input.content, input.fileSize);
  const stripped = stripUtf8Bom(input.content);
  const delimiter = options.delimiter ?? detectDelimiter(stripped.content);
  if (!delimiter) throw new Error("Could not confidently detect delimiter. Choose one manually.");
  const rows = parseCsvRows(stripped.content, delimiter);
  if (rows.length === 0) throw new Error("CSV file is empty.");
  if (rows.length > IMPORT_LIMITS.maxRows + 1)
    throw new Error(`CSV exceeds the ${IMPORT_LIMITS.maxRows} row limit.`);

  for (const row of rows) {
    for (const field of row) {
      if (field.length > IMPORT_LIMITS.maxFieldChars) {
        throw new Error(`CSV field exceeds ${IMPORT_LIMITS.maxFieldChars} characters.`);
      }
    }
  }

  const hasHeader = options.hasHeader ?? looksLikeHeader(rows[0]);
  const headers = hasHeader
    ? rows[0].map((header) => header.trim())
    : rows[0].map((_, index) => `Column ${index + 1}`);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (hasHeader && duplicateHeaders.length) {
    throw new Error(
      `Duplicate headers are not supported: ${[...new Set(duplicateHeaders)].join(", ")}`,
    );
  }
  const dataRows = hasHeader ? rows.slice(1) : rows;
  return {
    encoding: stripped.encoding,
    delimiter,
    hasHeader,
    headers,
    rows: dataRows,
    sampleRows: dataRows.slice(0, IMPORT_LIMITS.previewRows),
    warnings: hasHeader ? [] : ["No header row detected. Column numbers will be used."],
  };
}

export function parseCsvRows(content: string, delimiter: "," | ";" | "\t") {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((field) => field.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  if (inQuotes) throw new Error("Malformed CSV quoting.");
  row.push(current);
  if (row.some((field) => field.trim() !== "")) rows.push(row);
  return rows;
}

export function splitCsvLine(line: string, delimiter: "," | ";" | "\t") {
  try {
    return parseCsvRows(line, delimiter)[0] ?? [];
  } catch {
    return [];
  }
}

export function isFormulaLike(value: string) {
  return /^[=+\-@]/.test(value.trim());
}

export function parseDateOnly(value: string, format: (typeof dateFormats)[number] | "AUTO") {
  const raw = value.trim();
  if (!raw) throw new Error("Date is required.");
  if (format === "AUTO") throw new Error("Select an explicit date format before parsing dates.");
  const separator = raw.includes("-") ? "-" : "/";
  const parts = raw.split(separator);
  let year = 0;
  let month = 0;
  let day = 0;
  const toYear = (part: string) => {
    const value = Number.parseInt(part, 10);
    return part.length === 2 ? 2000 + value : value;
  };
  if (format === "YYYY-MM-DD") {
    if (separator !== "-" || parts.length !== 3) throw new Error("Date does not match YYYY-MM-DD.");
    year = toYear(parts[0]);
    month = Number.parseInt(parts[1], 10);
    day = Number.parseInt(parts[2], 10);
  } else {
    if (separator !== "/" || parts.length !== 3) throw new Error(`Date does not match ${format}.`);
    const [a, b] = parts.map((part) => Number.parseInt(part, 10));
    if (format.startsWith("MM") || format.startsWith("M/")) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    year = toYear(parts[2]);
    if (
      (format.endsWith("YYYY") && parts[2].length !== 4) ||
      (!format.endsWith("YYYY") && format.endsWith("YY") && parts[2].length !== 2)
    ) {
      throw new Error(`Date does not match ${format}.`);
    }
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date is invalid.");
  }
  return date;
}

export function isAmbiguousSlashDate(value: string) {
  const parts = value.trim().split("/");
  if (parts.length !== 3) return false;
  const a = Number.parseInt(parts[0], 10);
  const b = Number.parseInt(parts[1], 10);
  return a >= 1 && a <= 12 && b >= 1 && b <= 12 && a !== b;
}

export function parseSignedAmount(
  value: string,
  options: {
    decimalSeparator: "." | ",";
    thousandsSeparator: "," | "." | " " | "";
    parenthesesNegative?: boolean;
  },
) {
  const raw = value.trim();
  if (!raw) throw new Error("Amount is required.");
  let negative = raw.startsWith("-");
  let cleaned = raw.replace(/[$€£]/g, "").replace(/^[-+]/, "").trim();
  if (/^\(.+\)$/.test(cleaned)) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  }
  if (options.thousandsSeparator) cleaned = cleaned.split(options.thousandsSeparator).join("");
  if (options.decimalSeparator === ",") cleaned = cleaned.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned))
    throw new Error("Amount has an unsupported format or precision.");
  const [major, minor = ""] = cleaned.split(".");
  const cents = minor.padEnd(2, "0");
  const amount = Number.parseInt(major, 10) * 100 + Number.parseInt(cents || "0", 10);
  if (!Number.isSafeInteger(amount)) throw new Error("Amount is too large.");
  return negative ? -amount : amount;
}

export function parseDebitCreditAmount(
  debit: string,
  credit: string,
  options: {
    decimalSeparator: "." | ",";
    thousandsSeparator: "," | "." | " " | "";
    signConvention: "DEBITS_NEGATIVE" | "DEBITS_POSITIVE";
  },
) {
  const debitValue = debit.trim();
  const creditValue = credit.trim();
  if (debitValue && creditValue) throw new Error("Debit and credit cannot both contain values.");
  if (!debitValue && !creditValue) throw new Error("Debit or credit amount is required.");
  const source = debitValue || creditValue;
  const absolute = Math.abs(parseSignedAmount(source, options));
  const debitSign = options.signConvention === "DEBITS_NEGATIVE" ? -1 : 1;
  const creditSign = debitSign * -1;
  return debitValue ? absolute * debitSign : absolute * creditSign;
}

export function transactionKind(amountMinor: number) {
  if (amountMinor < 0) return "Expense";
  if (amountMinor > 0) return "Income";
  return "Unknown";
}

export type DuplicateInput = {
  accountId: string;
  transactionDate: Date;
  postedDate?: Date | null;
  amountMinor: number;
  originalDescription: string;
  normalizedMerchant: string;
  importBatchId?: string | null;
  fileHash?: string | null;
  rowNumber?: number | null;
};

export function scoreDuplicate(row: DuplicateInput, existing: DuplicateInput[]) {
  let best = { status: "NONE" as "NONE" | "POSSIBLE" | "LIKELY" | "EXACT", reason: "" };
  for (const candidate of existing) {
    let score = 0;
    const reasons: string[] = [];
    if (candidate.accountId === row.accountId) {
      score += 25;
      reasons.push("same account");
    }
    if (sameDate(candidate.transactionDate, row.transactionDate)) {
      score += 25;
      reasons.push("same transaction date");
    }
    if (candidate.amountMinor === row.amountMinor) {
      score += 25;
      reasons.push("same amount");
    }
    if (
      candidate.originalDescription.trim().toLowerCase() ===
      row.originalDescription.trim().toLowerCase()
    ) {
      score += 15;
      reasons.push("same original description");
    }
    if (
      candidate.fileHash &&
      row.fileHash &&
      candidate.fileHash === row.fileHash &&
      candidate.rowNumber === row.rowNumber
    ) {
      score += 50;
      reasons.push("same file and row");
    }
    const status =
      score >= 100 ? "EXACT" : score >= 75 ? "LIKELY" : score >= 50 ? "POSSIBLE" : "NONE";
    if (rank(status) > rank(best.status)) best = { status, reason: reasons.join(", ") };
  }
  return best;
}

function sameDate(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function rank(status: "NONE" | "POSSIBLE" | "LIKELY" | "EXACT") {
  return ["NONE", "POSSIBLE", "LIKELY", "EXACT"].indexOf(status);
}
