import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { dataQualityRules } from "@/domain/summaries/calculations";
import { importDashboard } from "@/server/data/imports";
import { workspaceState } from "@/server/data/repositories";
import { recurringDataQuality } from "@/server/data/recurring";
import { transferDataQuality } from "@/server/data/transfers";

export const dynamic = "force-dynamic";

export default async function DataQualityPage() {
  const { household, batches } = await importDashboard();
  const state = await workspaceState();
  const [transferQuality, recurringQuality] = await Promise.all([
    transferDataQuality(),
    recurringDataQuality(),
  ]);
  const quality = dataQualityRules({
    transactions: household.transactions,
    accounts: household.accounts,
    goals: household.goals,
    importBatches: batches,
    transfers: transferQuality,
    recurring: recurringQuality,
    asOf: new Date("2026-07-11"),
  });
  const issues = [
    [
      "Uncategorized transactions",
      quality.uncategorized,
      "Spending by category may be incomplete.",
      "Assign categories from the transaction drawer.",
    ],
    [
      "Transactions lacking review",
      quality.unreviewed,
      "Review status may affect confidence.",
      "Review imported or edited rows before relying on summaries.",
    ],
    [
      "Stale accounts",
      quality.staleAccounts,
      "Balances may need a manual update.",
      "Update account balances or import recent transactions.",
    ],
    [
      "Missing debt APR or minimum",
      quality.missingDebtTerms,
      "Debt payoff estimates remain demonstration-only.",
      "Add APR and minimum payment details on Accounts.",
    ],
    [
      "Incomplete goals",
      quality.incompleteGoals,
      "Goal progress may be incomplete.",
      "Link goals to accounts and set targets.",
    ],
    [
      "Failed import batches",
      quality.failedImportBatches,
      "Transactions from failed imports were not created.",
      "Open the import workflow and correct file or mapping errors.",
    ],
    [
      "Partial import batches",
      quality.partialImportBatches,
      "Some rows were skipped or invalid.",
      "Review the batch history and row validation errors.",
    ],
    [
      "Invalid import rows",
      quality.invalidImportRows,
      "Invalid rows were not imported.",
      "Fix date, amount, or required description values and re-import.",
    ],
    [
      "Duplicate import candidates",
      quality.duplicateImportCandidates,
      "Potential duplicates require explicit review.",
      "Skip duplicates or mark rows for later review before confirming.",
    ],
    [
      "Repeated file attempts",
      quality.repeatedFileAttempts,
      "Repeated file hashes can create duplicate transactions.",
      "Use the override only when importing the same file is intentional.",
    ],
    [
      "Transactions with unknown type",
      quality.unknownTypeTransactions,
      "Unknown transaction types can distort summaries.",
      "Set a supported transaction type in the drawer.",
    ],
    [
      "High-confidence unmatched transfers",
      quality.highConfidenceTransferCandidates,
      "Likely internal transfers may be counted as income or spending until confirmed.",
      "Open Transactions and confirm or reject transfer suggestions.",
    ],
    [
      "Possible credit-card payments",
      quality.possibleCreditCardPayments,
      "Card payments can double-count spending if not matched as transfers.",
      "Confirm true payments and leave fees or refunds as expenses/refunds.",
    ],
    [
      "Broken transfer relationships",
      quality.brokenTransferRelationships,
      "A confirmed transfer no longer reconciles and can distort reporting.",
      "Review the pair, unmatch it, or correct the transaction classification.",
    ],
    [
      "Rejected transfer candidates",
      quality.rejectedTransferCandidates,
      "Rejected suggestions are preserved for audit and future review.",
      "No action is required unless the underlying transactions changed.",
    ],
    [
      "Transfers without confirmed counterpart",
      quality.transferMarkedWithoutCounterpart,
      "Transactions marked as transfer need a confirmed relationship for reliable reporting.",
      "Create a manual match or restore the original classification.",
    ],
    [
      "Excluded transfer candidates",
      quality.excludedTransferCandidates,
      "Excluded transactions require explicit review before transfer matching.",
      "Unexclude the transaction or leave the suggestion unresolved.",
    ],
    [
      "Unconfirmed recurring candidates",
      quality.unconfirmedRecurringCandidates,
      "Detected patterns are not treated as confirmed recurring expenses yet.",
      "Open Recurring and confirm, edit, or reject each suggestion.",
    ],
    [
      "Low-confidence recurring candidates",
      quality.lowConfidenceRecurringCandidates,
      "Weak patterns may be normal one-off spending.",
      "Review supporting transactions before confirming them.",
    ],
    [
      "Recurring items without category",
      quality.recurringWithoutCategory,
      "Recurring totals may not align with category reporting.",
      "Edit the recurring item or its supporting transactions with a category.",
    ],
    [
      "Recurring price increases",
      quality.recurringPriceIncreases,
      "Recent charges are higher than the previous pattern.",
      "Review whether the new amount is expected before relying on monthly totals.",
    ],
    [
      "Canceled recurring items with recent charges",
      quality.recurringChargesAfterCanceled,
      "A canceled item appears to have charged recently.",
      "Review the item and reactivate it if the charge is valid.",
    ],
    [
      "Missing expected recurring charges",
      quality.recurringMissingExpectedCharge,
      "Confirmed items are past their expected charge date.",
      "Check whether the service was canceled, delayed, or imported late.",
    ],
    [
      "Duplicate recurring services",
      quality.duplicateRecurringServices,
      "Multiple records share the same service name.",
      "Reject duplicates or clarify service names.",
    ],
    [
      "Unlinked recurring-like transactions",
      quality.unlinkedRecurringExpenseTransactions,
      "Some expense transactions are not linked to a detected recurring item.",
      "Run recurring detection or mark one-off transactions as reviewed.",
    ],
    [
      "Inactive recurring still expected",
      quality.inactiveRecurringStillExpected,
      "Inactive records have a future expected charge date.",
      "Reactivate or update the item status.",
    ],
  ] as const;
  const issueCount = issues.reduce((total, [, count]) => total + count, 0);
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/data-quality"].title}
        subtitle="Deterministic checks from local records"
        workspaceState={state}
      />
      {state === "EMPTY" ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold">No financial data to assess yet.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Data quality checks will appear after accounts, transactions, or imports are added.
          </p>
        </Card>
      ) : (
        <>
          <Card className="mb-7 flex flex-wrap items-center justify-between gap-6 p-6">
            <div className="flex items-center gap-5">
              <div className="rounded-lg bg-[var(--amber-soft)] p-4">
                <ShieldCheck className="h-7 w-7 text-[var(--amber)]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  Overall confidence: {issueCount ? "Moderate" : "High"}{" "}
                  <Pill tone={issueCount ? "warn" : "good"}>{issueCount} issues</Pill>
                </h2>
                <p className="text-[var(--muted)]">
                  These checks do not claim advanced recurring, forecast, or duplicate engines
                  exist.
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="text-xl font-semibold">Issues Found</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {issues.map(([title, count, impact, action]) => (
                <div key={title} className="rounded-md border border-[var(--border)] p-4">
                  <Pill tone={count ? "warn" : "good"}>{count ? "Review" : "Clear"}</Pill>
                  <p className="mt-3 font-semibold">
                    {count} {title.toLowerCase()}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{impact}</p>
                  {count ? (
                    <a
                      className="mt-2 inline-block text-sm font-semibold text-[var(--teal)]"
                      href={qualityHref(title)}
                    >
                      {action}
                    </a>
                  ) : (
                    <p className="mt-2 text-sm font-medium">Action: {action}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}

function qualityHref(title: string) {
  if (title === "Uncategorized transactions") return "/transactions?category=uncategorized";
  if (title === "Transactions lacking review") return "/transactions?status=NEEDS_REVIEW";
  if (title.includes("Duplicate")) return "/transactions?status=FLAGGED";
  if (title.includes("transfer") || title.includes("credit-card"))
    return "/transactions?transfer=suggested";
  if (title.includes("recurring")) return "/transactions?recurring=suggested";
  if (title.includes("account") || title.includes("debt")) return "/accounts";
  if (title.includes("goal")) return "/goals";
  if (title.includes("import")) return "/transactions?source=CSV_IMPORT";
  return "/transactions";
}
