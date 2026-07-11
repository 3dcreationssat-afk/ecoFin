export type MinorUnit = number;

export function formatMoney(minor: MinorUnit, options: { compact?: boolean } = {}) {
  const value = minor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options.compact && Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function addMinor(values: MinorUnit[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function subtractMinor(start: MinorUnit, values: MinorUnit[]) {
  return values.reduce((total, value) => total - value, start);
}
