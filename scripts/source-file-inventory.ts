import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { prisma } from "../src/server/db/prisma";

const excludedDirectories = new Set([".git", ".next", ".next-build", "node_modules", "backups"]);

async function main() {
  const roots = valuesFor("--root").map((root) => resolve(root));
  if (!roots.length) throw new Error("Provide at least one --root directory.");
  const expected = new Set(
    (await prisma.importBatch.findMany({ select: { fileHash: true } })).map(
      (batch) => batch.fileHash,
    ),
  );
  const matches: Array<{ path: string; sha256: string; sizeBytes: number }> = [];
  let csvFilesScanned = 0;
  let unreadableCsvFiles = 0;
  for (const root of roots) {
    for (const path of walk(root)) {
      if (extname(path).toLowerCase() !== ".csv") continue;
      csvFilesScanned++;
      try {
        const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
        if (expected.has(sha256)) matches.push({ path, sha256, sizeBytes: statSync(path).size });
      } catch {
        unreadableCsvFiles++;
      }
    }
  }
  const matchedHashes = new Set(matches.map((match) => match.sha256));
  const report = {
    generatedAt: new Date().toISOString(),
    roots,
    csvFilesScanned,
    unreadableCsvFiles,
    expectedSourceHashes: expected.size,
    matchedSourceHashes: matchedHashes.size,
    missingSourceHashes: [...expected].filter((hash) => !matchedHashes.has(hash)),
    matches,
  };
  const output = valueFor("--output");
  if (output) {
    const resolved = resolve(output);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(
    JSON.stringify({
      csvFilesScanned,
      unreadableCsvFiles,
      expectedSourceHashes: expected.size,
      matchedSourceHashes: matchedHashes.size,
      missingSourceHashes: expected.size - matchedHashes.size,
    }),
  );
}

function* walk(root: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) yield* walk(path);
    } else if (entry.isFile()) yield path;
  }
}

function valuesFor(flag: string) {
  return process.argv.flatMap((value, index) =>
    value === flag && process.argv[index + 1] ? [process.argv[index + 1]] : [],
  );
}
function valueFor(flag: string) {
  return valuesFor(flag)[0];
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Source inventory failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
