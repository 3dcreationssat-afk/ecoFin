import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { assertTestDatabase } from "../src/server/db/database-url";

async function main() {
  const configured = assertTestDatabase();
  process.env.DATABASE_URL = configured.url;
  const databasePath = configured.path;

  if (existsSync(databasePath)) {
    rmSync(databasePath, { force: true });
  }
  mkdirSync(dirname(databasePath), { recursive: true });

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  execSync(`${npmCommand} run db:migrate`, { stdio: "inherit", env: process.env });

  execSync(`${npmCommand} run db:seed`, { stdio: "inherit", env: process.env });

  console.log(`Reset local SQLite database at ${databasePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
