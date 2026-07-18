import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertTestDatabase, canonicalDatabaseUrl } from "./database-url";

const originalCwd = process.cwd();
const originalType = process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE;
const originalRealPath = process.env.FINANCIAL_COMPASS_REAL_DATABASE_PATH;

afterEach(() => {
  process.chdir(originalCwd);
  process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE = originalType;
  process.env.FINANCIAL_COMPASS_REAL_DATABASE_PATH = originalRealPath;
});

describe("database identity path safety", () => {
  it("fails clearly when no database is configured", () => {
    expect(() => canonicalDatabaseUrl(undefined)).toThrow(/DATABASE_URL is required/);
  });

  it("resolves a relative Prisma URL independently of the shell working directory", () => {
    const before = canonicalDatabaseUrl("file:./vitest-path.db");
    process.chdir(resolve(originalCwd, "src"));
    const after = canonicalDatabaseUrl("file:./vitest-path.db");
    expect(after.path).toBe(before.path);
    expect(after.url).toBe(before.url);
  });

  it("refuses test operations against the configured real database", () => {
    const realPath = resolve(originalCwd, "test-results", "real.sqlite");
    process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE = "TEST";
    process.env.FINANCIAL_COMPASS_REAL_DATABASE_PATH = realPath;
    expect(() => assertTestDatabase(`file:${realPath.replaceAll("\\", "/")}`)).toThrow(
      /real database/,
    );
  });

  it("refuses a test path unless the TEST execution guard is explicit", () => {
    process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE = "REAL";
    expect(() => assertTestDatabase("file:./vitest-path.db")).toThrow(/isolated TEST/);
  });
});
