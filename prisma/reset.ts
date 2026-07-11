import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function sqlitePathFromUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("db:reset only supports local SQLite file: URLs.");
  }

  const rawPath = databaseUrl.replace(/^file:/, "");
  const resolved = resolve(__dirname, rawPath);
  const prismaDir = resolve(__dirname);

  if (!resolved.startsWith(prismaDir)) {
    throw new Error("Refusing to reset a SQLite database outside the prisma directory.");
  }

  return resolved;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  process.env.DATABASE_URL = databaseUrl;
  const databasePath = sqlitePathFromUrl(databaseUrl);

  if (existsSync(databasePath)) {
    rmSync(databasePath, { force: true });
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  execSync(`${npmCommand} run db:migrate`, { stdio: "inherit", env: process.env });

  execSync(`${npmCommand} run db:seed`, { stdio: "inherit", env: process.env });

  console.log(`Reset local SQLite database at ${databasePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
