import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { classifyTransferPair, scoreTransferCandidate } from "@/domain/transfers/scoring";
import { prisma } from "@/server/db/prisma";
import { auditChange } from "./audit";
import { AppError } from "./errors";

type Db = PrismaClient | Prisma.TransactionClient;

const confirmSchema = z.object({
  confirmation: z.literal("CONFIRM TRANSFER"),
  notes: z.string().max(500).optional(),
});

const rejectSchema = z.object({
  confirmation: z.literal("REJECT TRANSFER"),
  notes: z.string().max(500).optional(),
});

const manualSchema = z.object({
  outgoingTransactionId: z.string().min(1),
  incomingTransactionId: z.string().min(1),
  confirmation: z.literal("CONFIRM TRANSFER"),
  notes: z.string().max(500).optional(),
});

const unmatchSchema = z.object({
  confirmation: z.literal("UNMATCH TRANSFER"),
  notes: z.string().max(500).optional(),
});

export async function scanTransferCandidates(
  input: { householdId?: string; transactionIds?: string[] } = {},
) {
  const household = input.householdId
    ? await prisma.household.findUnique({ where: { id: input.householdId } })
    : await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  const baseWhere: Prisma.TransactionWhereInput = {
    householdId: household.id,
    amountMinor: { not: 0 },
  };
  const seedTransactions = input.transactionIds?.length
    ? await prisma.transaction.findMany({
        where: { ...baseWhere, id: { in: input.transactionIds } },
        include: { account: true },
      })
    : await prisma.transaction.findMany({ where: baseWhere, include: { account: true } });
  const allTransactions = await prisma.transaction.findMany({
    where: baseWhere,
    include: { account: true },
  });
  const confirmed = await prisma.transferMatch.findMany({
    where: { householdId: household.id, status: "CONFIRMED" },
    select: { outgoingTransactionId: true, incomingTransactionId: true },
  });
  const confirmedIds = new Set(
    confirmed.flatMap((match) => [match.outgoingTransactionId, match.incomingTransactionId]),
  );
  const created: string[] = [];
  const refreshed: string[] = [];
  let highConfidence = 0;
  let creditCardPaymentCandidates = 0;

  for (const seed of seedTransactions) {
    if (confirmedIds.has(seed.id)) continue;
    for (const other of allTransactions) {
      if (seed.id === other.id || confirmedIds.has(other.id)) continue;
      if (seed.id > other.id) continue;
      const score = scoreTransferCandidate(seed, other);
      if (!score.valid) continue;
      const { outgoing, incoming } = classifyTransferPair(seed, other);
      const existing = await prisma.transferMatch.findUnique({
        where: {
          outgoingTransactionId_incomingTransactionId: {
            outgoingTransactionId: outgoing.id,
            incomingTransactionId: incoming.id,
          },
        },
      });
      if (existing?.status === "REJECTED" || existing?.status === "CONFIRMED") continue;
      const data = {
        householdId: household.id,
        outgoingTransactionId: outgoing.id,
        incomingTransactionId: incoming.id,
        status: "SUGGESTED",
        source: "AUTOMATIC_CANDIDATE",
        confidence: score.confidence,
        score: score.score,
        reasonsJson: JSON.stringify(score.reasons),
        createdBySource: "scan",
      };
      const match = existing
        ? await prisma.transferMatch.update({ where: { id: existing.id }, data })
        : await prisma.transferMatch.create({ data });
      if (existing) {
        refreshed.push(match.id);
        await auditChange(prisma, {
          householdId: household.id,
          entityType: "TransferMatch",
          entityId: match.id,
          action: "candidate_refreshed",
          field: "score",
          newValue: match.score,
          source: "transfer",
        });
      } else {
        created.push(match.id);
        await auditChange(prisma, {
          householdId: household.id,
          entityType: "TransferMatch",
          entityId: match.id,
          action: "candidate_created",
          field: "confidence",
          newValue: match.confidence,
          source: "transfer",
        });
      }
      if (score.confidence === "HIGH") highConfidence += 1;
      if (score.isCreditCardPayment) creditCardPaymentCandidates += 1;
    }
  }
  return {
    createdCount: created.length,
    refreshedCount: refreshed.length,
    highConfidence,
    creditCardPaymentCandidates,
    candidateIds: [...created, ...refreshed],
  };
}

export async function transferReviewQueue() {
  const household = await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  const [matches, accounts] = await Promise.all([
    prisma.transferMatch.findMany({
      where: {
        householdId: household.id,
        status: { in: ["SUGGESTED", "REJECTED", "CONFIRMED", "BROKEN"] },
      },
      include: {
        outgoingTransaction: { include: { account: true } },
        incomingTransaction: { include: { account: true } },
      },
      orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.account.findMany({ where: { householdId: household.id }, orderBy: { name: "asc" } }),
  ]);
  return {
    household,
    accounts,
    matches: matches.map(serializeMatch),
  };
}

export async function transferContextForTransaction(transactionId: string) {
  const matches = await prisma.transferMatch.findMany({
    where: {
      OR: [{ outgoingTransactionId: transactionId }, { incomingTransactionId: transactionId }],
      status: { in: ["SUGGESTED", "CONFIRMED", "BROKEN"] },
    },
    include: {
      outgoingTransaction: { include: { account: true } },
      incomingTransaction: { include: { account: true } },
    },
    orderBy: [{ status: "asc" }, { score: "desc" }],
    take: 8,
  });
  return matches.map(serializeMatch);
}

export async function confirmTransferMatch(id: string, input: unknown) {
  const data = confirmSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const match = await matchForUpdate(tx, id);
    if (!["SUGGESTED", "UNMATCHED"].includes(match.status)) {
      throw new AppError("Only suggested or unmatched transfer candidates can be confirmed.", 409);
    }
    await assertCanConfirm(tx, match.outgoingTransactionId, match.incomingTransactionId, match.id);
    const score = scoreTransferCandidate(match.outgoingTransaction, match.incomingTransaction);
    if (!score.valid) throw new AppError(score.invalidReasons.join(" "), 422);
    const updated = await tx.transferMatch.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        source: "USER_CONFIRMED",
        confidence: score.confidence,
        score: score.score,
        reasonsJson: JSON.stringify(score.reasons),
        confirmedAt: new Date(),
        rejectedAt: null,
        brokenAt: null,
        notes: data.notes,
        previousOutgoingType: match.outgoingTransaction.type,
        previousIncomingType: match.incomingTransaction.type,
        previousOutgoingReviewStatus: match.outgoingTransaction.reviewStatus,
        previousIncomingReviewStatus: match.incomingTransaction.reviewStatus,
      },
    });
    await tx.transaction.update({
      where: { id: match.outgoingTransactionId },
      data: { type: "TRANSFER_OUT", reviewStatus: "REVIEWED" },
    });
    await tx.transaction.update({
      where: { id: match.incomingTransactionId },
      data: { type: "TRANSFER_IN", reviewStatus: "REVIEWED" },
    });
    await auditTransferConfirmed(
      tx,
      match.householdId,
      updated.id,
      "transfer_confirmed",
      data.notes,
    );
    return updated;
  });
}

export async function rejectTransferMatch(id: string, input: unknown) {
  const data = rejectSchema.parse(input);
  const match = await prisma.transferMatch.update({
    where: { id },
    data: { status: "REJECTED", rejectedAt: new Date(), notes: data.notes },
  });
  await auditChange(prisma, {
    householdId: match.householdId,
    entityType: "TransferMatch",
    entityId: match.id,
    action: "suggestion_rejected",
    reason: data.notes,
    source: "transfer",
  });
  return match;
}

export async function createManualTransfer(input: unknown) {
  const data = manualSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const transactions = await tx.transaction.findMany({
      where: { id: { in: [data.outgoingTransactionId, data.incomingTransactionId] } },
      include: { account: true },
    });
    if (transactions.length !== 2) throw new AppError("Choose two existing transactions.", 404);
    const score = scoreTransferCandidate(transactions[0], transactions[1]);
    if (!score.valid) throw new AppError(score.invalidReasons.join(" "), 422);
    const { outgoing, incoming } = classifyTransferPair(transactions[0], transactions[1]);
    await assertCanConfirm(tx, outgoing.id, incoming.id);
    const match = await tx.transferMatch.upsert({
      where: {
        outgoingTransactionId_incomingTransactionId: {
          outgoingTransactionId: outgoing.id,
          incomingTransactionId: incoming.id,
        },
      },
      create: {
        householdId: outgoing.householdId,
        outgoingTransactionId: outgoing.id,
        incomingTransactionId: incoming.id,
        status: "CONFIRMED",
        source: "USER_CREATED",
        confidence: score.confidence,
        score: score.score,
        reasonsJson: JSON.stringify([...score.reasons, "User manually confirmed this pair."]),
        createdBySource: "user",
        confirmedAt: new Date(),
        notes: data.notes,
        previousOutgoingType: outgoing.type,
        previousIncomingType: incoming.type,
        previousOutgoingReviewStatus: outgoing.reviewStatus,
        previousIncomingReviewStatus: incoming.reviewStatus,
      },
      update: {
        status: "CONFIRMED",
        source: "USER_CREATED",
        confidence: score.confidence,
        score: score.score,
        reasonsJson: JSON.stringify([...score.reasons, "User manually confirmed this pair."]),
        confirmedAt: new Date(),
        rejectedAt: null,
        brokenAt: null,
        notes: data.notes,
      },
    });
    await tx.transaction.update({
      where: { id: outgoing.id },
      data: { type: "TRANSFER_OUT", reviewStatus: "REVIEWED" },
    });
    await tx.transaction.update({
      where: { id: incoming.id },
      data: { type: "TRANSFER_IN", reviewStatus: "REVIEWED" },
    });
    await auditTransferConfirmed(
      tx,
      outgoing.householdId,
      match.id,
      "manual_transfer_created",
      data.notes,
    );
    return match;
  });
}

export async function unmatchTransfer(id: string, input: unknown) {
  const data = unmatchSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const match = await matchForUpdate(tx, id);
    if (match.status !== "CONFIRMED")
      throw new AppError("Only confirmed transfers can be unmatched.", 409);
    const updated = await tx.transferMatch.update({
      where: { id },
      data: { status: "UNMATCHED", notes: data.notes },
    });
    await tx.transaction.update({
      where: { id: match.outgoingTransactionId },
      data: {
        type: match.previousOutgoingType ?? "DEBIT",
        reviewStatus: match.previousOutgoingReviewStatus ?? "NEEDS_REVIEW",
      },
    });
    await tx.transaction.update({
      where: { id: match.incomingTransactionId },
      data: {
        type: match.previousIncomingType ?? "CREDIT",
        reviewStatus: match.previousIncomingReviewStatus ?? "NEEDS_REVIEW",
      },
    });
    await auditChange(tx, {
      householdId: match.householdId,
      entityType: "TransferMatch",
      entityId: id,
      action: "transfer_unmatched",
      reason: data.notes,
      source: "transfer",
    });
    return updated;
  });
}

export async function refreshTransferStateForTransactions(transactionIds: string[]) {
  if (!transactionIds.length) return;
  const matches = await prisma.transferMatch.findMany({
    where: {
      status: "CONFIRMED",
      OR: [
        { outgoingTransactionId: { in: transactionIds } },
        { incomingTransactionId: { in: transactionIds } },
      ],
    },
    include: {
      outgoingTransaction: { include: { account: true } },
      incomingTransaction: { include: { account: true } },
    },
  });
  for (const match of matches) {
    const score = scoreTransferCandidate(match.outgoingTransaction, match.incomingTransaction);
    if (!score.valid) {
      await prisma.transferMatch.update({
        where: { id: match.id },
        data: { status: "BROKEN", brokenAt: new Date() },
      });
      await auditChange(prisma, {
        householdId: match.householdId,
        entityType: "TransferMatch",
        entityId: match.id,
        action: "match_broken",
        field: "reason",
        newValue: score.invalidReasons.join("; "),
        source: "transfer",
      });
    }
  }
  await scanTransferCandidates({ transactionIds }).catch(() => undefined);
}

export async function transferDataQuality() {
  const [suggestedHigh, creditCard, broken, rejected, markedWithoutMatch, excludedCandidates] =
    await Promise.all([
      prisma.transferMatch.count({ where: { status: "SUGGESTED", confidence: "HIGH" } }),
      prisma.transferMatch.count({
        where: {
          status: "SUGGESTED",
          incomingTransaction: { account: { type: "CREDIT" } },
        },
      }),
      prisma.transferMatch.count({ where: { status: "BROKEN" } }),
      prisma.transferMatch.count({ where: { status: "REJECTED" } }),
      prisma.transaction.count({
        where: {
          type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] },
          outgoingTransferMatches: { none: { status: "CONFIRMED" } },
          incomingTransferMatches: { none: { status: "CONFIRMED" } },
        },
      }),
      prisma.transaction.count({
        where: {
          excluded: true,
          OR: [
            { outgoingTransferMatches: { some: { status: "SUGGESTED" } } },
            { incomingTransferMatches: { some: { status: "SUGGESTED" } } },
          ],
        },
      }),
    ]);
  return { suggestedHigh, creditCard, broken, rejected, markedWithoutMatch, excludedCandidates };
}

function serializeMatch(
  match: Prisma.TransferMatchGetPayload<{
    include: {
      outgoingTransaction: { include: { account: true } };
      incomingTransaction: { include: { account: true } };
    };
  }>,
) {
  return {
    ...match,
    reasons: parseReasons(match.reasonsJson),
  };
}

function parseReasons(value: string) {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

async function matchForUpdate(tx: Db, id: string) {
  const match = await tx.transferMatch.findUnique({
    where: { id },
    include: {
      outgoingTransaction: { include: { account: true } },
      incomingTransaction: { include: { account: true } },
    },
  });
  if (!match) throw new AppError("Transfer match not found.", 404);
  if (match.outgoingTransaction.id === match.incomingTransaction.id) {
    throw new AppError("Transactions cannot match themselves.", 422);
  }
  return match;
}

async function assertCanConfirm(
  tx: Db,
  outgoingTransactionId: string,
  incomingTransactionId: string,
  currentId?: string,
) {
  const existing = await tx.transferMatch.findFirst({
    where: {
      status: "CONFIRMED",
      id: currentId ? { not: currentId } : undefined,
      OR: [
        { outgoingTransactionId },
        { incomingTransactionId },
        { outgoingTransactionId: incomingTransactionId },
        { incomingTransactionId: outgoingTransactionId },
      ],
    },
  });
  if (existing)
    throw new AppError("One of these transactions is already in a confirmed transfer.", 409);
}

async function auditTransferConfirmed(
  tx: Db,
  householdId: string,
  matchId: string,
  action: string,
  reason?: string,
) {
  await auditChange(tx, {
    householdId,
    entityType: "TransferMatch",
    entityId: matchId,
    action,
    field: "status",
    newValue: "CONFIRMED",
    reason,
    source: "transfer",
  });
  await auditChange(tx, {
    householdId,
    entityType: "Reporting",
    entityId: matchId,
    action: "reporting_recalculation_triggered",
    field: "transferMatchId",
    newValue: matchId,
    source: "transfer",
  });
}

export function transferEffectText() {
  return "This will classify both transactions as an internal transfer and exclude them from income and spending totals.";
}
