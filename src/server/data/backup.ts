import AdmZip from "adm-zip";
import { PrismaClient } from "@prisma/client";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  BACKUP_FORMAT_VERSION,
  BackupManifest,
  MAX_BACKUP_BYTES,
  MAX_EXTRACTED_BYTES,
  MAX_ZIP_FILES,
  REQUIRED_BACKUP_FILES,
  activeSqlitePath,
  appVersion,
  assertSafeBackupFilename,
  assertZipEntryName,
  backupManifestSchema,
  backupRoot,
  backupTempRoot,
  ensureReadableDatabase,
  generatedBackupFilename,
  migrationFingerprint,
  resolveBackupPath,
  sha256Buffer,
  sha256File,
  sqliteUrlFromPath,
} from "@/domain/backup/backup";
import { prisma } from "@/server/db/prisma";
import { auditChange } from "./audit";
import { AppError } from "./errors";

type Counts = BackupManifest["counts"];

export async function backupDashboard() {
  const [records, counts] = await Promise.all([
    prisma.backupRecord.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    currentCounts(prisma),
  ]);
  return {
    records,
    counts,
    storageLabel: "Application-controlled local backup directory",
    encryptionStatus: "Backups are not encrypted by the application.",
  };
}

export async function createLocalBackup(options: { preRestore?: boolean; notes?: string } = {}) {
  const dbPath = activeSqlitePath();
  const dbStat = ensureReadableDatabase(dbPath);
  const schemaVersion = migrationFingerprint();
  const version = appVersion();
  const filename = uniqueBackupFilename();
  const outputPath = resolveBackupPath(filename);
  const tempRoot = join(
    backupTempRoot(),
    `create-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  let record:
    | Awaited<ReturnType<typeof prisma.backupRecord.create>>
    | Awaited<ReturnType<typeof prisma.backupRecord.update>>
    | null = null;
  try {
    const household = await prisma.household.findFirst();
    record = await prisma.backupRecord.create({
      data: {
        householdId: household?.id ?? null,
        filename,
        sizeBytes: 0,
        hash: "pending",
        appVersion: version,
        schemaVersion,
        countsJson: "{}",
        status: "CREATING",
        isPreRestore: Boolean(options.preRestore),
        notes: options.notes,
      },
    });
    await auditChange(prisma, {
      householdId: household?.id,
      entityType: "BackupRecord",
      entityId: record.id,
      action: "backup_requested",
      source: "backup",
    });

    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(FULL)");
    const snapshotPath = join(tempRoot, "database.sqlite");
    copyFileSync(dbPath, snapshotPath);
    ensureReadableDatabase(snapshotPath);

    const counts = await countsForDatabase(snapshotPath);
    const databaseHash = sha256File(snapshotPath);
    const manifest: BackupManifest = {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      applicationName: "Financial Compass",
      applicationVersion: version,
      schemaVersion,
      createdAt: new Date().toISOString(),
      counts,
      databaseFileSize: statSync(snapshotPath).size || dbStat.size,
      databaseSha256: databaseHash,
      packageSha256: null,
      sourceEnvironment: process.env.NODE_ENV ?? "local",
      demonstrationDataPresent: await hasDemoData(prisma),
    };

    writeFileSync(join(tempRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
    writeFileSync(
      join(tempRoot, "README.txt"),
      "Financial Compass local backup. Contains sensitive unencrypted SQLite financial data.\n",
    );

    const zip = new AdmZip();
    zip.addFile("database.sqlite", Buffer.from(readFileSync(snapshotPath)));
    zip.addFile("manifest.json", Buffer.from(readFileSync(join(tempRoot, "manifest.json"))));
    zip.addFile("README.txt", Buffer.from(readFileSync(join(tempRoot, "README.txt"))));
    if (zip.getEntries().length !== 3) {
      throw new Error(`Backup archive assembly failed with ${zip.getEntries().length} entries.`);
    }
    const tempZip = join(tempRoot, `${filename}.tmp`);
    const zipBuffer = zip.toBuffer();
    writeFileSync(tempZip, zipBuffer);
    const verified = await validateBackupPackage(zipBuffer);
    copyFileSync(tempZip, outputPath);
    const packageHash = sha256File(outputPath);
    record = await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        sizeBytes: statSync(outputPath).size,
        hash: packageHash,
        countsJson: JSON.stringify(counts),
        status: "READY",
        validationJson: JSON.stringify(verified),
      },
    });
    await auditChange(prisma, {
      householdId: household?.id,
      entityType: "BackupRecord",
      entityId: record.id,
      action: "backup_completed",
      field: "hash",
      newValue: packageHash.slice(0, 12),
      source: "backup",
    });
    return { record, manifest, path: outputPath };
  } catch (error) {
    if (record) {
      await prisma.backupRecord.update({
        where: { id: record.id },
        data: { status: "FAILED", validationJson: JSON.stringify({ error: message(error) }) },
      });
      await auditChange(prisma, {
        householdId: record.householdId,
        entityType: "BackupRecord",
        entityId: record.id,
        action: "backup_failed",
        field: "error",
        newValue: message(error),
        source: "backup",
      });
    }
    throw error;
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function uniqueBackupFilename() {
  const base = generatedBackupFilename().replace(/\.zip$/, "");
  return `${base}-${Math.random().toString(36).slice(2, 8)}.zip`;
}

export async function validateBackupPackage(pathOrBuffer: string | Buffer) {
  const buffer = Buffer.isBuffer(pathOrBuffer) ? pathOrBuffer : readBackupFile(pathOrBuffer);
  if (buffer.length > MAX_BACKUP_BYTES)
    throw new AppError("Backup archive exceeds size limit.", 422);
  const zipReadRoot = join(
    backupTempRoot(),
    `zip-read-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(zipReadRoot, { recursive: true });
  const zipReadPath = join(zipReadRoot, "backup.zip");
  let zip: AdmZip;
  try {
    writeFileSync(zipReadPath, buffer);
    zip = new AdmZip(zipReadPath);
  } catch {
    rmSync(zipReadRoot, { recursive: true, force: true });
    throw new AppError("Backup archive is corrupt or unreadable.", 422);
  }
  try {
    const entries = zip.getEntries();
    if (entries.length > MAX_ZIP_FILES)
      throw new AppError("Backup archive has too many files.", 422);
    const names = new Set<string>();
    let extractedBytes = 0;
    for (const entry of entries) {
      if (entry.isDirectory)
        throw new AppError("Backup archive must not contain directories.", 422);
      const name = assertZipEntryName(entry.entryName);
      if (names.has(name)) throw new AppError("Backup archive contains duplicate entries.", 422);
      names.add(name);
      extractedBytes += entry.header.size;
      if (extractedBytes > MAX_EXTRACTED_BYTES) {
        throw new AppError("Backup archive expands beyond the allowed size.", 422);
      }
    }
    for (const required of REQUIRED_BACKUP_FILES) {
      if (!names.has(required)) {
        throw new AppError(
          `Backup archive is missing ${required}. Found: ${[...names].join(", ") || "none"}.`,
          422,
        );
      }
    }
    const manifestEntry = zip.getEntry("manifest.json");
    const databaseEntry = zip.getEntry("database.sqlite");
    if (!manifestEntry || !databaseEntry) throw new AppError("Backup archive is incomplete.", 422);
    const manifestBuffer = manifestEntry.getData();
    if (!manifestBuffer.length) throw new AppError("Backup manifest could not be read.", 422);
    const manifest = backupManifestSchema.parse(JSON.parse(manifestBuffer.toString("utf8")));
    if (manifest.applicationVersion !== appVersion())
      throw new AppError("Backup app version is unsupported.", 422);
    const currentSchema = migrationFingerprint();
    if (manifest.schemaVersion !== currentSchema) {
      throw new AppError("Backup schema version is unsupported.", 422);
    }
    const databaseBuffer = databaseEntry.getData();
    if (sha256Buffer(databaseBuffer) !== manifest.databaseSha256) {
      throw new AppError("Backup database hash does not match manifest.", 422);
    }
    const tempRoot = join(
      backupTempRoot(),
      `validate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tempRoot, { recursive: true });
    const dbPath = join(tempRoot, "database.sqlite");
    try {
      writeFileSync(dbPath, databaseBuffer);
      ensureReadableDatabase(dbPath);
      const check = await validateDatabaseFile(dbPath);
      return {
        valid: true,
        manifest,
        databaseHashMatches: true,
        integrityCheck: check.integrityCheck,
        counts: check.counts,
        compatibility: "SUPPORTED_SAME_SCHEMA",
        filename: Buffer.isBuffer(pathOrBuffer) ? "uploaded-backup.zip" : basename(pathOrBuffer),
      };
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(zipReadRoot, { recursive: true, force: true });
  }
}

export async function restorePreview(buffer: Buffer) {
  const validation = await validateBackupPackage(buffer);
  const counts = await currentCounts(prisma);
  await auditChange(prisma, {
    entityType: "BackupRestore",
    entityId: "preview",
    action: "restore_validation_started",
    source: "backup",
  });
  return { validation, currentCounts: counts };
}

export async function restoreBackup(
  buffer: Buffer,
  input: { confirmation: string; simulateFailure?: boolean },
) {
  if (input.confirmation !== "RESTORE BACKUP") {
    throw new AppError("Type RESTORE BACKUP to confirm restore.", 422);
  }
  const validation = await validateBackupPackage(buffer);
  const safety = await createLocalBackup({
    preRestore: true,
    notes: "Automatic pre-restore safety backup",
  });
  const activePath = activeSqlitePath();
  const tempRoot = join(
    backupTempRoot(),
    `restore-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const recoveryPath = `${activePath}.pre-restore-${Date.now()}`;
  const restoredPath = join(tempRoot, "database.sqlite");
  try {
    const zip = new AdmZip(buffer);
    const database = zip.getEntry("database.sqlite")?.getData();
    if (!database) throw new AppError("Backup archive is missing database.sqlite.", 422);
    writeFileSync(restoredPath, database);
    await validateDatabaseFile(restoredPath);
    await prisma.$disconnect();
    if (existsSync(activePath)) copyFileSync(activePath, recoveryPath);
    copyFileSync(restoredPath, activePath);
    if (input.simulateFailure) throw new Error("Simulated post-restore failure.");
    await validateDatabaseFile(activePath);
    const restoredPrisma = new PrismaClient();
    try {
      const household = await restoredPrisma.household.findFirst();
      await restoredPrisma.backupRecord.create({
        data: {
          householdId: household?.id ?? null,
          filename: validation.filename,
          sizeBytes: buffer.length,
          hash: sha256Buffer(buffer),
          appVersion: validation.manifest.applicationVersion,
          schemaVersion: validation.manifest.schemaVersion,
          countsJson: JSON.stringify(validation.manifest.counts),
          status: "RESTORED_FROM",
          isRestoreSource: true,
          validationJson: JSON.stringify(validation),
          notes: `Safety backup: ${safety.record.filename}`,
        },
      });
      await restoredPrisma.auditLog.create({
        data: {
          householdId: household?.id ?? null,
          entityType: "BackupRestore",
          entityId: validation.filename,
          action: "restore_completed",
          source: "backup",
          field: "safetyBackup",
          newValue: safety.record.filename,
        },
      });
    } finally {
      await restoredPrisma.$disconnect();
    }
    return { restored: true, validation, safetyBackup: safety.record };
  } catch (error) {
    if (existsSync(recoveryPath)) {
      copyFileSync(recoveryPath, activePath);
      const rollbackPrisma = new PrismaClient();
      try {
        await rollbackPrisma.auditLog.create({
          data: {
            entityType: "BackupRestore",
            entityId: validation.filename,
            action: "automatic_rollback_completed",
            source: "backup",
            field: "error",
            newValue: message(error),
          },
        });
      } finally {
        await rollbackPrisma.$disconnect();
      }
    }
    throw new AppError(`Restore failed and rollback completed: ${message(error)}`, 500);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    rmSync(recoveryPath, { force: true });
  }
}

export async function deleteBackupRecord(id: string, confirmation: string) {
  if (confirmation !== "DELETE BACKUP")
    throw new AppError("Type DELETE BACKUP to confirm deletion.", 422);
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record) throw new AppError("Backup record not found.", 404);
  if (record.status !== "READY")
    throw new AppError("Only ready local backup files can be deleted.", 422);
  const path = resolveBackupPath(record.filename);
  rmSync(path, { force: true });
  const updated = await prisma.backupRecord.update({
    where: { id },
    data: { status: "DELETED", deletedAt: new Date() },
  });
  await auditChange(prisma, {
    householdId: record.householdId,
    entityType: "BackupRecord",
    entityId: id,
    action: "backup_deleted",
    source: "backup",
  });
  return updated;
}

export async function backupDownloadPath(id: string) {
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record || record.status !== "READY") throw new AppError("Backup is not available.", 404);
  const path = resolveBackupPath(record.filename);
  if (!existsSync(path)) throw new AppError("Backup file is missing.", 404);
  await auditChange(prisma, {
    householdId: record.householdId,
    entityType: "BackupRecord",
    entityId: id,
    action: "backup_downloaded",
    source: "backup",
  });
  return { path, record };
}

async function validateDatabaseFile(path: string) {
  ensureReadableDatabase(path);
  const client = new PrismaClient({ datasources: { db: { url: sqliteUrlFromPath(path) } } });
  try {
    const integrity = (await client.$queryRawUnsafe<{ integrity_check: string }[]>(
      "PRAGMA integrity_check",
    )) as { integrity_check: string }[];
    const integrityCheck = integrity[0]?.integrity_check ?? "unknown";
    if (integrityCheck !== "ok") throw new AppError("SQLite integrity check failed.", 422);
    const tables = await client.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    for (const table of [
      "Household",
      "Account",
      "Transaction",
      "Category",
      "Goal",
      "ImportBatch",
      "TransferMatch",
      "RecurringExpense",
      "RecurringExpenseTransaction",
      "TransactionSavedView",
      "MerchantRule",
      "AuditLog",
    ]) {
      if (!tables.some((entry) => entry.name === table))
        throw new AppError(`Backup database missing ${table}.`, 422);
    }
    const counts = await currentCounts(client);
    return { integrityCheck, counts };
  } finally {
    await client.$disconnect();
  }
}

async function countsForDatabase(path: string) {
  return (await validateDatabaseFile(path)).counts;
}

async function currentCounts(client: PrismaClient): Promise<Counts> {
  const [
    households,
    accounts,
    transactions,
    categories,
    goals,
    importBatches,
    transferMatches,
    recurringExpenses,
    recurringLinks,
    transactionSavedViews,
    merchantRules,
    auditLogs,
  ] = await Promise.all([
    client.household.count(),
    client.account.count(),
    client.transaction.count(),
    client.category.count(),
    client.goal.count(),
    client.importBatch.count(),
    client.transferMatch.count(),
    client.recurringExpense.count(),
    client.recurringExpenseTransaction.count(),
    client.transactionSavedView.count(),
    client.merchantRule.count(),
    client.auditLog.count(),
  ]);
  return {
    households,
    accounts,
    transactions,
    categories,
    goals,
    importBatches,
    transferMatches,
    recurringExpenses,
    recurringLinks,
    transactionSavedViews,
    merchantRules,
    auditLogs,
  };
}

async function hasDemoData(client: PrismaClient) {
  const [accounts, transactions] = await Promise.all([
    client.account.count({ where: { isDemo: true } }),
    client.transaction.count({ where: { isDemo: true } }),
  ]);
  return accounts > 0 || transactions > 0;
}

function readBackupFile(path: string) {
  const resolved = resolve(path);
  const root = backupRoot();
  if (!resolved.startsWith(root))
    throw new AppError("Backup file is outside the backup directory.", 422);
  assertSafeBackupFilename(basename(resolved));
  return Buffer.from(readFileSync(resolved));
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
