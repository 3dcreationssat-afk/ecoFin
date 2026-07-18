import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import {
  configureDatabaseUrl,
  FINANCIAL_COMPASS_PROJECT_ROOT,
} from "../src/server/db/database-url";

loadEnvConfig(FINANCIAL_COMPASS_PROJECT_ROOT);
configureDatabaseUrl();
const prisma = new PrismaClient();
const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");

async function main() {
  const migrations = readdirSync("prisma/migrations")
    .sort()
    .filter((directory) => existsSync(join("prisma", "migrations", directory, "migration.sql")));

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_FinancialCompassMigration" (
      "name" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await baselineUntrackedLegacyDatabase(migrations);

  const appliedRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT "name" FROM "_FinancialCompassMigration"`,
  );
  const applied = new Set(appliedRows.map((row) => row.name));
  for (const directory of migrations) {
    if (applied.has(directory)) continue;
    execFileSync(
      process.execPath,
      [
        prismaCli,
        "db",
        "execute",
        "--schema",
        "prisma/schema.prisma",
        "--file",
        join("prisma", "migrations", directory, "migration.sql"),
      ],
      { stdio: "inherit", env: process.env },
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_FinancialCompassMigration" ("name") VALUES (?)`,
      directory,
    );
    console.log(`Applied migration ${directory}`);
  }
}

async function baselineUntrackedLegacyDatabase(migrations: string[]) {
  const tracked = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*) AS "count" FROM "_FinancialCompassMigration"`,
  );
  if (Number(tracked[0]?.count ?? 0) > 0) return;

  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT "name" FROM sqlite_master WHERE "type" = 'table'`,
  );
  const names = new Set(tables.map((row) => row.name));
  if (!names.has("Household")) return;

  let baselineThrough: string | null = null;
  if (names.has("ForecastRule") && names.has("ForecastOccurrence")) {
    baselineThrough = "20260715210000_cash_flow_intelligence";
  } else if (
    names.has("EmergencyFundConfiguration") &&
    names.has("EmergencyFundAccount") &&
    names.has("DecisionScenario")
  ) {
    const categoryColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info('Category')`,
    );
    const columns = new Set(categoryColumns.map((row) => row.name));
    if (columns.has("isSystem") && columns.has("systemKey")) {
      baselineThrough = "20260713103000_default_categories";
    }
  }
  if (!baselineThrough) {
    throw new Error(
      "The existing SQLite schema is untracked and could not be safely baselined. Create a local backup and inspect the schema before migrating.",
    );
  }

  for (const migration of migrations) {
    if (migration > baselineThrough) break;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_FinancialCompassMigration" ("name") VALUES (?)`,
      migration,
    );
  }
  console.log(`Baselined existing schema through ${baselineThrough}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
