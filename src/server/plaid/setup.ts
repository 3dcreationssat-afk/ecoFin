import "server-only";

import { CountryCode } from "plaid";
import { z } from "zod";
import { auditChange } from "@/server/data/audit";
import { AppError } from "@/server/data/errors";
import { prisma } from "@/server/db/prisma";
import { plaidClient } from "./client";
import { getPlaidConfiguration } from "./config";
import { safePlaidError } from "./errors";
import { validatePlaidTokenEncryption } from "./token-crypto";

const gateSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    dashboardRealAccessConfirmed: z.literal(true),
    confirmation: z.literal("ENABLE REAL PLAID"),
  }),
]);

export async function plaidSetupDashboard() {
  const configuration = getPlaidConfiguration();
  const [identity, household, institutionCount, accountCount, lastSync, activeErrors] =
    await Promise.all([
      prisma.workspaceMetadata.findFirst(),
      prisma.household.findFirst({ select: { id: true } }),
      prisma.plaidItem.count({ where: { status: { not: "DISCONNECTED" } } }),
      prisma.plaidAccount.count({
        where: { archivedAt: null, item: { status: { not: "DISCONNECTED" } } },
      }),
      prisma.plaidSyncRun.findFirst({
        where: { status: "SUCCEEDED" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
      prisma.plaidItem.findMany({
        where: {
          status: { not: "DISCONNECTED" },
          OR: [{ lastSyncErrorCode: { not: null } }, { reauthenticationRequired: true }],
        },
        select: {
          id: true,
          institutionName: true,
          lastSyncErrorCode: true,
          reauthenticationRequired: true,
        },
      }),
    ]);

  const encryption = encryptionStatus(configuration.configured);
  const realEnabled = identity?.plaidRealConnectivityEnabled ?? false;
  return {
    integrationStatus: integrationStatus({
      configured: configuration.configured,
      environment: configuration.environment,
      encryptionValid: encryption.valid,
      lastCheckStatus: identity?.plaidLastConfigCheckStatus,
      realAccessConfirmed: identity?.plaidRealAccessConfirmed ?? false,
      realEnabled,
    }),
    configured: configuration.configured,
    environment: configuration.environment,
    missing: configuration.missing,
    variables: {
      clientId: Boolean(process.env.PLAID_CLIENT_ID?.trim()),
      secret: Boolean(process.env.PLAID_SECRET?.trim()),
      environment: Boolean(configuration.environment),
      encryptionKey: Boolean(process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim()),
      redirectUri: Boolean(configuration.redirectUri),
      webhookUrl: Boolean(configuration.webhookUrl),
    },
    encryption,
    workspaceType: identity?.workspaceType ?? "UNKNOWN",
    realAccess:
      configuration.environment === "sandbox"
        ? "SANDBOX_ONLY"
        : identity?.plaidRealAccessConfirmed
          ? "USER_CONFIRMED"
          : "DASHBOARD_CONFIRMATION_REQUIRED",
    realConnectivityEnabled: realEnabled,
    lastConnectivityCheck: identity?.plaidLastConfigCheckAt ?? null,
    connectivityStatus: identity?.plaidLastConfigCheckStatus ?? "NOT_TESTED",
    connectivityCode: identity?.plaidLastConfigCheckCode ?? null,
    connectedInstitutionCount: institutionCount,
    connectedAccountCount: accountCount,
    lastSuccessfulSync: lastSync?.completedAt ?? null,
    localOperation: configuration.webhookUrl ? "WEBHOOK_AND_MANUAL_SYNC" : "MANUAL_SYNC",
    activeErrors: activeErrors.map((item) => ({
      itemId: item.id,
      institutionName: item.institutionName ?? "Connected institution",
      code: item.reauthenticationRequired ? "REAUTHENTICATION_REQUIRED" : item.lastSyncErrorCode,
    })),
    householdPresent: Boolean(household),
  };
}

export async function testPlaidConfiguration() {
  const configuration = getPlaidConfiguration();
  if (!configuration.configured) {
    throw new AppError(
      `Plaid configuration is incomplete: ${configuration.missing.join(", ")}.`,
      409,
    );
  }
  const encryption = encryptionStatus(true);
  if (!encryption.valid) throw new AppError(encryption.message, 409);

  const probe = await probePlaidConnectivity(() =>
    plaidClient().institutionsGet({
      count: 1,
      offset: 0,
      country_codes: [CountryCode.Us],
    }),
  );
  if (probe.ok) {
    await recordConnectivityCheck("SUCCEEDED", "PLAID_REACHABLE");
    return {
      ok: true,
      status: "SUCCEEDED",
      code: "PLAID_REACHABLE",
      message:
        "Credentials were accepted and Plaid is reachable. No institution was connected and no financial data changed.",
      environment: configuration.environment,
      realAccess:
        configuration.environment === "sandbox" ? "SANDBOX_ONLY" : "VERIFY_IN_PLAID_DASHBOARD",
    };
  }
  await recordConnectivityCheck("FAILED", probe.code);
  throw new AppError(probe.message, 502);
}

export async function probePlaidConnectivity(request: () => Promise<unknown>) {
  try {
    await request();
    return { ok: true as const, code: "PLAID_REACHABLE" };
  } catch (error) {
    const safe = safePlaidError(error);
    const hasPlaidResponse = Boolean((error as { response?: unknown })?.response);
    const code = hasPlaidResponse
      ? safe.code === "INVALID_API_KEYS"
        ? "INVALID_CREDENTIALS_OR_ENVIRONMENT"
        : safe.code
      : "NETWORK_FAILURE";
    return {
      ok: false as const,
      code,
      message: hasPlaidResponse
        ? `Plaid rejected the configuration (${code}). Check the credential pair and selected environment.`
        : "Plaid could not be reached. Check the network connection and try again.",
    };
  }
}

export async function setPlaidRealConnectivity(input: unknown) {
  const data = gateSchema.parse(input);
  const identity = await prisma.workspaceMetadata.findFirst();
  const household = await prisma.household.findFirst({ select: { id: true } });
  if (!identity) throw new AppError("Workspace identity is incomplete.", 409);

  if (data.enabled) {
    const configuration = getPlaidConfiguration();
    const encryption = encryptionStatus(configuration.configured);
    if (identity.workspaceType !== "REAL") {
      throw new AppError("Real Plaid connectivity can only be enabled in a REAL workspace.", 409);
    }
    if (configuration.environment !== "production") {
      throw new AppError("Set PLAID_ENV=production before enabling real connectivity.", 409);
    }
    if (!configuration.configured || !encryption.valid) {
      throw new AppError("Plaid credentials and token encryption must be valid first.", 409);
    }
    if (identity.plaidLastConfigCheckStatus !== "SUCCEEDED") {
      throw new AppError(
        "Run Test Plaid configuration successfully before enabling real connectivity.",
        409,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMetadata.update({
      where: { id: identity.id },
      data: {
        plaidRealAccessConfirmed: data.enabled,
        plaidRealConnectivityEnabled: data.enabled,
      },
    });
    await auditChange(tx, {
      householdId: household?.id,
      entityType: "WorkspaceMetadata",
      entityId: identity.id,
      action: data.enabled ? "enable_real_plaid" : "disable_real_plaid",
      field: "plaidRealConnectivityEnabled",
      previousValue: identity.plaidRealConnectivityEnabled,
      newValue: data.enabled,
      reason: data.enabled ? "User confirmed real-data access in the Plaid Dashboard." : undefined,
      source: "user",
    });
  });
  return { enabled: data.enabled };
}

function encryptionStatus(configured: boolean) {
  if (!process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim()) {
    return { valid: false, status: "MISSING", message: "Token encryption key is missing." };
  }
  try {
    const valid = validatePlaidTokenEncryption();
    return {
      valid,
      status: valid ? "VALID" : "INVALID",
      message: valid ? "Token encryption is valid." : "Token encryption validation failed.",
    };
  } catch {
    return {
      valid: false,
      status: "INVALID",
      message: configured
        ? "Token encryption key must be a base64-encoded 32-byte key."
        : "Token encryption configuration is invalid.",
    };
  }
}

function integrationStatus(input: {
  configured: boolean;
  environment: string | null;
  encryptionValid: boolean;
  lastCheckStatus?: string | null;
  realAccessConfirmed: boolean;
  realEnabled: boolean;
}) {
  if (!input.configured) return "CREDENTIALS_MISSING";
  if (!input.encryptionValid) return "ENCRYPTION_INVALID";
  if (input.lastCheckStatus === "FAILED") return "CREDENTIALS_INVALID_OR_UNREACHABLE";
  if (input.environment === "sandbox") return "SANDBOX_ONLY";
  if (input.lastCheckStatus !== "SUCCEEDED") return "CONFIGURATION_NOT_TESTED";
  if (!input.realAccessConfirmed) return "REAL_ACCESS_CONFIRMATION_REQUIRED";
  return input.realEnabled ? "REAL_CONNECTIVITY_ENABLED" : "READY_FOR_REAL_CONNECTION";
}

async function recordConnectivityCheck(status: "SUCCEEDED" | "FAILED", code: string) {
  const identity = await prisma.workspaceMetadata.findFirst();
  if (!identity) throw new AppError("Workspace identity is incomplete.", 409);
  await prisma.workspaceMetadata.update({
    where: { id: identity.id },
    data: {
      plaidLastConfigCheckAt: new Date(),
      plaidLastConfigCheckStatus: status,
      plaidLastConfigCheckCode: code,
      ...(status === "FAILED"
        ? { plaidRealConnectivityEnabled: false, plaidRealAccessConfirmed: false }
        : {}),
    },
  });
}
