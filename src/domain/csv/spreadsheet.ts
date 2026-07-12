export type CsvCellType = "text" | "number";

export function spreadsheetSafeCsvCell(value: string | number, type: CsvCellType) {
  const raw = String(value);
  const protectedValue = type === "text" && isExecutableSpreadsheetText(raw) ? `'${raw}` : raw;
  return quoteCsvCell(protectedValue);
}

export function isExecutableSpreadsheetText(value: string) {
  const trimmed = value.trimStart();
  if (!trimmed) return false;
  if (/^[+-]\d+(?:\.\d+)?$/.test(trimmed)) return false;
  if (/^[+-]\s+[A-Za-z]/.test(trimmed)) return false;
  return /^[=@]/.test(trimmed) || /^[+-].*[()+*/]/.test(trimmed);
}

function quoteCsvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
