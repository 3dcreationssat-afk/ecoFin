// @vitest-environment node

import AdmZip from "adm-zip";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appVersion,
  activeSqlitePath,
  migrationFingerprint,
  sha256File,
} from "@/domain/backup/backup";

process.env.DATABASE_URL = "file:./vitest-backup.db";

let backup: typeof import("./backup");
let repositories: typeof import("./repositories");
let prismaModule: typeof import("@/server/db/prisma");

describe("backup and restore service", () => {
  beforeAll(async () => {
    rmSync(join(process.cwd(), "backups", "tmp"), { recursive: true, force: true });
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-backup.db" },
    });
    backup = await import("./backup");
    repositories = await import("./repositories");
    prismaModule = await import("@/server/db/prisma");
  }, 120_000);

  afterAll(async () => {
    await prismaModule?.prisma.$disconnect();
  });

  it("creates, validates, records, downloads metadata for, and deletes a backup", async () => {
    const created = await backup.createLocalBackup();
    expect(created.record.status).toBe("READY");
    expect(statSync(created.path).size).toBe(created.record.sizeBytes);
    const validation = await backup.validateBackupPackage(created.path);
    expect(validation.valid).toBe(true);
    expect(validation.manifest.databaseSha256).toHaveLength(64);
    const dashboard = await backup.backupDashboard();
    expect(dashboard.records.some((record) => record.id === created.record.id)).toBe(true);
    const deleted = await backup.deleteBackupRecord(created.record.id, "DELETE BACKUP");
    expect(deleted.status).toBe("DELETED");
  });

  it("previews and restores a valid backup with a mandatory safety backup", async () => {
    await repositories.updateHousehold({
      name: "Before Backup",
      currency: "USD",
      financialMonthStart: 1,
      incomeSchedule: "BI_WEEKLY",
      checkingBufferMinor: 150000,
      emergencyFundTargetMinor: 1500000,
      debtStrategy: "AVALANCHE",
    });
    const created = await backup.createLocalBackup();
    await repositories.updateHousehold({
      name: "After Backup",
      currency: "USD",
      financialMonthStart: 2,
      incomeSchedule: "MONTHLY",
      checkingBufferMinor: 100,
      emergencyFundTargetMinor: 200,
      debtStrategy: "SNOWBALL",
    });
    const buffer = readFileSync(created.path);
    const preview = await backup.restorePreview(buffer);
    expect(preview.validation.compatibility).toBe("SUPPORTED_SAME_SCHEMA");
    const restored = await backup.restoreBackup(buffer, { confirmation: "RESTORE BACKUP" });
    expect(restored.restored).toBe(true);
    expect(restored.safetyBackup.isPreRestore).toBe(true);
    const household = await repositories.getHousehold();
    expect(household.name).toBe("Before Backup");
  });

  it("rejects hash mismatches, newer schemas, and unsafe archive entries", async () => {
    const validDb = readFileSync(activeSqlitePath());
    await expect(
      backup.validateBackupPackage(makeZip(validDb, { databaseSha256: "0".repeat(64) })),
    ).rejects.toThrow(/hash/);
    await expect(
      backup.validateBackupPackage(makeZip(validDb, { schemaVersion: "f".repeat(64) })),
    ).rejects.toThrow(/schema/);
    const incomplete = new AdmZip();
    incomplete.addFile("database.sqlite", Buffer.from("bad"));
    await expect(backup.validateBackupPackage(incomplete.toBuffer())).rejects.toThrow(/manifest/);
  });

  it("rolls back active database when post-restore validation fails", async () => {
    rmSync(join(process.cwd(), "backups", "tmp"), { recursive: true, force: true });
    const before = await repositories.getHousehold();
    const created = await backup.createLocalBackup();
    await repositories.updateHousehold({
      name: "Rollback Sentinel",
      currency: "USD",
      financialMonthStart: 1,
      incomeSchedule: "BI_WEEKLY",
      checkingBufferMinor: 150000,
      emergencyFundTargetMinor: 1500000,
      debtStrategy: "AVALANCHE",
    });
    await expect(
      backup.restoreBackup(readFileSync(created.path), {
        confirmation: "RESTORE BACKUP",
        simulateFailure: true,
      }),
    ).rejects.toThrow(/rollback completed/);
    const after = await repositories.getHousehold();
    expect(after.name).toBe("Rollback Sentinel");
    expect(before.id).toBe(after.id);
    expect(readdirSync(join(process.cwd(), "backups", "tmp")).length).toBe(0);
  });
});

function makeZip(
  database: Buffer,
  overrides: Partial<{
    databaseSha256: string;
    schemaVersion: string;
  }>,
) {
  const manifest = {
    backupFormatVersion: 1,
    applicationName: "Financial Compass",
    applicationVersion: appVersion(),
    schemaVersion: overrides.schemaVersion ?? migrationFingerprint(),
    createdAt: new Date().toISOString(),
    counts: {
      households: 1,
      accounts: 1,
      transactions: 1,
      categories: 1,
      goals: 1,
      importBatches: 0,
      transferMatches: 0,
      recurringExpenses: 0,
      recurringLinks: 0,
      transactionSavedViews: 0,
      auditLogs: 1,
    },
    databaseFileSize: database.length,
    databaseSha256: overrides.databaseSha256 ?? sha256File(activeSqlitePath()),
    packageSha256: null,
    sourceEnvironment: "test",
    demonstrationDataPresent: true,
  };
  const zip = new AdmZip();
  zip.addFile("database.sqlite", database);
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest)));
  return zip.toBuffer();
}
