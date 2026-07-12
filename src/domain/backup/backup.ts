import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";

export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 60 * 1024 * 1024;
export const MAX_EXTRACTED_BYTES = 80 * 1024 * 1024;
export const MAX_ZIP_FILES = 8;
export const REQUIRED_BACKUP_FILES = ["database.sqlite", "manifest.json"] as const;

export const backupManifestSchema = z.object({
  backupFormatVersion: z.literal(BACKUP_FORMAT_VERSION),
  applicationName: z.literal("Financial Compass"),
  applicationVersion: z.string().min(1),
  schemaVersion: z.string().min(12),
  createdAt: z.string().datetime(),
  counts: z.object({
    households: z.number().int().nonnegative(),
    accounts: z.number().int().nonnegative(),
    transactions: z.number().int().nonnegative(),
    categories: z.number().int().nonnegative(),
    goals: z.number().int().nonnegative(),
    importBatches: z.number().int().nonnegative(),
    transferMatches: z.number().int().nonnegative(),
    recurringExpenses: z.number().int().nonnegative(),
    recurringLinks: z.number().int().nonnegative(),
    auditLogs: z.number().int().nonnegative(),
  }),
  databaseFileSize: z.number().int().positive(),
  databaseSha256: z.string().regex(/^[a-f0-9]{64}$/),
  packageSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .optional(),
  sourceEnvironment: z.string().min(1),
  demonstrationDataPresent: z.boolean(),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;

export function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sha256Buffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function backupRoot() {
  const root = resolve(process.cwd(), "backups", "local");
  mkdirSync(root, { recursive: true });
  return root;
}

export function backupTempRoot() {
  const root = resolve(process.cwd(), "backups", "tmp");
  mkdirSync(root, { recursive: true });
  return root;
}

export function generatedBackupFilename(date = new Date()) {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `financial-compass-backup-${stamp}.zip`;
}

export function assertSafeBackupFilename(filename: string) {
  if (
    basename(filename) !== filename ||
    !/^financial-compass-backup-[A-Za-z0-9TZ-]+\.zip$/.test(filename)
  ) {
    throw new Error("Invalid backup filename.");
  }
  return filename;
}

export function resolveBackupPath(filename: string) {
  const safe = assertSafeBackupFilename(filename);
  const root = backupRoot();
  const resolved = resolve(root, safe);
  if (!resolved.startsWith(root)) throw new Error("Backup path escaped backup directory.");
  return resolved;
}

export function activeSqlitePath(databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db") {
  if (!databaseUrl.startsWith("file:"))
    throw new Error("Backups only support local SQLite file: URLs.");
  const raw = databaseUrl.replace(/^file:/, "");
  const prismaDir = resolve(process.cwd(), "prisma");
  const resolved = resolve(prismaDir, raw);
  if (!resolved.startsWith(prismaDir))
    throw new Error("Refusing SQLite database outside prisma directory.");
  return resolved;
}

export function ensureReadableDatabase(path: string) {
  if (!existsSync(path)) throw new Error("SQLite database does not exist.");
  const stat = statSync(path);
  if (!stat.isFile() || stat.size <= 0) throw new Error("SQLite database is not a readable file.");
  const signature = readFileSync(path, { encoding: "utf8", flag: "r" }).slice(0, 16);
  if (signature !== "SQLite format 3\0") throw new Error("File is not a SQLite database.");
  return stat;
}

export function assertZipEntryName(name: string) {
  const normalized = name.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("..\\") ||
    normalized.endsWith("/") ||
    normalized.includes("\0")
  ) {
    throw new Error("Backup archive contains an unsafe entry path.");
  }
  if (!["database.sqlite", "manifest.json", "README.txt"].includes(normalized)) {
    throw new Error(`Backup archive contains unsupported file ${normalized}.`);
  }
  return normalized;
}

export function appVersion() {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

export function migrationFingerprint() {
  const migrationsDir = resolve(process.cwd(), "prisma", "migrations");
  const migrationFiles = [
    "20260711170000_init/migration.sql",
    "20260711190000_phase_1_5_persistence/migration.sql",
    "20260711203000_phase_2a_csv_import/migration.sql",
    "20260711220000_phase_2b_backup_restore/migration.sql",
    "20260711233000_phase_2c_transfer_matching/migration.sql",
    "20260712013000_phase_2d_recurring_expenses/migration.sql",
    "20260712033000_workspace_lifecycle/migration.sql",
  ];
  const hash = createHash("sha256");
  for (const file of migrationFiles) {
    const path = join(migrationsDir, file);
    if (!existsSync(path)) throw new Error(`Missing migration ${file}.`);
    hash.update(file);
    hash.update(readFileSync(path));
  }
  return hash.digest("hex");
}

export function sqliteUrlFromPath(path: string) {
  return `file:${path.replaceAll("\\", "/")}`;
}

export function safeTempDirectory(name: string) {
  const root = backupTempRoot();
  const resolved = resolve(root, name);
  if (!resolved.startsWith(root)) throw new Error("Temporary path escaped backup directory.");
  mkdirSync(dirname(resolved), { recursive: true });
  return resolved;
}
