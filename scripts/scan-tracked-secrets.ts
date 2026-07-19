import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const patterns = [
  { name: "Plaid access token", pattern: /access-(?:sandbox|production)-[A-Za-z0-9_-]{8,}/g },
  {
    name: "Plaid secret value",
    pattern: /PLAID_SECRET\s*=\s*["']?(?!["']?(?:<|$))[A-Za-z0-9_-]{8,}/g,
  },
  {
    name: "Plaid encryption key value",
    pattern: /PLAID_TOKEN_ENCRYPTION_KEY\s*=\s*["']?[A-Za-z0-9+/=_-]{20,}/g,
  },
];
const findings: string[] = [];
for (const file of files) {
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const text = bytes.toString("utf8");
  for (const candidate of patterns) {
    if (candidate.pattern.test(text)) findings.push(`${file}: ${candidate.name}`);
    candidate.pattern.lastIndex = 0;
  }
}
if (findings.length) {
  console.error(`Tracked secret scan failed:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log(`Tracked secret scan passed (${files.length} files checked).`);
