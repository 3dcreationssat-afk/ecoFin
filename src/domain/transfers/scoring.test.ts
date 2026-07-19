import { describe, expect, it } from "vitest";
import { scoreTransferCandidate } from "./scoring";

const checking = { id: "checking", name: "Everyday Checking", type: "CHECKING" };
const savings = { id: "savings", name: "High-Yield Savings", type: "SAVINGS" };
const credit = { id: "card", name: "Chase Sapphire", type: "CREDIT" };

function tx(overrides: Partial<Parameters<typeof scoreTransferCandidate>[0]> = {}) {
  return {
    id: "tx1",
    householdId: "household",
    accountId: checking.id,
    amountMinor: -10000,
    transactionDate: new Date("2026-07-10"),
    postedDate: new Date("2026-07-10"),
    originalDescription: "Online transfer to High-Yield Savings",
    normalizedMerchant: "Online Transfer",
    type: "DEBIT",
    excluded: false,
    account: checking,
    ...overrides,
  };
}

describe("transfer candidate scoring", () => {
  it("scores exact opposite-sign checking-to-savings matches with explainable reasons", () => {
    const result = scoreTransferCandidate(
      tx(),
      tx({
        id: "tx2",
        accountId: savings.id,
        amountMinor: 10000,
        originalDescription: "Transfer from Everyday Checking",
        account: savings,
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.confidence).toBe("HIGH");
    expect(result.reasons).toContain("Exact opposite-sign amount match.");
    expect(result.reasons).toContain("Checking-to-savings account pairing.");
  });

  it("rejects same-account, same-transaction, different-household, excluded, and non-exact matches", () => {
    expect(scoreTransferCandidate(tx(), tx({ id: "tx2", amountMinor: 10000 })).valid).toBe(false);
    expect(scoreTransferCandidate(tx(), tx({ amountMinor: 10000 })).invalidReasons).toContain(
      "Transactions cannot match themselves.",
    );
    expect(
      scoreTransferCandidate(
        tx(),
        tx({ id: "tx2", accountId: savings.id, householdId: "other", amountMinor: 10000 }),
      ),
    ).toMatchObject({ valid: false });
    expect(
      scoreTransferCandidate(tx(), tx({ id: "tx2", accountId: savings.id, amountMinor: 9999 })),
    ).toMatchObject({ valid: false });
    expect(
      scoreTransferCandidate(
        tx(),
        tx({ id: "tx2", accountId: savings.id, amountMinor: 10000, excluded: true }),
      ),
    ).toMatchObject({ valid: false });
  });

  it("uses posted-date proximity and rejects beyond the configured window", () => {
    const oneDay = scoreTransferCandidate(
      tx(),
      tx({
        id: "tx2",
        accountId: savings.id,
        amountMinor: 10000,
        postedDate: new Date("2026-07-11"),
        account: savings,
      }),
    );
    expect(oneDay.valid).toBe(true);
    expect(oneDay.dateDiffDays).toBe(1);
    const tooFar = scoreTransferCandidate(
      tx(),
      tx({
        id: "tx2",
        accountId: savings.id,
        amountMinor: 10000,
        postedDate: new Date("2026-07-14"),
        account: savings,
      }),
    );
    expect(tooFar.valid).toBe(false);
  });

  it("rejects duplicate and non-ledger source representations", () => {
    const counterpart = tx({
      id: "tx2",
      accountId: savings.id,
      amountMinor: 10000,
      account: savings,
    });
    expect(scoreTransferCandidate(tx({ possibleDuplicate: true }), counterpart)).toMatchObject({
      valid: false,
      invalidReasons: expect.arrayContaining(["Possible duplicate transactions require review."]),
    });
    expect(scoreTransferCandidate(tx({ affectsLedger: false }), counterpart)).toMatchObject({
      valid: false,
      invalidReasons: expect.arrayContaining([
        "Non-ledger source representations cannot form a second transfer match.",
      ]),
    });
  });

  it("recognizes credit-card payments without treating fees or refunds as candidates", () => {
    const payment = scoreTransferCandidate(
      tx({ originalDescription: "Autopay Chase Sapphire" }),
      tx({
        id: "tx2",
        accountId: credit.id,
        amountMinor: 10000,
        originalDescription: "Payment received",
        account: credit,
      }),
    );
    expect(payment.isCreditCardPayment).toBe(true);
    expect(payment.reasons.join(" ")).toContain("credit-card");
    expect(
      scoreTransferCandidate(
        tx(),
        tx({
          id: "tx2",
          accountId: credit.id,
          amountMinor: 10000,
          originalDescription: "Interest charge",
          account: credit,
        }),
      ).valid,
    ).toBe(false);
    expect(
      scoreTransferCandidate(
        tx(),
        tx({
          id: "tx2",
          accountId: credit.id,
          amountMinor: 10000,
          originalDescription: "Statement credit refund",
          account: credit,
        }),
      ).valid,
    ).toBe(false);
  });
});
