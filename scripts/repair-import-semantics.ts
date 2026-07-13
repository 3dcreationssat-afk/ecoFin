import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectImportSemanticsRepair } from "../src/server/data/import-repair";
import { prisma } from "../src/server/db/prisma";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const expectedRecordCount = Number(options["expected-records"]);
  const sourceDir = options["source-dir"];
  if (!sourceDir || !Number.isInteger(expectedRecordCount) || expectedRecordCount <= 0) {
    throw new Error(
      "Usage: tsx scripts/repair-import-semantics.ts --source-dir <dir> --expected-records <count> --expected-account-class ASSET|LIABILITY --expected-sign-convention DEBITS_NEGATIVE|DEBITS_POSITIVE",
    );
  }
  const expectedClass = options["expected-account-class"];
  if (!["ASSET", "LIABILITY"].includes(expectedClass))
    throw new Error("Expected account class is required.");
  const expectedConvention = options["expected-sign-convention"];
  if (!["DEBITS_NEGATIVE", "DEBITS_POSITIVE"].includes(expectedConvention))
    throw new Error("Expected sign convention is required.");

  const hashes = await csvHashes(resolve(sourceDir));
  const candidates = await prisma.importBatch.findMany({
    where: {
      fileHash: { in: hashes },
      status: { in: ["IMPORTED", "PARTIALLY_IMPORTED"] },
    },
    include: { account: true, _count: { select: { transactions: true } } },
  });
  const eligible = candidates.filter((batch) =>
    expectedClass === "LIABILITY"
      ? ["CREDIT", "LOAN", "MORTGAGE"].includes(batch.account.type)
      : !["CREDIT", "LOAN", "MORTGAGE"].includes(batch.account.type),
  );
  const selections = subsetsWithTotal(eligible, expectedRecordCount);
  if (selections.length !== 1)
    throw new Error(
      `Repair refused: source provenance resolved to ${selections.length} possible batch selections.`,
    );
  const inspection = await inspectImportSemanticsRepair({
    batchIds: selections[0].map((batch) => batch.id),
    expectedRecordCount,
    expectedAccount: { kind: "CLASS", value: expectedClass as "ASSET" | "LIABILITY" },
    expectedSignConvention: expectedConvention as "DEBITS_NEGATIVE" | "DEBITS_POSITIVE",
  });
  console.log(JSON.stringify(inspection, null, 2));
  if (!inspection.safeToApply) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

async function csvHashes(directory: string) {
  const files = (await readdir(directory)).filter((file) => file.toLowerCase().endsWith(".csv"));
  return Promise.all(
    files.map(async (file) =>
      createHash("sha256")
        .update(await readFile(resolve(directory, file)))
        .digest("hex"),
    ),
  );
}

function subsetsWithTotal<T extends { _count: { transactions: number } }>(
  items: T[],
  total: number,
) {
  const matches: T[][] = [];
  const visit = (index: number, sum: number, selected: T[]) => {
    if (sum === total) {
      matches.push([...selected]);
      return;
    }
    if (sum > total || index >= items.length || matches.length > 1) return;
    visit(index + 1, sum + items[index]._count.transactions, [...selected, items[index]]);
    visit(index + 1, sum, selected);
  };
  visit(0, 0, []);
  return matches;
}

function parseArgs(values: string[]) {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    if (key) result[key] = values[index + 1] ?? "";
  }
  return result;
}
