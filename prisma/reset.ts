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
  const databasePath = sqlitePathFromUrl(databaseUrl);

  if (existsSync(databasePath)) {
    rmSync(databasePath, { force: true });
  }

  const prismaCommand =
    process.platform === "win32"
      ? '".\\node_modules\\.bin\\prisma.cmd"'
      : "./node_modules/.bin/prisma";
  execSync(
    `${prismaCommand} db execute --schema prisma/schema.prisma --file prisma/migrations/20260711170000_init/migration.sql`,
    { stdio: "inherit", env: process.env },
  );

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  execSync(`${npmCommand} run db:seed`, { stdio: "inherit", env: process.env });

  console.log(`Reset local SQLite database at ${databasePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
