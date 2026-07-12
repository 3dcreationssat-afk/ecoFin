import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, PageHeader, Pill } from "@/components/data-display/primitives";
import { pageMeta } from "@/data/demo";
import { dataQualityRules } from "@/domain/summaries/calculations";
import { importDashboard } from "@/server/data/imports";
import { transferDataQuality } from "@/server/data/transfers";

export const dynamic = "force-dynamic";

export default async function DataQualityPage() {
  const { household, batches } = await importDashboard();
  const transferQuality = await transferDataQuality();
  const quality = dataQualityRules({
    transactions: household.transactions,
    accounts: household.accounts,
    goals: household.goals,
    importBatches: batches,
    transfers: transferQuality,
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
  ] as const;
  const issueCount = issues.reduce((total, [, count]) => total + count, 0);
  return (
    <AppShell>
      <PageHeader
        title={pageMeta["/data-quality"].title}
        subtitle="Deterministic checks from SQLite records"
      />
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
              These checks do not claim advanced recurring, forecast, or duplicate engines exist.
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
              <p className="mt-2 text-sm font-medium">Action: {action}</p>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
