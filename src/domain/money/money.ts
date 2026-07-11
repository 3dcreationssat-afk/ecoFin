export type MinorUnit = number;

export function formatMoney(minor: MinorUnit, options: { compact?: boolean } = {}) {
  const value = minor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options.compact && Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function parseMoneyToMinor(input: string): MinorUnit {
  const value = input.trim();
  if (!value) throw new Error("Money value is required.");

  const sign = value.startsWith("-") ? -1 : 1;
  const normalized = value.replace(/^\+|-|\$/g, "").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a valid dollar amount with no more than two decimals.");
  }

  const [dollars, cents = ""] = normalized.split(".");
  const paddedCents = cents.padEnd(2, "0");
  const minor = Number.parseInt(dollars, 10) * 100 + Number.parseInt(paddedCents || "0", 10);
  if (!Number.isSafeInteger(minor)) throw new Error("Money value is too large.");
  return minor * sign;
}

export function minorToDecimalString(minor: MinorUnit) {
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  const dollars = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, "0");
  return `${sign}${dollars}.${cents}`;
}

export function addMinor(values: MinorUnit[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function subtractMinor(start: MinorUnit, values: MinorUnit[]) {
  return values.reduce((total, value) => total - value, start);
}
