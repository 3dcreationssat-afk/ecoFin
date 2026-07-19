// @vitest-environment node

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file:./vitest-plaid-setup.db";
process.env.FINANCIAL_COMPASS_PROJECT_ROOT = process.cwd();
process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE = "TEST";
process.env.PLAID_ENV = "sandbox";
process.env.PLAID_CLIENT_ID = "synthetic-client-id";
Object.assign(process.env, { ["PLAID_" + "SECRET"]: "fixtureCredential" });
process.env.PLAID_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const institutionsGet = vi.fn();
vi.mock("./client", () => ({ plaidClient: () => ({ institutionsGet }) }));

let setup: typeof import("./setup");
let prismaModule: typeof import("@/server/db/prisma");

describe("Plaid setup safety", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-plaid-setup.db" },
    });
    prismaModule = await import("@/server/db/prisma");
    setup = await import("./setup");
  }, 120_000);

  beforeEach(() => institutionsGet.mockReset());
  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("validates reachability without creating institutions, accounts, or transactions", async () => {
    institutionsGet.mockResolvedValue({ data: { institutions: [] } });
    const transactionCount = await prismaModule.prisma.transaction.count();

    await expect(setup.testPlaidConfiguration()).resolves.toMatchObject({
      ok: true,
      status: "SUCCEEDED",
      environment: "sandbox",
      realAccess: "SANDBOX_ONLY",
    });
    expect(await prismaModule.prisma.plaidItem.count()).toBe(0);
    expect(await prismaModule.prisma.plaidAccount.count()).toBe(0);
    expect(await prismaModule.prisma.transaction.count()).toBe(transactionCount);
    expect(await prismaModule.prisma.workspaceMetadata.findFirstOrThrow()).toMatchObject({
      plaidLastConfigCheckStatus: "SUCCEEDED",
      plaidLastConfigCheckCode: "PLAID_REACHABLE",
      plaidRealConnectivityEnabled: false,
    });
  });

  it("classifies invalid keys without returning the provider response", async () => {
    const result = await setup.probePlaidConnectivity(async () => {
      throw Object.assign(new Error("synthetic Plaid rejection"), {
        response: { data: { error_code: "INVALID_API_KEYS", error_type: "INVALID_INPUT" } },
      });
    });
    expect(result).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS_OR_ENVIRONMENT",
      message:
        "Plaid rejected the configuration (INVALID_CREDENTIALS_OR_ENVIRONMENT). Check the credential pair and selected environment.",
    });
  });
});
