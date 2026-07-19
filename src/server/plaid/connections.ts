import "server-only";

import { CountryCode, Products, type AccountBase } from "plaid";
import { z } from "zod";
import { bestAccountMatch } from "@/domain/plaid/account-matching";
import { plaidAmountToMinor } from "@/domain/plaid/money";
import { auditChange } from "@/server/data/audit";
import { recalculateAccountBalances } from "@/server/data/account-balances";
import { AppError } from "@/server/data/errors";
import { refreshRecurringForTransactions } from "@/server/data/recurring";
import { scanTransferCandidates } from "@/server/data/transfers";
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
  z.object({
    action: z.literal("LINK"),
    localAccountId: z.string().min(1),
    confirmation: z.literal("CONFIRM ACCOUNT MATCH"),
  }),
  z.object({
    action: z.literal("CREATE"),
    confirmation: z.literal("CREATE CONNECTED ACCOUNT"),
    name: z.string().trim().min(1).max(120).optional(),
    institution: z.string().trim().min(1).max(120).optional(),
  }),
  z.object({ action: z.literal("IGNORE") }),
  z.object({ action: z.literal("DEFER") }),
  z.object({ action: z.literal("UNLINK") }),
  z.object({ action: z.literal("DISABLE_SYNC") }),
  z.object({ action: z.literal("ENABLE_SYNC") }),
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
      realConnectionsEnabled: identity?.plaidRealConnectivityEnabled ?? false,
      localOperation: configuration.webhookUrl ? "WEBHOOK_AND_MANUAL_SYNC" : "MANUAL_SYNC",
    },
    workspaceType: identity?.workspaceType ?? "UNKNOWN",
    canConnect: canUseEnvironment(
      identity?.workspaceType,
      configuration.environment,
      identity?.plaidRealConnectivityEnabled ?? false,
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
            localAccountId: null,
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
            matchStatus: match ? "PROPOSED" : "UNMATCHED",
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
  if (
    data.action === "IGNORE" ||
    data.action === "DEFER" ||
    data.action === "UNLINK" ||
    data.action === "DISABLE_SYNC"
  ) {
    const statuses = {
      IGNORE: "IGNORED",
      DEFER: "DEFERRED",
      UNLINK: "UNMATCHED",
      DISABLE_SYNC: "SYNC_DISABLED",
    } as const;
    const clearsMatch = data.action !== "DISABLE_SYNC";
    const updated = await prisma.plaidAccount.update({
      where: { id: account.id },
      data: {
        selectedForImport: false,
        matchStatus: statuses[data.action],
        localAccountId: clearsMatch ? null : account.localAccountId,
      },
    });
    await auditChange(prisma, {
      householdId: account.item.householdId,
      entityType: "PlaidAccount",
      entityId: account.id,
      action: data.action.toLowerCase(),
      field: clearsMatch ? "localAccountId" : "selectedForImport",
      previousValue: account.localAccountId,
      newValue: clearsMatch ? null : false,
      source: "user",
    });
    return updated;
  }
  if (data.action === "ENABLE_SYNC") {
    if (!account.localAccountId)
      throw new AppError("Match this connected account before enabling synchronization.", 422);
    const updated = await prisma.plaidAccount.update({
      where: { id: account.id },
      data: { selectedForImport: true, matchStatus: "USER_LINKED" },
    });
    await auditChange(prisma, {
      householdId: household.id,
      entityType: "PlaidAccount",
      entityId: account.id,
      action: "enable_sync",
      field: "selectedForImport",
      previousValue: account.selectedForImport,
      newValue: true,
      source: "user",
    });
    return updated;
  }
  if (data.action !== "LINK" && data.action !== "CREATE") {
    throw new AppError("Unsupported connected-account decision.", 422);
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
        name: data.name ?? account.officialName ?? account.displayName,
        institution: data.institution ?? account.item.institutionName ?? "Connected institution",
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
  const result = await prisma.$transaction(async (tx) => {
    const transactionIds = (
      await tx.plaidTransactionSource.findMany({
        where: { plaidAccountId: account.id, transactionId: { not: null } },
        select: { transactionId: true },
      })
    ).flatMap((source) => (source.transactionId ? [source.transactionId] : []));
    if (transactionIds.length) {
      await tx.transaction.updateMany({
        where: { id: { in: transactionIds } },
        data: { accountId: localAccountId },
      });
    }
    const updated = await tx.plaidAccount.update({
      where: { id: account.id },
      data: {
        localAccountId,
        matchStatus: data.action === "CREATE" ? "CREATED" : "USER_LINKED",
        matchConfidence: "USER_CONFIRMED",
        selectedForImport: true,
      },
    });
    await auditChange(tx, {
      householdId: household.id,
      entityType: "PlaidAccount",
      entityId: account.id,
      action: account.localAccountId ? "rematch" : "match",
      field: "localAccountId",
      previousValue: account.localAccountId,
      newValue: localAccountId,
      reason: `${transactionIds.length} connected transaction(s) reassigned; classifications and provenance preserved.`,
      source: "user",
    });
    return { updated, transactionIds };
  });
  await recalculateAccountBalances([
    ...new Set([account.localAccountId, localAccountId].filter((id): id is string => Boolean(id))),
  ]);
  if (result.transactionIds.length) {
    await scanTransferCandidates({
      householdId: household.id,
      transactionIds: result.transactionIds,
    });
    await refreshRecurringForTransactions(result.transactionIds);
  }
  return result.updated;
}

export async function plaidAccountMatchPreview(plaidAccountId: string, localAccountId: string) {
  const [connected, local] = await Promise.all([
    prisma.plaidAccount.findUnique({
      where: { id: plaidAccountId },
      include: {
        item: true,
        transactionSources: {
          where: { status: "ACTIVE" },
          select: { postedDate: true, amountMinor: true, transactionId: true },
          orderBy: { postedDate: "asc" },
          take: 10_000,
        },
      },
    }),
    prisma.account.findUnique({
      where: { id: localAccountId },
      include: {
        transactions: {
          select: {
            id: true,
            transactionDate: true,
            postedDate: true,
            amountMinor: true,
            sourceType: true,
          },
          orderBy: { transactionDate: "asc" },
          take: 10_000,
        },
        plaidAccounts: { where: { archivedAt: null }, select: { id: true, displayName: true } },
      },
    }),
  ]);
  if (!connected || !local || connected.item.householdId !== local.householdId)
    throw new AppError("Connected and local accounts are not available for preview.", 404);
  const provider = connected.transactionSources;
  const overlaps = provider.filter((source) =>
    local.transactions.some(
      (transaction) =>
        transaction.amountMinor === source.amountMinor &&
        Math.abs(
          (transaction.postedDate ?? transaction.transactionDate).getTime() -
            source.postedDate.getTime(),
        ) <=
          3 * 86_400_000,
    ),
  ).length;
  const localDates = local.transactions.map((item) => item.postedDate ?? item.transactionDate);
  const providerDates = provider.map((item) => item.postedDate);
  const localCountBySource = Object.fromEntries(
    [...new Set(local.transactions.map((item) => item.sourceType))].map((source) => [
      source,
      local.transactions.filter((item) => item.sourceType === source).length,
    ]),
  );
  const linkedElsewhere = local.plaidAccounts.filter((item) => item.id !== connected.id);
  return {
    connected: {
      id: connected.id,
      institutionName: connected.item.institutionName ?? "Connected institution",
      displayName: connected.displayName,
      officialName: connected.officialName,
      type: connected.type,
      subtype: connected.subtype,
      mask: connected.mask,
      currentBalanceMinor: connected.currentBalanceMinor,
    },
    local: {
      id: local.id,
      name: local.name,
      institution: local.institution,
      type: local.type,
      mask: null,
      ledgerBalanceMinor: local.ledgerBalanceMinor,
      latestTransactionDate: localDates.at(-1) ?? null,
    },
    coverage: {
      localFrom: localDates.at(0) ?? null,
      localTo: localDates.at(-1) ?? null,
      providerFrom: providerDates.at(0) ?? null,
      providerTo: providerDates.at(-1) ?? null,
      localCount: local.transactions.length,
      providerCount: provider.length,
      localCountBySource,
      possibleOverlaps: overlaps,
      possibleUnmatchedProvider: Math.max(0, provider.length - overlaps),
      possibleUnmatchedLocal: Math.max(0, local.transactions.length - overlaps),
    },
    impact: {
      balanceDifferenceMinor:
        connected.currentBalanceMinor == null || local.ledgerBalanceMinor == null
          ? null
          : connected.currentBalanceMinor - local.ledgerBalanceMinor,
      categoriesPreserved: true,
      learnedRulesPreserved: true,
      transferDecisionsPreserved: true,
      recurringDecisionsPreserved: true,
      transactionProvenancePreserved: true,
      existingConnectedAccountWarnings: linkedElsewhere.map((item) => item.displayName),
      authoritativeLedgerRule:
        "Reconciled CSV and Plaid source records retain both provenances while only the authoritative transaction affects the ledger.",
    },
  };
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
      identity.plaidRealConnectivityEnabled,
    )
  ) {
    throw new AppError(
      configuration.environment === "sandbox"
        ? "Plaid Sandbox is blocked in a REAL workspace. Use an isolated DEMO or TEST database."
        : "Real Plaid connections require a REAL workspace and explicit enablement in Settings.",
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
