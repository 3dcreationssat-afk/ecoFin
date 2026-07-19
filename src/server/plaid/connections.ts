import "server-only";

import { CountryCode, Products, type AccountBase } from "plaid";
import { z } from "zod";
import { bestAccountMatch } from "@/domain/plaid/account-matching";
import { plaidAmountToMinor } from "@/domain/plaid/money";
import { auditChange } from "@/server/data/audit";
import { AppError } from "@/server/data/errors";
import { prisma } from "@/server/db/prisma";
import { plaidClient } from "./client";
import { getPlaidConfiguration, requirePlaidSecrets } from "./config";
import { safePlaidError } from "./errors";
import { decryptPlaidAccessToken, encryptPlaidAccessToken } from "./token-crypto";

const exchangeSchema = z.object({
  publicToken: z.string().trim().min(1).max(4096),
  selectedProviderAccountIds: z.array(z.string().trim().min(1).max(256)).max(100).optional(),
});

const accountMatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("LINK"), localAccountId: z.string().min(1) }),
  z.object({ action: z.literal("CREATE") }),
  z.object({ action: z.literal("IGNORE") }),
]);

export async function plaidConnectionDashboard() {
  const configuration = getPlaidConfiguration();
  const identity = await prisma.workspaceMetadata.findFirst();
  const items = await prisma.plaidItem.findMany({
    include: { accounts: { include: { localAccount: true }, orderBy: { displayName: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    configuration: {
      configured: configuration.configured,
      environment: configuration.environment,
      missing: configuration.missing,
      realConnectionsEnabled: configuration.realConnectionsEnabled,
      localOperation: configuration.webhookUrl ? "WEBHOOK_AND_MANUAL_SYNC" : "MANUAL_SYNC",
    },
    workspaceType: identity?.workspaceType ?? "UNKNOWN",
    canConnect: canUseEnvironment(
      identity?.workspaceType,
      configuration.environment,
      configuration.realConnectionsEnabled,
    ),
    items: items.map((item) => ({
      id: item.id,
      institutionName: item.institutionName ?? "Connected institution",
      environment: item.environment,
      status: item.status,
      lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
      lastSyncErrorCode: item.lastSyncErrorCode,
      lastSyncErrorMessage: item.lastSyncErrorMessage,
      reauthenticationRequired: item.reauthenticationRequired,
      disconnectedAt: item.disconnectedAt,
      accounts: item.accounts.map((account) => ({
        id: account.id,
        displayName: account.displayName,
        officialName: account.officialName,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        currency: account.currency,
        currentBalanceMinor: account.currentBalanceMinor,
        availableBalanceMinor: account.availableBalanceMinor,
        balanceAsOf: account.balanceAsOf,
        selectedForImport: account.selectedForImport,
        matchStatus: account.matchStatus,
        matchConfidence: account.matchConfidence,
        matchEvidence: safeJsonArray(account.matchEvidenceJson),
        localAccount: account.localAccount
          ? {
              id: account.localAccount.id,
              name: account.localAccount.name,
              type: account.localAccount.type,
            }
          : null,
      })),
    })),
  };
}

export async function createPlaidLinkToken(input: { updateItemId?: string } = {}) {
  const { identity, household, configuration } = await plaidContext();
  let providerUser = await prisma.plaidUser.findUnique({
    where: {
      householdId_environment: {
        householdId: household.id,
        environment: configuration.environment,
      },
    },
  });
  if (!providerUser) {
    const response = await plaidClient().userCreate(
      { client_user_id: identity.id, with_upgraded_user: true },
      true,
    );
    providerUser = await prisma.plaidUser.create({
      data: {
        householdId: household.id,
        providerUserId: response.data.user_id,
        environment: configuration.environment,
      },
    });
  }

  const item = input.updateItemId
    ? await prisma.plaidItem.findFirst({
        where: { id: input.updateItemId, householdId: household.id },
      })
    : null;
  if (input.updateItemId && !item) throw new AppError("Connected institution not found.", 404);
  const response = await plaidClient().linkTokenCreate({
    client_name: "Financial Compass",
    language: "en",
    country_codes: [CountryCode.Us],
    user_id: providerUser.providerUserId,
    products: item ? undefined : [Products.Transactions],
    access_token: item?.encryptedAccessToken
      ? decryptPlaidAccessToken(item.encryptedAccessToken)
      : undefined,
    redirect_uri: configuration.redirectUri,
    webhook: configuration.webhookUrl,
    transactions: item ? undefined : { days_requested: 730 },
  });
  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
    updateMode: Boolean(item),
  };
}

export async function exchangePlaidPublicToken(input: unknown) {
  const data = exchangeSchema.parse(input);
  const { household, configuration } = await plaidContext();
  let accessToken: string | undefined;
  try {
    const exchange = await plaidClient().itemPublicTokenExchange({
      public_token: data.publicToken,
    });
    accessToken = exchange.data.access_token;
    const [itemResponse, accountsResponse] = await Promise.all([
      plaidClient().itemGet({ access_token: accessToken }),
      plaidClient().accountsBalanceGet({ access_token: accessToken }),
    ]);
    const providerItem = itemResponse.data.item;
    const institution = providerItem.institution_id
      ? await plaidClient().institutionsGetById({
          institution_id: providerItem.institution_id,
          country_codes: [CountryCode.Us],
        })
      : null;
    const localAccounts = await prisma.account.findMany({
      where: { householdId: household.id, archivedAt: null },
    });
    const selected = new Set(
      data.selectedProviderAccountIds ??
        accountsResponse.data.accounts.map((account) => account.account_id),
    );
    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.plaidItem.create({
        data: {
          householdId: household.id,
          providerItemId: exchange.data.item_id,
          institutionId: providerItem.institution_id,
          institutionName: institution?.data.institution.name,
          encryptedAccessToken: encryptPlaidAccessToken(accessToken!),
          environment: configuration.environment,
          status: "ACTIVE",
        },
      });
      for (const account of accountsResponse.data.accounts) {
        const match = bestAccountMatch(
          {
            displayName: account.name,
            officialName: account.official_name,
            institutionName: institution?.data.institution.name,
            type: String(account.type),
            subtype: account.subtype ? String(account.subtype) : null,
            mask: account.mask,
          },
          localAccounts,
        );
        await tx.plaidAccount.create({
          data: {
            plaidItemId: item.id,
            localAccountId: match?.confidence === "HIGH" ? match.account.id : null,
            providerAccountId: account.account_id,
            persistentAccountId: account.persistent_account_id,
            officialName: account.official_name,
            displayName: account.name,
            mask: account.mask,
            type: String(account.type),
            subtype: account.subtype ? String(account.subtype) : null,
            currency:
              account.balances.iso_currency_code ?? account.balances.unofficial_currency_code,
            currentBalanceMinor: nullablePlaidBalance(account.balances.current),
            availableBalanceMinor: nullablePlaidBalance(account.balances.available),
            limitBalanceMinor: nullablePlaidBalance(account.balances.limit),
            balanceAsOf: new Date(),
            selectedForImport: selected.has(account.account_id),
            matchStatus:
              match?.confidence === "HIGH" ? "AUTO_LINKED" : match ? "PROPOSED" : "UNMATCHED",
            matchConfidence: match?.confidence,
            matchEvidenceJson: match ? JSON.stringify(match.reasons) : null,
          },
        });
      }
      await auditChange(tx, {
        householdId: household.id,
        entityType: "PlaidItem",
        entityId: item.id,
        action: "connect",
        field: "accounts",
        newValue: accountsResponse.data.accounts.length,
        source: "plaid",
      });
      return item;
    });
    return { itemId: created.id, accountCount: accountsResponse.data.accounts.length };
  } catch (error) {
    if (accessToken) {
      try {
        await plaidClient().itemRemove({ access_token: accessToken });
      } catch {
        /* best-effort provider cleanup */
      }
    }
    const safe = safePlaidError(error);
    throw new AppError(`${safe.message} (${safe.code})`, 502);
  }
}

export async function resolvePlaidAccount(plaidAccountId: string, input: unknown) {
  const data = accountMatchSchema.parse(input);
  const account = await prisma.plaidAccount.findUnique({
    where: { id: plaidAccountId },
    include: { item: true },
  });
  if (!account) throw new AppError("Connected account not found.", 404);
  const household = await prisma.household.findUnique({ where: { id: account.item.householdId } });
  if (!household) throw new AppError("Household not found.", 404);
  if (data.action === "IGNORE") {
    return prisma.plaidAccount.update({
      where: { id: account.id },
      data: { selectedForImport: false, matchStatus: "IGNORED", localAccountId: null },
    });
  }
  let localAccountId: string;
  if (data.action === "LINK") {
    const local = await prisma.account.findFirst({
      where: { id: data.localAccountId, householdId: household.id, archivedAt: null },
    });
    if (!local) throw new AppError("Local account is not available for matching.", 422);
    localAccountId = local.id;
  } else {
    const mappedType = (await import("@/domain/plaid/account-matching")).mapPlaidType(
      account.type,
      account.subtype,
    );
    const local = await prisma.account.create({
      data: {
        householdId: household.id,
        name: account.displayName,
        institution: account.item.institutionName ?? "Connected institution",
        type: mappedType,
        reportedBalanceMinor: account.currentBalanceMinor,
        reportedAvailableMinor: account.availableBalanceMinor,
        reportedBalanceAsOf: account.balanceAsOf,
        lastUpdated: new Date(),
        isDemo: false,
      },
    });
    localAccountId = local.id;
  }
  const updated = await prisma.plaidAccount.update({
    where: { id: account.id },
    data: {
      localAccountId,
      matchStatus: data.action === "CREATE" ? "CREATED" : "USER_LINKED",
      matchConfidence: "USER_CONFIRMED",
      selectedForImport: true,
    },
  });
  await auditChange(prisma, {
    householdId: household.id,
    entityType: "PlaidAccount",
    entityId: account.id,
    action: "match",
    field: "localAccountId",
    previousValue: account.localAccountId,
    newValue: localAccountId,
    source: "user",
  });
  return updated;
}

export async function disconnectPlaidItem(itemId: string, input: unknown) {
  const data = z.object({ confirmation: z.literal("DISCONNECT") }).parse(input);
  void data;
  const item = await prisma.plaidItem.findUnique({ where: { id: itemId } });
  if (!item || item.status === "DISCONNECTED")
    throw new AppError("Connected institution is not available.", 404);
  if (!item.encryptedAccessToken)
    throw new AppError("Connected institution token is already removed.", 409);
  try {
    await plaidClient().itemRemove({
      access_token: decryptPlaidAccessToken(item.encryptedAccessToken),
    });
  } catch (error) {
    const safe = safePlaidError(error);
    throw new AppError(`${safe.message} (${safe.code})`, 502);
  }
  await prisma.$transaction(async (tx) => {
    await tx.plaidAccount.updateMany({
      where: { plaidItemId: item.id },
      data: { archivedAt: new Date(), selectedForImport: false },
    });
    await tx.plaidItem.update({
      where: { id: item.id },
      data: {
        encryptedAccessToken: null,
        syncCursor: null,
        syncLockedAt: null,
        status: "DISCONNECTED",
        disconnectedAt: new Date(),
        reauthenticationRequired: false,
      },
    });
    await auditChange(tx, {
      householdId: item.householdId,
      entityType: "PlaidItem",
      entityId: item.id,
      action: "disconnect",
      field: "encryptedAccessToken",
      previousValue: "encrypted token present",
      newValue: "removed",
      source: "user",
    });
  });
  return { disconnected: true, historyPreserved: true, tokenRemoved: true };
}

async function plaidContext() {
  const configuration = requirePlaidSecrets();
  const [identity, household] = await Promise.all([
    prisma.workspaceMetadata.findFirst(),
    prisma.household.findFirst(),
  ]);
  if (!identity || !household) throw new AppError("Workspace identity is incomplete.", 409);
  if (
    !canUseEnvironment(
      identity.workspaceType,
      configuration.environment,
      configuration.realConnectionsEnabled,
    )
  ) {
    throw new AppError(
      configuration.environment === "sandbox"
        ? "Plaid Sandbox is blocked in a REAL workspace. Use an isolated DEMO or TEST database."
        : "Real Plaid connections require a REAL workspace and PLAID_REAL_CONNECTIONS_ENABLED=true.",
      409,
    );
  }
  return { identity, household, configuration };
}

function canUseEnvironment(
  workspaceType: string | undefined,
  environment: string | null,
  realEnabled: boolean,
) {
  if (!workspaceType || !environment) return false;
  if (environment === "sandbox") return workspaceType === "TEST" || workspaceType === "DEMO";
  return workspaceType === "REAL" && realEnabled;
}

function nullablePlaidBalance(value: AccountBase["balances"]["current"] | undefined) {
  return value === null || value === undefined ? null : plaidAmountToMinor(value);
}

function safeJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}
