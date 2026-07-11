import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const prismaCommand =
  process.platform === "win32"
    ? '".\\node_modules\\.bin\\prisma.cmd"'
    : "./node_modules/.bin/prisma";

for (const directory of readdirSync("prisma/migrations").sort()) {
  const migrationFile = join("prisma", "migrations", directory, "migration.sql");
  if (!existsSync(migrationFile)) continue;
  execSync(`${prismaCommand} db execute --schema prisma/schema.prisma --file ${migrationFile}`, {
    stdio: "inherit",
    env: process.env,
  });
}
