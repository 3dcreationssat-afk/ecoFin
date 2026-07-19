import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { assertTestDatabase } from "../src/server/db/database-url";

function testTemplateFingerprint() {
  const hash = createHash("sha256");
  const migrationsRoot = resolve(process.cwd(), "prisma", "migrations");
  for (const directory of readdirSync(migrationsRoot).sort()) {
    const migration = join(migrationsRoot, directory, "migration.sql");
    if (!existsSync(migration)) continue;
    hash.update(directory);
    hash.update(readFileSync(migration));
  }
  for (const file of ["schema.prisma", "seed.ts"]) {
    hash.update(file);
    hash.update(readFileSync(resolve(process.cwd(), "prisma", file)));
  }
  return hash.digest("hex");
}

async function main() {
  const configured = assertTestDatabase();
  process.env.DATABASE_URL = configured.url;
  const databasePath = configured.path;

  const templatePath = resolve(process.cwd(), "prisma", "vitest-template.db");
  const fingerprintPath = resolve(process.cwd(), "prisma", "vitest-template.fingerprint");
  const fingerprint = testTemplateFingerprint();

  if (
    databasePath !== templatePath &&
    existsSync(templatePath) &&
    existsSync(fingerprintPath) &&
    readFileSync(fingerprintPath, "utf8") === fingerprint
  ) {
    mkdirSync(dirname(databasePath), { recursive: true });
    rmSync(databasePath, { force: true });
    copyFileSync(templatePath, databasePath);
    console.log(`Reset isolated SQLite database from verified template at ${databasePath}`);
    return;
  }

  if (existsSync(databasePath)) {
    rmSync(databasePath, { force: true });
  }
  mkdirSync(dirname(databasePath), { recursive: true });

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  execSync(`${npmCommand} run db:migrate`, { stdio: "inherit", env: process.env });

  execSync(`${npmCommand} run db:seed`, { stdio: "inherit", env: process.env });

  if (databasePath !== templatePath) {
    copyFileSync(databasePath, templatePath);
    writeFileSync(fingerprintPath, fingerprint, "utf8");
  }

  console.log(`Reset local SQLite database at ${databasePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
