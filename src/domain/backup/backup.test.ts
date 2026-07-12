// @vitest-environment node

import AdmZip from "adm-zip";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  assertZipEntryName,
  backupManifestSchema,
  generatedBackupFilename,
  sha256Buffer,
} from "./backup";

describe("backup domain helpers", () => {
  it("generates safe backup filenames and validates manifest shape", () => {
    expect(generatedBackupFilename(new Date("2026-07-11T22:00:00.000Z"))).toBe(
      "financial-compass-backup-20260711T220000Z.zip",
    );
    expect(
      backupManifestSchema.parse({
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        applicationName: "Financial Compass",
        applicationVersion: "0.1.0",
        schemaVersion: "a".repeat(64),
        createdAt: "2026-07-11T22:00:00.000Z",
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
          auditLogs: 1,
        },
        databaseFileSize: 100,
        databaseSha256: "b".repeat(64),
        packageSha256: null,
        sourceEnvironment: "test",
        demonstrationDataPresent: true,
      }).backupFormatVersion,
    ).toBe(1);
  });

  it("rejects unsupported format versions and path traversal entries", () => {
    expect(() =>
      backupManifestSchema.parse({
        backupFormatVersion: 999,
        applicationName: "Financial Compass",
      }),
    ).toThrow();
    expect(() => assertZipEntryName("../database.sqlite")).toThrow(/unsafe/);
    expect(() => assertZipEntryName("script.exe")).toThrow(/unsupported/);
  });

  it("calculates SHA-256 and can create corrupt synthetic archive fixtures in temp", () => {
    const dir = resolve(process.cwd(), "test-results", "backup-unit");
    mkdirSync(dir, { recursive: true });
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from("{bad"));
    const path = join(dir, "corrupt-manifest.zip");
    zip.writeZip(path);
    expect(readFileSync(path).length).toBeGreaterThan(0);
    expect(sha256Buffer(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    rmSync(dir, { recursive: true, force: true });
  });
});
