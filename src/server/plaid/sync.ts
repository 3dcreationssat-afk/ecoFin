import "server-only";

import type { Prisma } from "@prisma/client";
import type { AccountBase, Transaction as PlaidTransaction } from "plaid";
import { interpretProviderTransaction } from "@/domain/transactions/interpretation";
import { normalizeRuleText } from "@/domain/merchant-rules/rules";
import { plaidAmountToMinor } from "@/domain/plaid/money";
import { recalculateAccountBalances } from "@/server/data/account-balances";
import { auditChange, auditFields } from "@/server/data/audit";
import { AppError } from "@/server/data/errors";
import { applyRulesToTransaction } from "@/server/data/merchant-rules";
import { refreshForecastIntelligence } from "@/server/data/forecast-rules";
import { scanRecurringExpenses } from "@/server/data/recurring";
import { scanTransferCandidates } from "@/server/data/transfers";
import { prisma } from "@/server/db/prisma";
import { plaidClient } from "./client";
import { safePlaidError } from "./errors";
import { decryptPlaidAccessToken } from "./token-crypto";

const LOCK_MINUTES = 15;
const MAX_SYNC_PAGES = 100;

export async function syncPlaidItem(itemId: string, trigger = "USER") {
  const item = await prisma.plaidItem.findUnique({
    where: { id: itemId },
    include: { accounts: true },
  });
  if (!item || item.status === "DISCONNECTED")
    throw new AppError("Connected institution is not available.", 404);
  const staleBefore = new Date(Date.now() - LOCK_MINUTES * 60_000);
  const locked = await prisma.plaidItem.updateMany({
    where: { id: item.id, OR: [{ syncLockedAt: null }, { syncLockedAt: { lt: staleBefore } }] },
    data: {
      syncLockedAt: new Date(),
      lastSyncStartedAt: new Date(),
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null,
    },
  });
  if (locked.count !== 1)
    throw new AppError("A synchronization is already running for this institution.", 409);
  const run = await prisma.plaidSyncRun.create({
    data: { plaidItemId: item.id, status: "RUNNING", trigger, cursorBefore: item.syncCursor },
  });

  try {
    if (!item.encryptedAccessToken)
      throw new AppError("Connected institution token is unavailable.", 409);
    const accessToken = decryptPlaidAccessToken(item.encryptedAccessToken);
    const { cursor, added, modified, removed, pageCount } = await fetchTransactionChanges(
      accessToken,
      item.syncCursor ?? undefined,
    );
    const balances = await plaidClient().accountsBalanceGet({ access_token: accessToken });
    const result = await applyPlaidUpdates({
      itemId: item.id,
      cursor: cursor ?? null,
      added,
      modified,
      removed,
      accounts: balances.data.accounts,
    });
    await prisma.plaidSyncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        cursorAfter: cursor,
        addedCount: added.length,
        modifiedCount: modified.length,
        removedCount: removed.length,
        pageCount,
        completedAt: new Date(),
      },
    });
    await prisma.plaidItem.update({
      where: { id: item.id },
      data: {
        syncLockedAt: null,
        syncCursor: cursor,
        lastSuccessfulSyncAt: new Date(),
        status: "ACTIVE",
        reauthenticationRequired: false,
      },
    });
    await refreshPostSyncIntelligence(item.householdId, result.changedTransactionIds);
    return {
      ...result,
      added: added.length,
      modified: modified.length,
      removed: removed.length,
      pageCount,
    };
  } catch (error) {
    const safe = safePlaidError(error);
    const reauthenticationRequired = [
      "ITEM_LOGIN_REQUIRED",
      "ITEM_LOCKED",
      "ITEM_NOT_SUPPORTED",
    ].includes(safe.code);
    await Promise.all([
      prisma.plaidSyncRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorCode: safe.code,
          errorMessage: safe.message,
          completedAt: new Date(),
        },
      }),
      prisma.plaidItem.update({
        where: { id: item.id },
        data: {
          syncLockedAt: null,
          status: reauthenticationRequired ? "REAUTHENTICATION_REQUIRED" : "ERROR",
          reauthenticationRequired,
          lastSyncErrorCode: safe.code,
          lastSyncErrorMessage: safe.message,
        },
      }),
    ]);
    throw new AppError(`${safe.message} (${safe.code})`, 502);
  }
}

async function fetchTransactionChanges(accessToken: string, startingCursor?: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let cursor = startingCursor;
    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: string[] = [];
    let pageCount = 0;
    let hasMore = true;
    try {
      while (hasMore) {
        if (++pageCount > MAX_SYNC_PAGES)
          throw new Error("Plaid synchronization exceeded the safe page limit.");
        const response = await plaidClient().transactionsSync({
          access_token: accessToken,
          cursor,
        });
        added.push(...response.data.added);
        modified.push(...response.data.modified);
        removed.push(...response.data.removed.map((entry) => entry.transaction_id));
        cursor = response.data.next_cursor;
        hasMore = response.data.has_more;
      }
      return { cursor, added, modified, removed, pageCount };
    } catch (error) {
      if (
        attempt === 0 &&
        safePlaidError(error).code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Plaid synchronization could not obtain a stable page set.");
}

export async function applyPlaidUpdates(input: {
  itemId: string;
  cursor: string | null;
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: string[];
  accounts?: AccountBase[];
}) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.plaidItem.findUnique({
      where: { id: input.itemId },
      include: { accounts: { include: { localAccount: true } } },
    });
    if (!item) throw new AppError("Connected institution not found.", 404);
    const accountByProviderId = new Map(
      item.accounts.map((account) => [account.providerAccountId, account]),
    );
    const rules = await tx.merchantRule.findMany({
      where: { householdId: item.householdId, active: true, archivedAt: null },
    });
    const changedTransactionIds: string[] = [];
    let createdLedger = 0;
    let reconciledLedger = 0;
    let unmapped = 0;

    for (const providerAccount of input.accounts ?? []) {
      const connectedAccount = accountByProviderId.get(providerAccount.account_id);
      if (!connectedAccount) continue;
      const balanceAsOf = new Date();
      const currentBalanceMinor = nullablePlaidBalance(providerAccount.balances.current);
      const availableBalanceMinor = nullablePlaidBalance(providerAccount.balances.available);
      await tx.plaidAccount.update({
        where: { id: connectedAccount.id },
        data: {
          currency:
            providerAccount.balances.iso_currency_code ??
            providerAccount.balances.unofficial_currency_code,
          currentBalanceMinor,
          availableBalanceMinor,
          limitBalanceMinor: nullablePlaidBalance(providerAccount.balances.limit),
          balanceAsOf,
        },
      });
      if (connectedAccount.localAccount) {
        const before = connectedAccount.localAccount;
        const after = await tx.account.update({
          where: { id: before.id },
          data: {
            reportedBalanceMinor: currentBalanceMinor,
            reportedAvailableMinor: availableBalanceMinor,
            reportedBalanceAsOf: balanceAsOf,
            lastUpdated: balanceAsOf,
          },
        });
        await auditFields(tx, {
          householdId: item.householdId,
          entityType: "Account",
          entityId: before.id,
          action: "plaid_balance_refresh",
          before,
          after,
          fields: ["reportedBalanceMinor", "reportedAvailableMinor", "reportedBalanceAsOf"],
          source: "plaid",
        });
      }
    }

    for (const provider of [...input.added, ...input.modified]) {
      const connectedAccount = accountByProviderId.get(provider.account_id);
      if (!connectedAccount)
        throw new AppError("Plaid returned a transaction for an unknown connected account.", 409);
      const amountMinor = -plaidAmountToMinor(provider.amount);
      const normalizedMerchant = normalizeMerchant(provider.merchant_name ?? provider.name);
      const interpretation = interpretProviderTransaction({
        amountMinor,
        accountType: connectedAccount.localAccount?.type ?? "OTHER",
        name: provider.name,
        merchantName: provider.merchant_name,
        providerCategoryPrimary: provider.personal_finance_category?.primary,
        providerCategoryDetailed: provider.personal_finance_category?.detailed,
        providerTransactionCode: provider.transaction_code,
      });
      const existingSource = await tx.plaidTransactionSource.findUnique({
        where: { providerTransactionId: provider.transaction_id },
        include: { transaction: true },
      });
      if (existingSource) {
        await updateExistingProviderTransaction(
          tx,
          existingSource,
          provider,
          amountMinor,
          normalizedMerchant,
          interpretation,
        );
        if (existingSource.transactionId) changedTransactionIds.push(existingSource.transactionId);
        continue;
      }

      let transactionId: string | null = null;
      let ledgerDisposition = "UNMAPPED";
      let evidence: string[] = [];
      if (provider.pending_transaction_id) {
        const pendingSource = await tx.plaidTransactionSource.findUnique({
          where: { providerTransactionId: provider.pending_transaction_id },
        });
        if (pendingSource?.transactionId) {
          transactionId = pendingSource.transactionId;
          ledgerDisposition = "PENDING_TO_POSTED";
          evidence = ["Plaid supplied an explicit pending-to-posted transaction relationship."];
          await tx.plaidTransactionSource.update({
            where: { id: pendingSource.id },
            data: {
              transactionId: null,
              status: "SUPERSEDED",
              ledgerDisposition: "SUPERSEDED_BY_POSTED",
            },
          });
        }
      }
      if (!transactionId && connectedAccount.localAccountId) {
        const overlap = await findCsvOverlap(
          tx,
          connectedAccount.localAccountId,
          amountMinor,
          provider.date,
          normalizedMerchant,
        );
        if (overlap) {
          transactionId = overlap.id;
          ledgerDisposition = "RECONCILED_CSV";
          evidence = [
            "Same local account.",
            "Exact minor-unit amount.",
            "Normalized merchant agrees.",
            "Posted dates are within two days.",
            "Only one candidate matched.",
          ];
          reconciledLedger++;
        }
      }
      if (!transactionId && connectedAccount.localAccountId) {
        const transaction = await tx.transaction.create({
          data: {
            householdId: item.householdId,
            accountId: connectedAccount.localAccountId,
            sourceType: "BANK_CONNECTION",
            sourceAccountName: connectedAccount.displayName,
            originalDescription: provider.name,
            originalAmountText: String(provider.amount),
            originalDateText: provider.date,
            normalizedMerchant,
            amountMinor,
            transactionDate: providerDate(provider.authorized_date ?? provider.date),
            postedDate: providerDate(provider.date),
            type: interpretation.transactionType,
            reviewStatus: interpretation.reviewRequired ? "NEEDS_REVIEW" : "REVIEWED",
            affectsIncomeSpendingReports: interpretation.affectsIncomeSpendingReports,
            clearingStatus: provider.pending ? "PENDING" : "CLEARED",
            merchantSource: provider.merchant_name ? "PLAID" : "IMPORT_DEFAULT",
            categorySource: "PLAID",
            typeSource: "PLAID",
            reviewSource: "PLAID_POLICY",
            interpretationType: interpretation.classification,
            interpretationConfidence: interpretation.confidence,
            interpretationReason: interpretation.reason,
            interpretationEvidenceJson: JSON.stringify(interpretation.evidence),
            interpretationAutoApplied: interpretation.automaticallyApplied,
            interpretationReviewRequired: interpretation.reviewRequired,
            isDemo: item.environment === "sandbox",
          },
        });
        const ruled = await applyRulesToTransaction(tx, transaction, rules);
        transactionId = ruled.transaction.id;
        ledgerDisposition = "CREATED";
        createdLedger++;
      }
      if (!transactionId) unmapped++;
      await tx.plaidTransactionSource.create({
        data: providerSourceData(
          connectedAccount.id,
          provider,
          transactionId,
          amountMinor,
          ledgerDisposition,
          evidence,
        ),
      });
      if (transactionId) {
        changedTransactionIds.push(transactionId);
        await auditChange(tx, {
          householdId: item.householdId,
          entityType: "Transaction",
          entityId: transactionId,
          action: ledgerDisposition === "RECONCILED_CSV" ? "plaid_reconcile" : "plaid_sync_add",
          field: "providerTransactionId",
          newValue: provider.transaction_id,
          reason: evidence.join(" ") || undefined,
          source: "plaid",
        });
      }
    }

    for (const providerTransactionId of input.removed) {
      const source = await tx.plaidTransactionSource.findUnique({
        where: { providerTransactionId },
        include: { transaction: true },
      });
      if (!source || source.status === "REMOVED") continue;
      await tx.plaidTransactionSource.update({
        where: { id: source.id },
        data: { status: "REMOVED", removedAt: new Date(), ledgerDisposition: "REMOVED" },
      });
      if (source.transaction?.sourceType === "BANK_CONNECTION") {
        const updated = await tx.transaction.update({
          where: { id: source.transaction.id },
          data: {
            affectsLedger: false,
            affectsIncomeSpendingReports: false,
            excluded: true,
            reviewStatus: "FLAGGED",
            notes:
              source.transaction.notes ??
              "Removed by the connected institution; retained for audit.",
          },
        });
        changedTransactionIds.push(updated.id);
        await auditChange(tx, {
          householdId: item.householdId,
          entityType: "Transaction",
          entityId: updated.id,
          action: "plaid_sync_remove",
          field: "affectsLedger",
          previousValue: true,
          newValue: false,
          source: "plaid",
        });
      }
    }
    const accountIds = [
      ...new Set(
        item.accounts
          .map((account) => account.localAccountId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (accountIds.length) await recalculateAccountBalances(accountIds, tx);
    await tx.plaidItem.update({ where: { id: item.id }, data: { syncCursor: input.cursor } });
    return {
      changedTransactionIds: [...new Set(changedTransactionIds)],
      createdLedger,
      reconciledLedger,
      unmapped,
    };
  });
}

async function updateExistingProviderTransaction(
  tx: Prisma.TransactionClient,
  source: Prisma.PlaidTransactionSourceGetPayload<{ include: { transaction: true } }>,
  provider: PlaidTransaction,
  amountMinor: number,
  normalizedMerchant: string,
  interpretation: ReturnType<typeof interpretProviderTransaction>,
) {
  await tx.plaidTransactionSource.update({
    where: { id: source.id },
    data: {
      ...providerSourceData(
        source.plaidAccountId,
        provider,
        source.transactionId,
        amountMinor,
        source.ledgerDisposition,
        [],
      ),
      providerModifiedAt: new Date(),
    },
  });
  if (!source.transaction || source.transaction.sourceType !== "BANK_CONNECTION") return;
  const before = source.transaction;
  const protectedMeaning = [
    before.merchantSource,
    before.categorySource,
    before.typeSource,
    before.reviewSource,
  ].some((value) => ["USER", "BULK_USER"].includes(value));
  const after = await tx.transaction.update({
    where: { id: before.id },
    data: {
      originalDescription: provider.name,
      originalAmountText: String(provider.amount),
      originalDateText: provider.date,
      amountMinor,
      transactionDate: providerDate(provider.authorized_date ?? provider.date),
      postedDate: providerDate(provider.date),
      clearingStatus: provider.pending ? "PENDING" : "CLEARED",
      ...(!protectedMeaning
        ? {
            normalizedMerchant,
            type: interpretation.transactionType,
            reviewStatus: interpretation.reviewRequired ? "NEEDS_REVIEW" : "REVIEWED",
            affectsIncomeSpendingReports: interpretation.affectsIncomeSpendingReports,
            interpretationType: interpretation.classification,
            interpretationConfidence: interpretation.confidence,
            interpretationReason: interpretation.reason,
            interpretationEvidenceJson: JSON.stringify(interpretation.evidence),
            interpretationAutoApplied: interpretation.automaticallyApplied,
            interpretationReviewRequired: interpretation.reviewRequired,
          }
        : {}),
    },
  });
  await auditFields(tx, {
    householdId: before.householdId,
    entityType: "Transaction",
    entityId: before.id,
    action: "plaid_sync_modify",
    before,
    after,
    fields: [
      "amountMinor",
      "transactionDate",
      "postedDate",
      "clearingStatus",
      "normalizedMerchant",
      "type",
      "reviewStatus",
    ],
    source: "plaid",
  });
}

async function findCsvOverlap(
  tx: Prisma.TransactionClient,
  accountId: string,
  amountMinor: number,
  postedDate: string,
  normalizedMerchant: string,
) {
  const center = providerDate(postedDate);
  const from = new Date(center.getTime() - 2 * 86_400_000);
  const to = new Date(center.getTime() + 2 * 86_400_000);
  const candidates = await tx.transaction.findMany({
    where: {
      accountId,
      sourceType: "CSV_IMPORT",
      amountMinor,
      transactionDate: { gte: from, lte: to },
      plaidSource: null,
    },
  });
  const merchantKey = normalizeRuleText(normalizedMerchant);
  const exact = candidates.filter(
    (candidate) => normalizeRuleText(candidate.normalizedMerchant) === merchantKey,
  );
  return exact.length === 1 ? exact[0] : null;
}

function providerSourceData(
  plaidAccountId: string,
  provider: PlaidTransaction,
  transactionId: string | null,
  amountMinor: number,
  ledgerDisposition: string,
  evidence: string[],
) {
  return {
    plaidAccountId,
    transactionId,
    providerTransactionId: provider.transaction_id,
    pendingProviderTransactionId: provider.pending_transaction_id,
    authorizedDate: provider.authorized_date ? providerDate(provider.authorized_date) : null,
    postedDate: providerDate(provider.date),
    amountMinor,
    currency: provider.iso_currency_code ?? provider.unofficial_currency_code,
    rawName: provider.name.slice(0, 500),
    merchantName: provider.merchant_name?.slice(0, 500),
    providerCategoryPrimary: provider.personal_finance_category?.primary,
    providerCategoryDetailed: provider.personal_finance_category?.detailed,
    providerTransactionCode: provider.transaction_code,
    pending: provider.pending,
    status: "ACTIVE",
    ledgerDisposition,
    reconciliationEvidenceJson: evidence.length ? JSON.stringify(evidence) : null,
    removedAt: null,
  };
}

function providerDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
function normalizeMerchant(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 160) || "Unknown merchant";
}

function nullablePlaidBalance(value: number | null | undefined) {
  return value === null || value === undefined ? null : plaidAmountToMinor(value);
}

async function refreshPostSyncIntelligence(householdId: string, transactionIds: string[]) {
  if (!transactionIds.length) return;
  const tasks = [
    scanTransferCandidates({ householdId, transactionIds }),
    scanRecurringExpenses({ householdId, transactionIds }),
    refreshForecastIntelligence(householdId, transactionIds),
  ];
  await Promise.allSettled(tasks);
}
