import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import {
  assertTestDatabase,
  configureDatabaseUrl,
  FINANCIAL_COMPASS_PROJECT_ROOT,
} from "./database-url";

loadEnvConfig(FINANCIAL_COMPASS_PROJECT_ROOT);
configureDatabaseUrl();
if (process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE === "TEST") assertTestDatabase();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
