export type PlaidAccountEvidence = {
  displayName: string;
  officialName?: string | null;
  institutionName?: string | null;
  type: string;
  subtype?: string | null;
  mask?: string | null;
};

export type LocalAccountEvidence = {
  id: string;
  name: string;
  institution: string;
  type: string;
  archivedAt?: Date | string | null;
};

export function normalizeAccountEvidence(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function scoreAccountMatch(provider: PlaidAccountEvidence, local: LocalAccountEvidence) {
  const reasons: string[] = [];
  if (local.archivedAt)
    return { score: 0, confidence: "LOW" as const, reasons: ["Local account is archived."] };
  let score = 0;
  if (mapPlaidType(provider.type, provider.subtype) === local.type) {
    score += 45;
    reasons.push("Account types agree.");
  } else {
    return { score: 0, confidence: "LOW" as const, reasons: ["Account types conflict."] };
  }
  const institution = normalizeAccountEvidence(provider.institutionName);
  if (institution && institution === normalizeAccountEvidence(local.institution)) {
    score += 25;
    reasons.push("Institution names agree.");
  }
  const names = [provider.displayName, provider.officialName]
    .map(normalizeAccountEvidence)
    .filter(Boolean);
  const localName = normalizeAccountEvidence(local.name);
  if (names.includes(localName)) {
    score += 25;
    reasons.push("Account names agree exactly after normalization.");
  } else if (names.some((name) => name.includes(localName) || localName.includes(name))) {
    score += 15;
    reasons.push("Account names substantially overlap.");
  }
  const confidence = score >= 90 ? "HIGH" : score >= 65 ? "MEDIUM" : "LOW";
  return { score, confidence, reasons };
}

export function bestAccountMatch(
  provider: PlaidAccountEvidence,
  localAccounts: LocalAccountEvidence[],
) {
  const scored = localAccounts
    .map((account) => ({ account, ...scoreAccountMatch(provider, account) }))
    .sort((a, b) => b.score - a.score || a.account.id.localeCompare(b.account.id));
  const best = scored[0];
  const tied = best
    ? scored.filter((candidate) => candidate.score === best.score).length > 1
    : false;
  if (!best || best.score < 65 || tied) return null;
  return best;
}

export function mapPlaidType(type: string, subtype?: string | null) {
  if (type === "depository") return subtype === "savings" ? "SAVINGS" : "CHECKING";
  if (type === "credit") return "CREDIT";
  if (type === "loan") {
    return subtype === "mortgage" || subtype === "home equity" ? "MORTGAGE" : "LOAN";
  }
  return "OTHER";
}
