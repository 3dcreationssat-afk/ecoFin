import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const FILE_PREFIX = "file:";
const configuredProjectRoot = process.env.FINANCIAL_COMPASS_PROJECT_ROOT ?? process.env.INIT_CWD;
if (!configuredProjectRoot) {
  throw new Error(
    "FINANCIAL_COMPASS_PROJECT_ROOT or npm INIT_CWD is required for deterministic database paths.",
  );
}
export const FINANCIAL_COMPASS_PROJECT_ROOT = resolve(configuredProjectRoot);

export type WorkspaceType = "REAL" | "DEMO" | "TEST";

export function canonicalDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Financial Compass will not create or fall back to a demo database.",
    );
  }
  if (!databaseUrl.startsWith(FILE_PREFIX)) {
    throw new Error("Financial Compass requires a local SQLite file: DATABASE_URL.");
  }

  const [rawPath, query] = databaseUrl.slice(FILE_PREFIX.length).split("?", 2);
  if (!rawPath) throw new Error("DATABASE_URL does not contain a SQLite path.");
  const decodedPath = decodeURIComponent(rawPath);
  const absolutePath = isAbsolute(decodedPath)
    ? resolve(decodedPath)
    : resolve(FINANCIAL_COMPASS_PROJECT_ROOT, "prisma", decodedPath);
  const normalizedPath = absolutePath.replaceAll("\\", "/");
  return {
    url: `${FILE_PREFIX}${normalizedPath}${query ? `?${query}` : ""}`,
    path: absolutePath,
    wasRelative: !isAbsolute(decodedPath),
  };
}

export function configureDatabaseUrl() {
  const configured = canonicalDatabaseUrl();
  process.env.DATABASE_URL = configured.url;
  return configured;
}

export function assertDatabaseExists(path: string) {
  if (!existsSync(path)) {
    throw new Error(
      `Configured Financial Compass database does not exist: ${path}. Startup stopped without creating or seeding a replacement.`,
    );
  }
}

export function assertTestDatabase(databaseUrl = process.env.DATABASE_URL) {
  const configured = canonicalDatabaseUrl(databaseUrl);
  const workspaceType = process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE;
  const normalized = configured.path.toLowerCase();
  const looksIsolated =
    normalized.includes(
      `${resolve(FINANCIAL_COMPASS_PROJECT_ROOT, "test-results").toLowerCase()}\\`,
    ) || /(^|[\\/])vitest-[^\\/]+\.db$/.test(normalized);
  if (workspaceType !== "TEST" || !looksIsolated) {
    throw new Error(
      `Refusing test database operation outside an isolated TEST workspace: ${configured.path}`,
    );
  }
  const realPath = process.env.FINANCIAL_COMPASS_REAL_DATABASE_PATH;
  if (realPath && resolve(realPath).toLowerCase() === normalized) {
    throw new Error("Refusing to run tests against the configured real database.");
  }
  return configured;
}
