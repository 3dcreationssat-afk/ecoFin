export function plaidAmountToMinor(value: number | string) {
  const text = typeof value === "number" ? value.toString() : value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match)
    throw new Error("Plaid returned an amount that cannot be represented in minor units.");
  const fraction = (match[3] ?? "").padEnd(2, "0");
  const magnitude = BigInt(match[2]) * BigInt(100) + BigInt(fraction || "0");
  const signed = match[1] ? -magnitude : magnitude;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("Plaid returned an amount outside the supported minor-unit range.");
  }
  return Number(signed);
}
