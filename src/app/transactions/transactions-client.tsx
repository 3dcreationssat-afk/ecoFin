"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Link2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Button, Card, Pill } from "@/components/data-display/primitives";
import { formatMoney } from "@/domain/money/money";
import {
  serializeTransactionQuery,
  withTransactionQueryChange,
  type TransactionQuery,
} from "@/domain/transactions/query";

type CategoryDto = { id: string; name: string };
type AccountDto = { id: string; name: string; type: string };
type TransactionDto = {
  id: string;
  originalDescription: string;
  originalAmountText: string;
  originalDateText: string;
  normalizedMerchant: string;
  amountMinor: number;
  transactionDate: string;
  postedDate?: string | null;
  sourceType?: string;
  sourceFilename?: string | null;
  sourceRowNumber?: number | null;
  type: string;
  reviewStatus: string;
  excluded: boolean;
  notes?: string | null;
  categoryId?: string | null;
  account: { name: string };
  category?: { name: string } | null;
};
type TransferMatchDto = {
  id: string;
  status: string;
  source: string;
  confidence: string;
  score: number;
  reasons: string[];
  notes?: string | null;
  outgoingTransactionId: string;
  incomingTransactionId: string;
  outgoingTransaction: TransactionDto & { account: AccountDto };
  incomingTransaction: TransactionDto & { account: AccountDto };
};
type AuditDto = {
  id: string;
  action: string;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  createdAt: string;
};
type ProfileDto = {
  id: string;
  name: string;
  delimiter: "," | ";" | "\t";
  encoding: "UTF-8" | "UTF-8-BOM";
  hasHeader: boolean;
  dateColumn: string;
  postedDateColumn?: string | null;
  descriptionColumn: string;
  merchantColumn?: string | null;
  amountMode: "SIGNED_AMOUNT" | "DEBIT_CREDIT_COLUMNS";
  amountColumn?: string | null;
  debitColumn?: string | null;
  creditColumn?: string | null;
  dateFormat: DateFormat;
  decimalSeparator: "." | ",";
  thousandsSeparator: "," | "." | " " | "";
  signConvention: "DEBITS_NEGATIVE" | "DEBITS_POSITIVE";
  currency: string;
  archivedAt?: string | null;
};
type ImportRowDto = {
  id: string;
  rowNumber: number;
  sourceFieldsJson: string;
  parsedTransactionDate?: string | null;
  parsedAmountMinor?: number | null;
  originalDescription?: string | null;
  duplicateStatus: string;
  duplicateReason?: string | null;
  validationStatus: string;
  validationErrorsJson: string;
  importDecision: "IMPORT" | "SKIP" | "REVIEW";
};
type BatchDto = {
  id: string;
  originalFilename: string;
  status: string;
  fileSize: number;
  encoding: string;
  delimiter: string;
  repeatedFile: boolean;
  totalRowCount: number;
  acceptedRowCount: number;
  rejectedRowCount: number;
  duplicateCandidateCount: number;
  importedTransactionCount: number;
  summaryJson?: string | null;
  createdAt: string;
  account: { name: string };
  rows: ImportRowDto[];
};
type DateFormat =
  "MM/DD/YYYY" | "M/D/YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY" | "D/M/YYYY" | "MM/DD/YY" | "DD/MM/YY";
type Mapping = {
  name?: string;
  saveProfile: boolean;
  delimiter: "," | ";" | "\t";
  encoding: "UTF-8" | "UTF-8-BOM";
  hasHeader: boolean;
  dateColumn: string;
  postedDateColumn?: string | null;
  descriptionColumn: string;
  merchantColumn?: string | null;
  amountMode: "SIGNED_AMOUNT" | "DEBIT_CREDIT_COLUMNS";
  amountColumn?: string | null;
  debitColumn?: string | null;
  creditColumn?: string | null;
  dateFormat: DateFormat;
  decimalSeparator: "." | ",";
  thousandsSeparator: "," | "." | " " | "";
  signConvention: "DEBITS_NEGATIVE" | "DEBITS_POSITIVE";
  currency: string;
};

const dateFormats: DateFormat[] = [
  "MM/DD/YYYY",
  "M/D/YYYY",
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "D/M/YYYY",
  "MM/DD/YY",
  "DD/MM/YY",
];

const transactionTypeLabels: Record<string, string> = {
  DEBIT: "Money out",
  CREDIT: "Money in",
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
  CREDIT_CARD_PAYMENT: "Credit-card payment",
  REFUND: "Refund",
  FEE: "Fee",
  INTEREST: "Interest",
  OTHER: "Other",
  UNKNOWN: "Needs type",
};

const reviewStatusLabels: Record<string, string> = {
  NEEDS_REVIEW: "Needs review",
  REVIEWED: "Reviewed",
  FLAGGED: "Flagged",
};

const sourceTypeLabels: Record<string, string> = {
  CSV_IMPORT: "CSV import",
  MANUAL: "Manual",
};

const amountModeLabels: Record<string, string> = {
  SIGNED_AMOUNT: "One signed amount column",
  DEBIT_CREDIT_COLUMNS: "Separate debit and credit columns",
};

const dateFormatLabels: Record<string, string> = {
  "MM/DD/YYYY": "MM/DD/YYYY — month/day/year",
  "M/D/YYYY": "M/D/YYYY — month/day/year",
  "YYYY-MM-DD": "YYYY-MM-DD — year-month-day",
  "DD/MM/YYYY": "DD/MM/YYYY — day/month/year",
  "D/M/YYYY": "D/M/YYYY — day/month/year",
  "MM/DD/YY": "MM/DD/YY — month/day/year",
  "DD/MM/YY": "DD/MM/YY — day/month/year",
};

const signConventionLabels: Record<string, string> = {
  DEBITS_NEGATIVE: "Debits are negative",
  DEBITS_POSITIVE: "Debits are positive",
};

const duplicateStatusLabels: Record<string, string> = {
  NONE: "No duplicate found",
  POSSIBLE: "Possible duplicate transaction",
  LIKELY: "Likely duplicate transaction",
  EXACT_OVERLAP: "Already exists — will skip",
  EXACT: "Exact source row already exists",
};

const decisionLabels: Record<string, string> = {
  IMPORT: "Import",
  SKIP: "Skip",
  REVIEW: "Choose Import or Skip",
};

const batchStatusLabels: Record<string, string> = {
  STAGED: "Staged",
  VALIDATED: "Validated",
  IMPORTED: "Imported",
  PARTIALLY_IMPORTED: "Partially imported",
  NO_CHANGES: "No new transactions",
  FAILED: "Failed",
  UNDONE: "Undone",
};

export function TransactionsClient({
  transactions,
  categories,
  accounts,
  profiles,
  batches,
  transferMatches,
  totalCount,
  filteredCount,
  totalPages,
  query,
  savedViews,
  initialImportOpen = false,
  initialImportAccountId,
}: {
  transactions: TransactionDto[];
  categories: CategoryDto[];
  accounts: AccountDto[];
  profiles: ProfileDto[];
  batches: BatchDto[];
  transferMatches: TransferMatchDto[];
  totalCount: number;
  filteredCount: number;
  totalPages: number;
  query: TransactionQuery;
  savedViews: { id: string; name: string; queryJson: string; isDefault: boolean }[];
  initialImportOpen?: boolean;
  initialImportAccountId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<TransactionDto | null>(null);
  const [audit, setAudit] = useState<AuditDto[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pendingUndoBatchId, setPendingUndoBatchId] = useState("");
  const [undoRecovery, setUndoRecovery] = useState(false);
  const [undoConfirmed, setUndoConfirmed] = useState(false);
  const [undoError, setUndoError] = useState("");
  const [importOpen, setImportOpen] = useState(initialImportOpen);
  const [drawerTransfers, setDrawerTransfers] = useState<TransferMatchDto[]>([]);
  const [transferNote, setTransferNote] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    function openImport() {
      setImportOpen(true);
    }
    window.addEventListener("financial-compass:open-import", openImport);
    return () => window.removeEventListener("financial-compass:open-import", openImport);
  }, []);
  const [transferError, setTransferError] = useState("");
  const [pendingTransferActionId, setPendingTransferActionId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transferStatusOverrides, setTransferStatusOverrides] = useState<Record<string, string>>(
    {},
  );
  const filters = query;
  const [form, setForm] = useState({
    normalizedMerchant: "",
    categoryId: "",
    type: "DEBIT",
    reviewStatus: "NEEDS_REVIEW",
    excluded: false,
    notes: "",
  });
  const displayedTransferMatches = useMemo(
    () =>
      transferMatches.map((match) => ({
        ...match,
        status: transferStatusOverrides[match.id] ?? match.status,
      })),
    [transferMatches, transferStatusOverrides],
  );

  const currentPage = Math.min(query.page, totalPages);
  function navigate(next: TransactionQuery, push = true) {
    if (selectedIds.length) {
      setSelectedIds([]);
      setAnnouncement("Selection cleared because the transaction view changed.");
    }
    const params = serializeTransactionQuery(next);
    const href = `/transactions${params.size ? `?${params}` : "?period=ALL"}`;
    startTransition(() =>
      push ? router.push(href, { scroll: false }) : router.replace(href, { scroll: false }),
    );
  }
  function updateFilter(key: keyof TransactionQuery, value: string) {
    navigate(
      withTransactionQueryChange(query, {
        [key]: key === "pageSize" ? Number(value) : value,
      } as Partial<TransactionQuery>),
    );
  }
  function updatePage(nextPage: number) {
    const bounded = Math.min(Math.max(nextPage, 1), totalPages);
    navigate(withTransactionQueryChange(query, { page: bounded }, true));
  }

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  async function open(transaction: TransactionDto) {
    setSelected(transaction);
    setForm({
      normalizedMerchant: transaction.normalizedMerchant,
      categoryId: transaction.categoryId ?? "",
      type: transaction.type,
      reviewStatus: transaction.reviewStatus,
      excluded: transaction.excluded,
      notes: transaction.notes ?? "",
    });
    const response = await fetch(`/api/transactions/${transaction.id}/audit`);
    const body = await response.json();
    setAudit(body.audit ?? []);
    const transferResponse = await fetch(`/api/transactions/${transaction.id}/transfers`);
    const transferBody = await transferResponse.json();
    setDrawerTransfers(transferBody.matches ?? []);
  }

  async function scanTransfers() {
    setStatus("saving");
    setTransferStatusOverrides({});
    const response = await fetch("/api/transfers", { method: "POST" });
    setStatus(response.ok ? "saved" : "error");
    setAnnouncement(response.ok ? "Transfer scan complete." : "Transfer scan failed.");
    startTransition(() => router.refresh());
  }

  async function transferAction(
    url: string,
    body: Record<string, unknown>,
    successMessage: string,
    localStatus?: { id: string; status: string },
  ) {
    setStatus("saving");
    setTransferError("");
    setPendingTransferActionId(localStatus?.id ?? "manual-transfer");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    setStatus(response.ok ? "saved" : "error");
    const message = response.ok
      ? successMessage
      : (payload.error ?? "Transfer action failed. Check the selected transactions and try again.");
    if (response.ok && localStatus) {
      setTransferStatusOverrides((current) => ({
        ...current,
        [localStatus.id]: localStatus.status,
      }));
    }
    setAnnouncement(message);
    setTransferError(response.ok ? "" : message);
    setTransferNote("");
    setPendingTransferActionId("");
    startTransition(() => router.refresh());
    if (selected) open(selected);
  }

  async function save() {
    if (!selected) return;
    setStatus("saving");
    const response = await fetch(`/api/transactions/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, categoryId: form.categoryId || null }),
    });
    setStatus(response.ok ? "saved" : "error");
    startTransition(() => router.refresh());
  }

  function beginUndo(batchId: string) {
    setPendingUndoBatchId(batchId);
    setUndoRecovery(false);
    setUndoConfirmed(false);
    setUndoError("");
  }

  async function confirmUndo() {
    if (!pendingUndoBatchId || !undoConfirmed) return;
    setStatus("saving");
    const response = await fetch(`/api/imports/${pendingUndoBatchId}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "UNDO IMPORT" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const recoveryAvailable = Array.isArray(payload.issues)
        ? payload.issues.some(
            (issue: { path?: string; message?: string }) =>
              issue.path === "recovery" && issue.message === "DISCARD_REVIEW_CHANGES",
          )
        : false;
      setStatus("error");
      setUndoError(payload.error ?? "Import undo failed.");
      setUndoRecovery(recoveryAvailable);
      setUndoConfirmed(false);
      return;
    }
    setStatus("saved");
    setAnnouncement(
      undoCleanupWarning(payload)
        ? `Import transactions were undone, but derived detection cleanup needs attention: ${undoCleanupWarning(payload)}`
        : "Import safely undone. Recurring and forecast detection were recomputed.",
    );
    setPendingUndoBatchId("");
    setUndoRecovery(false);
    setUndoConfirmed(false);
    setUndoError("");
    startTransition(() => router.refresh());
  }

  async function discardReviewsAndUndo() {
    if (!pendingUndoBatchId || !undoConfirmed) return;
    setStatus("saving");
    const resetResponse = await fetch(`/api/imports/${pendingUndoBatchId}/discard-review-changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DISCARD REVIEW CHANGES" }),
    });
    const resetPayload = await resetResponse.json().catch(() => ({}));
    if (!resetResponse.ok) {
      setStatus("error");
      setUndoError(resetPayload.error ?? "Review changes could not be discarded safely.");
      setUndoConfirmed(false);
      return;
    }
    const undoResponse = await fetch(`/api/imports/${pendingUndoBatchId}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "UNDO IMPORT" }),
    });
    const undoPayload = await undoResponse.json().catch(() => ({}));
    if (!undoResponse.ok) {
      setStatus("error");
      setUndoError(
        undoPayload.error ??
          "Review changes were discarded, but the import remains protected by another blocker.",
      );
      setUndoRecovery(false);
      setUndoConfirmed(false);
      startTransition(() => router.refresh());
      return;
    }
    setStatus("saved");
    setAnnouncement(
      undoCleanupWarning(undoPayload)
        ? `Import transactions were undone, but derived detection cleanup needs attention: ${undoCleanupWarning(undoPayload)}`
        : "Review-only changes were discarded, the import was safely undone, and derived detection was recomputed.",
    );
    setPendingUndoBatchId("");
    setUndoRecovery(false);
    setUndoConfirmed(false);
    setUndoError("");
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
        <Button disabled title="Manual transaction creation is planned">
          <Plus className="h-4 w-4" /> Add Transaction
        </Button>
        <SavedViews
          views={savedViews}
          query={query}
          navigate={navigate}
          announce={setAnnouncement}
        />
        {status === "saving" || isPending ? <Pill tone="info">Saving</Pill> : null}
        {status === "saved" ? <Pill tone="good">Saved</Pill> : null}
        {status === "error" ? <Pill tone="bad">Action failed</Pill> : null}
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <TransactionFilters
        filters={filters}
        accounts={accounts}
        categories={categories}
        onChange={updateFilter}
      />
      {selectedIds.length ? (
        <BulkActionBar
          selectedIds={selectedIds}
          transactions={transactions}
          categories={categories}
          onClear={() => setSelectedIds([])}
          onComplete={(message) => {
            setAnnouncement(message);
            setSelectedIds([]);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
      <TransactionTable
        transactions={transactions}
        transferMatches={displayedTransferMatches}
        open={open}
        totalCount={totalCount}
        filteredCount={filteredCount}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={String(filters.pageSize)}
        onPage={updatePage}
        onPageSize={(next) => updateFilter("pageSize", next)}
        selectedIds={selectedIds}
        onSelection={setSelectedIds}
      />
      <div className="mt-5 space-y-4" aria-label="Import and transfer activity">
        {pendingUndoBatchId ? (
          <div
            role={undoError ? "alert" : "region"}
            aria-label="Confirm import undo"
            className={`rounded-lg border p-4 text-sm ${undoError ? "border-amber-200 bg-amber-50 text-amber-950" : "border-red-200 bg-red-50 text-red-950"}`}
          >
            <p className="font-semibold">
              {undoRecovery ? "Review changes are blocking this undo" : "Undo this import?"}
            </p>
            <p className="mt-1">
              {undoRecovery
                ? `${undoError} This batch contains review-status changes only. You can explicitly discard those review decisions and then safely undo the import.`
                : `This will permanently remove the ${batches.find((batch) => batch.id === pendingUndoBatchId)?.importedTransactionCount ?? "imported"} transactions created by this batch, remove untouched forecast rules created by it, and recompute recurring detection. Historical batch metadata and audit records will remain.`}
            </p>
            <label className="mt-3 flex items-start gap-2 font-medium">
              <input
                className="mt-0.5"
                type="checkbox"
                checked={undoConfirmed}
                onChange={(event) => setUndoConfirmed(event.target.checked)}
              />
              {undoRecovery
                ? "I understand that my review-status changes will be discarded before this import is undone."
                : "I understand that this removes the transactions created by this import."}
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!undoConfirmed || status === "saving"}
                onClick={undoRecovery ? discardReviewsAndUndo : confirmUndo}
              >
                <RotateCcw className="h-4 w-4" />
                {undoRecovery ? "Discard reviews and safely undo" : "Confirm undo"}
              </Button>
              <Button
                variant="secondary"
                disabled={status === "saving"}
                onClick={() => {
                  setPendingUndoBatchId("");
                  setUndoRecovery(false);
                  setUndoConfirmed(false);
                  setUndoError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        <ImportHistory batches={batches} onUndo={beginUndo} />
        <TransferReviewPanel
          matches={displayedTransferMatches}
          transactions={transactions}
          onScan={scanTransfers}
          onOpen={(id) => {
            const transaction = transactions.find((item) => item.id === id);
            if (transaction) open(transaction);
          }}
          onConfirm={(id) =>
            transferAction(
              `/api/transfers/${id}/confirm`,
              { confirmation: "CONFIRM TRANSFER", notes: transferNote || undefined },
              "Transfer confirmed.",
              { id, status: "CONFIRMED" },
            )
          }
          onReject={(id) =>
            transferAction(
              `/api/transfers/${id}/reject`,
              { confirmation: "REJECT TRANSFER", notes: transferNote || undefined },
              "Transfer suggestion rejected.",
              { id, status: "REJECTED" },
            )
          }
          onManual={(outgoingTransactionId, incomingTransactionId) =>
            transferAction(
              "/api/transfers/manual",
              {
                outgoingTransactionId,
                incomingTransactionId,
                confirmation: "CONFIRM TRANSFER",
                notes: transferNote || undefined,
              },
              "Manual transfer created.",
            )
          }
          error={transferError}
          pendingMatchId={pendingTransferActionId}
        />
      </div>
      {importOpen ? (
        <ImportDialog
          accounts={accounts}
          profiles={profiles}
          initialAccountId={initialImportAccountId}
          onClose={() => setImportOpen(false)}
          onRequestUndo={(batchId) => {
            setImportOpen(false);
            beginUndo(batchId);
          }}
          onComplete={() => {
            setImportOpen(false);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
      {selected ? (
        <TransactionDrawer
          selected={selected}
          form={form}
          categories={categories}
          audit={audit}
          transfers={drawerTransfers}
          transferNote={transferNote}
          setTransferNote={setTransferNote}
          onConfirm={(id) =>
            transferAction(
              `/api/transfers/${id}/confirm`,
              { confirmation: "CONFIRM TRANSFER", notes: transferNote || undefined },
              "Transfer confirmed.",
              { id, status: "CONFIRMED" },
            )
          }
          onReject={(id) =>
            transferAction(
              `/api/transfers/${id}/reject`,
              { confirmation: "REJECT TRANSFER", notes: transferNote || undefined },
              "Transfer suggestion rejected.",
              { id, status: "REJECTED" },
            )
          }
          onUnmatch={(id) =>
            transferAction(
              `/api/transfers/${id}/unmatch`,
              { confirmation: "UNMATCH TRANSFER", notes: transferNote || undefined },
              "Transfer unmatched.",
              { id, status: "UNMATCHED" },
            )
          }
          setSelected={setSelected}
          setForm={setForm}
          save={save}
          pendingTransferActionId={pendingTransferActionId}
        />
      ) : null}
    </>
  );
}

function ImportHistory({ batches, onUndo }: { batches: BatchDto[]; onUndo: (id: string) => void }) {
  if (!batches.length) return null;
  return (
    <Card className="mb-4 min-w-0 overflow-hidden p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-[var(--teal)]" />
        <h2 className="text-lg font-semibold">Import Batch History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              {["File", "Account", "Status", "Rows", "Duplicates", "Imported", "Action"].map(
                (head) => (
                  <th key={head} className="py-2 pr-4">
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-t border-[var(--border)]">
                <td className="py-3 pr-4">{batch.originalFilename}</td>
                <td className="py-3 pr-4">{batch.account.name}</td>
                <td className="py-3 pr-4">
                  <Pill
                    tone={
                      batch.status === "FAILED"
                        ? "bad"
                        : batch.status === "UNDONE"
                          ? "warn"
                          : "info"
                    }
                  >
                    {batchStatusLabels[batch.status] ?? batch.status}
                  </Pill>
                </td>
                <td className="py-3 pr-4">{batch.totalRowCount}</td>
                <td className="py-3 pr-4">{batch.duplicateCandidateCount}</td>
                <td className="py-3 pr-4">{batch.importedTransactionCount}</td>
                <td className="py-3 pr-4">
                  {["IMPORTED", "PARTIALLY_IMPORTED"].includes(batch.status) ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1 text-xs font-semibold"
                      onClick={() => onUndo(batch.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Undo import
                    </button>
                  ) : (
                    <span className="text-[var(--muted)]">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TransferReviewPanel({
  matches,
  transactions,
  onScan,
  onOpen,
  onConfirm,
  onReject,
  onManual,
  error,
  pendingMatchId,
}: {
  matches: TransferMatchDto[];
  transactions: TransactionDto[];
  onScan: () => void;
  onOpen: (id: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onManual: (outgoingTransactionId: string, incomingTransactionId: string) => void;
  error: string;
  pendingMatchId: string;
}) {
  const suggestions = matches.filter((match) => match.status === "SUGGESTED");
  const confirmed = matches.filter((match) => match.status === "CONFIRMED");
  const [manualOut, setManualOut] = useState("");
  const [manualIn, setManualIn] = useState("");
  const candidates = transactions.filter((transaction) => transaction.amountMinor !== 0);
  const selectedOut = candidates.find((transaction) => transaction.id === manualOut);
  const eligibleIncoming = selectedOut
    ? candidates.filter(
        (transaction) =>
          transaction.amountMinor > 0 &&
          Math.abs(transaction.amountMinor) === Math.abs(selectedOut.amountMinor) &&
          transaction.account.name !== selectedOut.account.name &&
          Math.abs(daysBetween(transaction.transactionDate, selectedOut.transactionDate)) <= 7,
      )
    : candidates.filter((transaction) => transaction.amountMinor > 0);
  const selectedIn = candidates.find((transaction) => transaction.id === manualIn);
  const manualEligible =
    Boolean(selectedOut && selectedIn) &&
    eligibleIncoming.some((transaction) => transaction.id === selectedIn?.id);
  return (
    <div id="transfer-review" className="scroll-mt-6">
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[var(--teal)]" />
              <h2 className="text-lg font-semibold">Transfer Review</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Review internal movements before they affect household income or spending.
            </p>
          </div>
          <Button variant="secondary" onClick={onScan}>
            Scan transfers
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryLine label="Suggested" value={String(suggestions.length)} />
          <SummaryLine label="Confirmed" value={String(confirmed.length)} />
          <SummaryLine
            label="Credit-card payment candidates"
            value={String(
              suggestions.filter((match) => match.incomingTransaction.account.type === "CREDIT")
                .length,
            )}
          />
        </div>
        {suggestions.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr>
                  {["Confidence", "Amount", "Accounts", "Dates", "Reasons", "Actions"].map(
                    (head) => (
                      <th key={head} className="py-3 pr-4">
                        {head}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {suggestions.map((match) => (
                  <tr key={match.id} className="border-t border-[var(--border)]">
                    <td className="py-3 pr-4">
                      <Pill tone={match.confidence === "HIGH" ? "good" : "warn"}>
                        {match.confidence} {match.score}
                      </Pill>
                    </td>
                    <td className="py-3 pr-4 font-semibold">
                      {formatMoney(Math.abs(match.outgoingTransaction.amountMinor))}
                    </td>
                    <td className="py-3 pr-4">
                      {match.outgoingTransaction.account.name} to{" "}
                      {match.incomingTransaction.account.name}
                      {match.incomingTransaction.account.type === "CREDIT" ? (
                        <div className="text-xs font-semibold text-[var(--blue)]">
                          Credit-card payment candidate
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">
                      {shortDate(match.outgoingTransaction.transactionDate)} /{" "}
                      {shortDate(match.incomingTransaction.transactionDate)}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[var(--muted)]">
                      {match.reasons.slice(0, 3).join("; ")}
                      <div className="mt-1">
                        {match.outgoingTransaction.normalizedMerchant} vs.{" "}
                        {match.incomingTransaction.normalizedMerchant}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border px-3 py-1"
                          onClick={() => onOpen(match.outgoingTransactionId)}
                        >
                          Open outgoing
                        </button>
                        <button
                          className="rounded-md border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={pendingMatchId === match.id}
                          onClick={() => onConfirm(match.id)}
                        >
                          {pendingMatchId === match.id ? "Working..." : "Confirm transfer"}
                        </button>
                        <button
                          className="rounded-md border px-3 py-1 text-[var(--red)] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={pendingMatchId === match.id}
                          onClick={() => onReject(match.id)}
                        >
                          {pendingMatchId === match.id ? "Working..." : "Reject suggestion"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-md border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
            No suggested transfer pairs. Run a scan after importing or editing transactions.
          </p>
        )}
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <h3 className="font-semibold">Manual match</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Choose one money-out transaction and one money-in transaction with the same absolute
            amount, different accounts, and dates within seven days.
          </p>
          {error ? (
            <div role="alert" className="mt-3 rounded-md bg-[var(--red-soft)] p-3 text-sm">
              {error}
            </div>
          ) : null}
          <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              aria-label="Manual outgoing transaction"
              className="h-10 min-w-0 max-w-full rounded-md border border-[var(--border)] px-3"
              value={manualOut}
              onChange={(event) => {
                setManualOut(event.target.value);
                setManualIn("");
              }}
            >
              <option value="">Outgoing transaction</option>
              {candidates
                .filter((transaction) => transaction.amountMinor < 0)
                .map((transaction) => (
                  <option key={transaction.id} value={transaction.id}>
                    {shortDate(transaction.transactionDate)} {transaction.account.name}{" "}
                    {formatMoney(transaction.amountMinor)} {transaction.normalizedMerchant}
                  </option>
                ))}
            </select>
            <select
              aria-label="Manual incoming transaction"
              className="h-10 min-w-0 max-w-full rounded-md border border-[var(--border)] px-3"
              value={manualIn}
              onChange={(event) => setManualIn(event.target.value)}
            >
              <option value="">Incoming transaction</option>
              {eligibleIncoming.map((transaction) => (
                <option key={transaction.id} value={transaction.id}>
                  {shortDate(transaction.transactionDate)} {transaction.account.name}{" "}
                  {formatMoney(transaction.amountMinor)} {transaction.normalizedMerchant}
                </option>
              ))}
            </select>
            <button
              className="h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!manualEligible || Boolean(pendingMatchId)}
              onClick={() => onManual(manualOut, manualIn)}
            >
              {pendingMatchId ? "Working..." : "Create manual match"}
            </button>
          </div>
          {selectedOut && !eligibleIncoming.length ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No eligible incoming transactions match the selected amount, account, and date window.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function ImportDialog({
  accounts,
  profiles,
  initialAccountId,
  onClose,
  onRequestUndo,
  onComplete,
}: {
  accounts: AccountDto[];
  profiles: ProfileDto[];
  initialAccountId?: string;
  onClose: () => void;
  onRequestUndo: (batchId: string) => void;
  onComplete: () => void;
}) {
  const firstAccount =
    accounts.find((account) => account.id === initialAccountId)?.id ?? accounts[0]?.id ?? "";
  const [step, setStep] = useState(1);
  const [accountId, setAccountId] = useState(firstAccount);
  const [profileId, setProfileId] = useState("");
  const [file, setFile] = useState<{ name: string; size: number; content: string } | null>(null);
  const [batch, setBatch] = useState<BatchDto | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowRepeated, setAllowRepeated] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "IMPORT" | "SKIP" | "REVIEW">>({});
  const [mapping, setMapping] = useState<Mapping>({
    saveProfile: false,
    delimiter: ",",
    encoding: "UTF-8",
    hasHeader: true,
    dateColumn: "",
    postedDateColumn: "",
    descriptionColumn: "",
    merchantColumn: "",
    amountMode: "SIGNED_AMOUNT",
    amountColumn: "",
    debitColumn: "",
    creditColumn: "",
    dateFormat: "MM/DD/YYYY",
    decimalSeparator: ".",
    thousandsSeparator: ",",
    signConvention: "DEBITS_NEGATIVE",
    currency: "USD",
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summary = useMemo(() => parseSummary(batch), [batch]);
  const headers = summary.headers ?? [];

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function applyProfile(id: string) {
    setProfileId(id);
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setMapping({
      name: profile.name,
      saveProfile: false,
      delimiter: profile.delimiter,
      encoding: profile.encoding,
      hasHeader: profile.hasHeader,
      dateColumn: profile.dateColumn,
      postedDateColumn: profile.postedDateColumn ?? "",
      descriptionColumn: profile.descriptionColumn,
      merchantColumn: profile.merchantColumn ?? "",
      amountMode: profile.amountMode,
      amountColumn: profile.amountColumn ?? "",
      debitColumn: profile.debitColumn ?? "",
      creditColumn: profile.creditColumn ?? "",
      dateFormat: profile.dateFormat,
      decimalSeparator: profile.decimalSeparator,
      thousandsSeparator: profile.thousandsSeparator,
      signConvention: profile.signConvention,
      currency: profile.currency,
    });
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError("");
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are supported.");
      return;
    }
    const content = await selected.text();
    setFile({ name: selected.name, size: selected.size, content });
  }

  async function preview() {
    if (!file) return;
    setBusy(true);
    setError("");
    const response = await postJson("/api/imports/preview", {
      accountId,
      filename: file.name,
      fileSize: file.size,
      content: file.content,
      delimiter: mapping.delimiter,
      encoding: mapping.encoding,
      hasHeader: mapping.hasHeader,
      profileId: profileId || null,
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setBatch(response.batch);
    const nextHeaders = parseSummary(response.batch).headers ?? [];
    setMapping((current) => ({
      ...current,
      dateColumn: current.dateColumn || findHeader(nextHeaders, ["date", "transaction date"]),
      postedDateColumn:
        current.postedDateColumn || findHeader(nextHeaders, ["posted", "post date"]),
      descriptionColumn:
        current.descriptionColumn || findHeader(nextHeaders, ["description", "memo", "details"]),
      merchantColumn: current.merchantColumn || findHeader(nextHeaders, ["merchant", "payee"]),
      amountColumn: current.amountColumn || findHeader(nextHeaders, ["amount"]),
      debitColumn: current.debitColumn || findHeader(nextHeaders, ["debit", "withdrawal"]),
      creditColumn: current.creditColumn || findHeader(nextHeaders, ["credit", "deposit"]),
    }));
    setStep(3);
  }

  async function validate() {
    if (!file) return;
    setBusy(true);
    setError("");
    const response = await postJson("/api/imports/validate", {
      batchId: batch?.id,
      accountId,
      filename: file.name,
      fileSize: file.size,
      content: file.content,
      delimiter: mapping.delimiter,
      encoding: mapping.encoding,
      hasHeader: mapping.hasHeader,
      profileId: profileId || null,
      mapping,
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setBatch(response.batch);
    const initial: Record<string, "IMPORT" | "SKIP" | "REVIEW"> = {};
    response.batch.rows.forEach((row: ImportRowDto) => {
      initial[row.id] = row.importDecision;
    });
    setDecisions(initial);
    setStep(6);
  }

  async function confirm() {
    if (!batch) return;
    const unresolvedDuplicateRows = batch.rows.filter(
      (row) =>
        row.validationStatus !== "INVALID" &&
        row.duplicateStatus !== "NONE" &&
        (decisions[row.id] ?? row.importDecision) === "REVIEW",
    );
    if (unresolvedDuplicateRows.length) {
      setError(
        `Choose Import or Skip for every duplicate candidate before confirming. Unresolved rows: ${unresolvedDuplicateRows.map((row) => row.rowNumber).join(", ")}.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    const response = await postJson("/api/imports/confirm", {
      batchId: batch.id,
      decisions: Object.entries(decisions).map(([rowId, decision]) => ({ rowId, decision })),
      allowRepeatedFile: allowRepeated,
      confirm: "IMPORT CSV",
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setBatch(response.batch);
    setStep(9);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-6" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-[var(--surface)] shadow-[var(--shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <h2 id="import-title" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
              CSV Transaction Import
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Preview, map, validate, and confirm before transactions are written.
            </p>
          </div>
          <button
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <ol className="grid grid-cols-3 gap-2 border-b border-[var(--border)] p-4 text-xs font-semibold md:grid-cols-9">
          {[
            "Account",
            "File",
            "Preview",
            "Mapping",
            "Parsing",
            "Review",
            "Confirm",
            "Import",
            "Summary",
          ].map((label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? "step" : undefined}
              className={`rounded-md px-2 py-2 ${step >= index + 1 ? "bg-[var(--teal)] text-white" : "bg-[var(--surface-muted)] text-[var(--muted)]"}`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
        {error ? (
          <div
            role="alert"
            className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto p-5">
          {step <= 2 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-lg font-semibold">1. Select Account</h3>
                <label className="block text-sm text-[var(--muted)]">
                  Destination account
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-sm text-[var(--muted)]">
                  Reusable profile
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
                    value={profileId}
                    onChange={(event) => applyProfile(event.target.value)}
                  >
                    <option value="">No profile</option>
                    {profiles
                      .filter((profile) => !profile.archivedAt)
                      .map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                  </select>
                </label>
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-lg font-semibold">2. Select File</h3>
                <label
                  className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--teal)] p-5 text-center focus-within:ring-2 focus-within:ring-[var(--teal)]"
                  tabIndex={0}
                >
                  <Upload className="mb-3 h-7 w-7 text-[var(--teal)]" />
                  <span className="font-semibold">{file ? file.name : "Choose synthetic CSV"}</span>
                  <span className="text-sm text-[var(--muted)]">
                    {file
                      ? `${Math.round(file.size / 1024)} KB selected`
                      : "UTF-8 CSV up to 512 KB"}
                  </span>
                  <input className="sr-only" type="file" accept=".csv,text/csv" onChange={onFile} />
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Delimiter"
                    value={mapping.delimiter}
                    values={[",", ";", "\t"]}
                    onChange={(delimiter) => setMapping({ ...mapping, delimiter })}
                  />
                  <Select
                    label="Encoding"
                    value={mapping.encoding}
                    values={["UTF-8", "UTF-8-BOM"]}
                    onChange={(encoding) => setMapping({ ...mapping, encoding })}
                  />
                  <label className="flex items-end gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mapping.hasHeader}
                      onChange={(event) =>
                        setMapping({ ...mapping, hasHeader: event.target.checked })
                      }
                    />
                    Header row
                  </label>
                </div>
                <div className="mt-5">
                  <Button onClick={preview} disabled={!file || !accountId || busy}>
                    Preview CSV
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}
          {step >= 3 && step <= 5 ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
              <PreviewTable batch={batch} />
              <Card className="p-5">
                <h3 className="mb-4 text-lg font-semibold">Mapping And Parsing</h3>
                <div className="grid gap-3">
                  <ColumnSelect
                    label="Date column"
                    value={mapping.dateColumn}
                    headers={headers}
                    onChange={(dateColumn) => setMapping({ ...mapping, dateColumn })}
                  />
                  <ColumnSelect
                    label="Posted date column"
                    value={mapping.postedDateColumn ?? ""}
                    headers={headers}
                    optional
                    onChange={(postedDateColumn) => setMapping({ ...mapping, postedDateColumn })}
                  />
                  <ColumnSelect
                    label="Description column"
                    value={mapping.descriptionColumn}
                    headers={headers}
                    onChange={(descriptionColumn) => setMapping({ ...mapping, descriptionColumn })}
                  />
                  <ColumnSelect
                    label="Merchant column"
                    value={mapping.merchantColumn ?? ""}
                    headers={headers}
                    optional
                    onChange={(merchantColumn) => setMapping({ ...mapping, merchantColumn })}
                  />
                  <Select
                    label="Amount mode"
                    value={mapping.amountMode}
                    values={["SIGNED_AMOUNT", "DEBIT_CREDIT_COLUMNS"]}
                    labels={amountModeLabels}
                    onChange={(amountMode) => setMapping({ ...mapping, amountMode })}
                  />
                  {mapping.amountMode === "SIGNED_AMOUNT" ? (
                    <ColumnSelect
                      label="Amount column"
                      value={mapping.amountColumn ?? ""}
                      headers={headers}
                      onChange={(amountColumn) => setMapping({ ...mapping, amountColumn })}
                    />
                  ) : (
                    <>
                      <ColumnSelect
                        label="Debit column"
                        value={mapping.debitColumn ?? ""}
                        headers={headers}
                        onChange={(debitColumn) => setMapping({ ...mapping, debitColumn })}
                      />
                      <ColumnSelect
                        label="Credit column"
                        value={mapping.creditColumn ?? ""}
                        headers={headers}
                        onChange={(creditColumn) => setMapping({ ...mapping, creditColumn })}
                      />
                    </>
                  )}
                  <Select
                    label="Date format"
                    value={mapping.dateFormat}
                    values={dateFormats}
                    labels={dateFormatLabels}
                    onChange={(dateFormat) => setMapping({ ...mapping, dateFormat })}
                  />
                  <Select
                    label="Decimal separator"
                    value={mapping.decimalSeparator}
                    values={[".", ","]}
                    onChange={(decimalSeparator) => setMapping({ ...mapping, decimalSeparator })}
                  />
                  <Select
                    label="Thousands separator"
                    value={mapping.thousandsSeparator}
                    values={[",", ".", " ", ""]}
                    onChange={(thousandsSeparator) =>
                      setMapping({ ...mapping, thousandsSeparator })
                    }
                  />
                  <Select
                    label="Sign convention"
                    value={mapping.signConvention}
                    values={["DEBITS_NEGATIVE", "DEBITS_POSITIVE"]}
                    labels={signConventionLabels}
                    onChange={(signConvention) => setMapping({ ...mapping, signConvention })}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mapping.saveProfile}
                      onChange={(event) =>
                        setMapping({ ...mapping, saveProfile: event.target.checked })
                      }
                    />
                    Save reusable profile
                  </label>
                  {mapping.saveProfile ? (
                    <input
                      aria-label="Profile name"
                      className="h-10 rounded-md border border-[var(--border)] px-3"
                      value={mapping.name ?? ""}
                      onChange={(event) => setMapping({ ...mapping, name: event.target.value })}
                      placeholder="Profile name"
                    />
                  ) : null}
                </div>
                <div className="mt-5">
                  <Button onClick={validate} disabled={busy}>
                    Validate rows
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}
          {step >= 6 && step <= 8 ? (
            <div className="space-y-5">
              <ValidationSummary batch={batch} />
              <div
                role="status"
                aria-label="Date interpretation"
                className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"
              >
                <span className="font-semibold">Date interpretation:</span>{" "}
                {dateFormatLabels[mapping.dateFormat] ?? mapping.dateFormat}. Valid dates matching
                this selection are accepted without individual ambiguity warnings.
              </div>
              {batch?.rows.some(
                (row) =>
                  row.duplicateStatus === "EXACT_OVERLAP" &&
                  (decisions[row.id] ?? row.importDecision) === "SKIP",
              ) ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Exact overlaps are preselected to Skip. They remain visible below and will only be
                  skipped after you confirm this batch.
                </div>
              ) : null}
              {batch?.rows.some(
                (row) =>
                  row.validationStatus !== "INVALID" &&
                  row.duplicateStatus !== "NONE" &&
                  (decisions[row.id] ?? row.importDecision) === "REVIEW",
              ) ? (
                <div
                  role="alert"
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  Ambiguous duplicate matches still need your decision. Choose Import or Skip for
                  each highlighted candidate before confirming.
                </div>
              ) : null}
              {batch?.repeatedFile ? (
                <div
                  role="alert"
                  className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  Exact file repeat warning: this same file was already imported for this account.
                  Confirming can create duplicate transactions. Import is blocked until you
                  explicitly override it.
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      checked={allowRepeated}
                      onChange={(event) => setAllowRepeated(event.target.checked)}
                      type="checkbox"
                    />
                    I understand this is the exact same file and want to import it anyway.
                  </label>
                </div>
              ) : null}
              <ReviewRows batch={batch} decisions={decisions} setDecisions={setDecisions} />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep(3);
                  }}
                >
                  Back to mapping
                </Button>
                <Button
                  onClick={confirm}
                  disabled={
                    busy ||
                    (batch?.repeatedFile && !allowRepeated) ||
                    Boolean(
                      batch?.rows.some(
                        (row) =>
                          row.validationStatus !== "INVALID" &&
                          row.duplicateStatus !== "NONE" &&
                          (decisions[row.id] ?? row.importDecision) === "REVIEW",
                      ),
                    )
                  }
                >
                  {batch?.rows.some(
                    (row) =>
                      row.validationStatus !== "INVALID" &&
                      (decisions[row.id] ?? row.importDecision) === "IMPORT",
                  )
                    ? "Confirm import"
                    : "Confirm no new transactions"}
                </Button>
              </div>
            </div>
          ) : null}
          {step === 9 && batch ? (
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-[var(--green)]" />
                <h3 className="text-2xl font-semibold">Import Summary</h3>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <SummaryLine label="Imported" value={String(batch.importedTransactionCount)} />
                <SummaryLine label="Skipped" value={String(summary.skippedCount ?? 0)} />
                <SummaryLine
                  label="Exact overlaps skipped"
                  value={String(summary.exactOverlapSkippedCount ?? 0)}
                />
                <SummaryLine label="Invalid" value={String(batch.rejectedRowCount)} />
                <SummaryLine
                  label="Duplicate candidates"
                  value={String(batch.duplicateCandidateCount)}
                />
                <SummaryLine label="Account" value={batch.account.name} />
                <SummaryLine label="Batch" value={batch.originalFilename} />
                <SummaryLine
                  label="Matched by merchant rules"
                  value={String(summary.ruleMatchedCount ?? 0)}
                />
                <SummaryLine
                  label="Rule conflicts"
                  value={String(summary.ruleConflictCount ?? 0)}
                />
                <SummaryLine
                  label="Merchants normalized by rules"
                  value={String(summary.ruleMerchantNormalizedCount ?? 0)}
                />
                <SummaryLine
                  label="Categories assigned by rules"
                  value={String(summary.ruleCategoryAssignedCount ?? 0)}
                />
                <SummaryLine
                  label="Still needs review"
                  value={String(summary.stillNeedsReview ?? batch.importedTransactionCount)}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={onComplete}>
                  {batch.importedTransactionCount ? "View imported transactions" : "Done"}
                </Button>
                {["IMPORTED", "PARTIALLY_IMPORTED"].includes(batch.status) ? (
                  <Button variant="secondary" onClick={() => onRequestUndo(batch.id)}>
                    Undo import
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function BulkActionBar({
  selectedIds,
  transactions,
  categories,
  onClear,
  onComplete,
}: {
  selectedIds: string[];
  transactions: TransactionDto[];
  categories: CategoryDto[];
  onClear: () => void;
  onComplete: (message: string) => void;
}) {
  const [action, setAction] = useState("MARK_REVIEWED");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const needsValue =
    action === "ASSIGN_CATEGORY" || action === "SET_TYPE" || action === "NORMALIZE_MERCHANT";
  async function apply() {
    const reportingImpact = ["EXCLUDE", "RESTORE", "SET_TYPE"].includes(action);
    if (
      reportingImpact &&
      !window.confirm(
        `${action.replaceAll("_", " ")} ${selectedIds.length} explicitly selected transaction(s) on this page?`,
      )
    )
      return;
    setPending(true);
    setError("");
    const response = await fetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionIds: selectedIds,
        action,
        value: needsValue ? value : undefined,
        confirmation: reportingImpact ? "CONFIRM BULK CHANGE" : undefined,
      }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "Bulk action failed; nothing was changed.");
      return;
    }
    onComplete(
      `Bulk action complete: ${body.changed ?? body.applied ?? 0} changed, ${body.skipped ?? 0} skipped.`,
    );
  }
  async function createRule() {
    const first = transactions.find((transaction) => selectedIds.includes(transaction.id));
    if (!first) return;
    const name = window.prompt("Rule name", `${first.normalizedMerchant} rule`);
    if (!name) return;
    const response = await fetch("/api/merchant-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule: {
          name,
          priority: 100,
          active: true,
          matchField: "ORIGINAL_DESCRIPTION",
          matchType: "CONTAINS",
          pattern: first.originalDescription,
          normalizedMerchant: first.normalizedMerchant,
          categoryId: first.categoryId ?? null,
          transactionType: null,
          markReviewed: false,
          notes: "Created from explicitly selected transactions.",
        },
        applyExisting: false,
      }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Rule could not be created.");
    else onComplete("Merchant rule saved for future eligible transactions.");
  }
  return (
    <Card className="mb-4 border-[var(--teal)] p-4" aria-label="Bulk actions">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <strong>{selectedIds.length} selected</strong>
          <p className="text-xs text-[var(--muted)]">Explicit rows on the current page only.</p>
        </div>
        <Select
          label="Bulk action"
          value={action}
          values={[
            "ASSIGN_CATEGORY",
            "MARK_REVIEWED",
            "MARK_NEEDS_REVIEW",
            "EXCLUDE",
            "RESTORE",
            "SET_TYPE",
            "NORMALIZE_MERCHANT",
            "REAPPLY_RULES",
          ]}
          labels={{
            ASSIGN_CATEGORY: "Assign category",
            MARK_REVIEWED: "Mark reviewed",
            MARK_NEEDS_REVIEW: "Mark needs review",
            EXCLUDE: "Exclude from reports",
            RESTORE: "Restore to reports",
            SET_TYPE: "Set safe transaction type",
            NORMALIZE_MERCHANT: "Normalize merchant",
            REAPPLY_RULES: "Reapply merchant rules",
          }}
          onChange={(next) => {
            setAction(next);
            setValue("");
          }}
        />
        {action === "ASSIGN_CATEGORY" ? (
          <Select
            label="Resulting category"
            value={value}
            values={["", ...categories.map((category) => category.id)]}
            labels={{
              "": "Choose category",
              ...Object.fromEntries(categories.map((category) => [category.id, category.name])),
            }}
            onChange={setValue}
          />
        ) : null}
        {action === "SET_TYPE" ? (
          <Select
            label="Resulting type"
            value={value}
            values={[
              "",
              "DEBIT",
              "CREDIT",
              "INCOME",
              "EXPENSE",
              "REFUND",
              "FEE",
              "INTEREST",
              "UNKNOWN",
              "OTHER",
            ]}
            labels={{ "": "Choose type", ...transactionTypeLabels }}
            onChange={setValue}
          />
        ) : null}
        {action === "NORMALIZE_MERCHANT" ? (
          <TextFilter label="Resulting merchant" type="text" value={value} onChange={setValue} />
        ) : null}
        <Button onClick={apply} disabled={pending || (needsValue && !value)}>
          {pending ? "Applying…" : "Apply to selected"}
        </Button>
        <Button variant="secondary" onClick={createRule} disabled={pending}>
          Create merchant rule
        </Button>
        <Button variant="secondary" onClick={onClear}>
          Clear selection
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--red)]">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function TransactionFilters({
  filters,
  accounts,
  categories,
  onChange,
}: {
  filters: TransactionQuery;
  accounts: AccountDto[];
  categories: CategoryDto[];
  onChange: (key: keyof TransactionQuery, value: string) => void;
}) {
  const [more, setMore] = useState(false);
  const secondary = [
    "source",
    "amountMin",
    "amountMax",
    "type",
    "excluded",
    "transfer",
    "recurring",
  ] as const;
  const active = secondary.filter(
    (key) => filters[key] !== undefined && filters[key] !== "" && filters[key] !== "all",
  );
  return (
    <Card className="mb-4 p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
        <label className="block text-sm text-[var(--muted)]">
          Search transactions
          <input
            className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
            placeholder="Merchant, original text, account, category, or file"
            value={filters.q}
            onChange={(event) => onChange("q", event.target.value)}
          />
        </label>
        <Select
          label="Account"
          value={filters.account}
          values={["", ...accounts.map((account) => account.id)]}
          labels={{ "": "All accounts" }}
          onChange={(value) => onChange("account", value)}
        />
        <Select
          label="Category"
          value={filters.category}
          values={["", "uncategorized", ...categories.map((category) => category.id)]}
          labels={{
            "": "All categories",
            uncategorized: "Uncategorized",
            ...Object.fromEntries(categories.map((category) => [category.id, category.name])),
          }}
          onChange={(value) => onChange("category", value)}
        />
        <Select
          label="Status"
          value={filters.status ?? ""}
          values={["", ...Object.keys(reviewStatusLabels)]}
          labels={{ "": "All statuses", ...reviewStatusLabels }}
          onChange={(value) => onChange("status", value)}
        />
        <Select
          label="Date / period"
          value={filters.period}
          values={[
            "ALL",
            "CURRENT_MONTH",
            "PREVIOUS_MONTH",
            "THIS_QUARTER",
            "PREVIOUS_QUARTER",
            "THIS_YEAR",
            "PREVIOUS_YEAR",
            "CUSTOM",
          ]}
          labels={{
            ALL: "All dates",
            CURRENT_MONTH: "Current financial month",
            PREVIOUS_MONTH: "Previous financial month",
            THIS_QUARTER: "This quarter",
            PREVIOUS_QUARTER: "Previous quarter",
            THIS_YEAR: "This year",
            PREVIOUS_YEAR: "Previous year",
            CUSTOM: "Custom range",
          }}
          onChange={(value) => onChange("period", value)}
        />
        <Select
          label="Type"
          value={filters.type ?? ""}
          values={["", ...Object.keys(transactionTypeLabels)]}
          labels={{ "": "All types", ...transactionTypeLabels }}
          onChange={(value) => onChange("type", value)}
        />
        <Select
          label="Source"
          value={filters.source ?? ""}
          values={["", ...Object.keys(sourceTypeLabels)]}
          labels={{ "": "All sources", ...sourceTypeLabels }}
          onChange={(value) => onChange("source", value)}
        />
        <Select
          label="Rows"
          value={String(filters.pageSize)}
          values={["25", "50", "100"]}
          onChange={(value) => onChange("pageSize", value)}
        />
      </div>
      {filters.period === "CUSTOM" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextFilter
            label="From"
            type="date"
            value={filters.from ?? ""}
            onChange={(v) => onChange("from", v)}
          />
          <TextFilter
            label="To"
            type="date"
            value={filters.to ?? ""}
            onChange={(v) => onChange("to", v)}
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setMore(!more)} aria-expanded={more}>
          <SlidersHorizontal className="h-4 w-4" /> More filters ({active.length})
        </Button>
        {active.map((key) => (
          <button
            key={key}
            className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold"
            onClick={() =>
              onChange(
                key,
                key === "excluded" || key === "transfer" || key === "recurring" ? "all" : "",
              )
            }
          >
            {filterLabel(key, filters[key])} ×
          </button>
        ))}
        <a href="/transactions?period=ALL" className="text-sm font-semibold text-[var(--teal)]">
          Clear all
        </a>
      </div>
      {more ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextFilter
            label="Minimum amount (minor units)"
            type="number"
            value={filters.amountMin?.toString() ?? ""}
            onChange={(v) => onChange("amountMin", v)}
          />
          <TextFilter
            label="Maximum amount (minor units)"
            type="number"
            value={filters.amountMax?.toString() ?? ""}
            onChange={(v) => onChange("amountMax", v)}
          />
          <Select
            label="Excluded"
            value={filters.excluded}
            values={["all", "included", "excluded"]}
            labels={{ all: "All", included: "Included", excluded: "Excluded" }}
            onChange={(v) => onChange("excluded", v)}
          />
          <Select
            label="Transfer state"
            value={filters.transfer}
            values={["all", "confirmed", "suggested", "unmatched", "none"]}
            labels={{
              all: "All",
              confirmed: "Confirmed transfer",
              suggested: "Suggested transfer",
              unmatched: "Unmatched candidate",
              none: "Not a transfer",
            }}
            onChange={(v) => onChange("transfer", v)}
          />
          <Select
            label="Recurring link"
            value={filters.recurring}
            values={["all", "confirmed", "suggested", "none"]}
            labels={{
              all: "All",
              confirmed: "Confirmed recurring",
              suggested: "Suggested recurring",
              none: "Not linked",
            }}
            onChange={(v) => onChange("recurring", v)}
          />
          <Select
            label="Sort"
            value={`${filters.sort}:${filters.direction}`}
            values={["date:desc", "date:asc", "amount:desc", "amount:asc", "merchant:asc"]}
            labels={{
              "date:desc": "Newest first",
              "date:asc": "Oldest first",
              "amount:desc": "Amount high to low",
              "amount:asc": "Amount low to high",
              "merchant:asc": "Merchant A–Z",
            }}
            onChange={(v) => {
              const [sort, direction] = v.split(":");
              onChange("sort", sort);
              setTimeout(() => onChange("direction", direction), 0);
            }}
          />
        </div>
      ) : null}
    </Card>
  );
}

function SavedViews({
  views,
  query,
  navigate,
  announce,
}: {
  views: { id: string; name: string; queryJson: string; isDefault: boolean }[];
  query: TransactionQuery;
  navigate: (query: TransactionQuery) => void;
  announce: (message: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  async function create() {
    const name = window.prompt("Name this saved view");
    if (!name) return;
    setPending("create");
    const response = await fetch("/api/transaction-saved-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, query }),
    });
    const body = await response.json();
    announce(
      response.ok ? "Saved view created." : (body.error ?? "Saved view could not be created."),
    );
    setPending("");
    if (response.ok) router.refresh();
  }
  async function patch(id: string, data: Record<string, unknown>, message: string) {
    setPending(id);
    const response = await fetch(`/api/transaction-saved-views/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    announce(response.ok ? message : (body.error ?? "Saved view action failed."));
    setPending("");
    if (response.ok) router.refresh();
  }
  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <SlidersHorizontal className="h-4 w-4" /> Saved Views
      </Button>
      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-[min(92vw,420px)] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
          <Button onClick={create} disabled={!!pending}>
            Save current view
          </Button>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {views.length ? (
              views.map((view) => (
                <div key={view.id} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <strong>{view.name}</strong>
                    {view.isDefault ? <Pill tone="info">Default</Pill> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="font-semibold text-[var(--teal)]"
                      onClick={() => navigate(parseSavedQueryClient(view.queryJson))}
                    >
                      Apply
                    </button>
                    <button
                      disabled={pending === view.id}
                      onClick={() => {
                        const name = window.prompt("Rename saved view", view.name);
                        if (name) patch(view.id, { name }, "Saved view renamed.");
                      }}
                    >
                      Rename
                    </button>
                    <button
                      disabled={pending === view.id}
                      onClick={() => patch(view.id, { query }, "Saved view updated.")}
                    >
                      Update
                    </button>
                    <button
                      disabled={pending === view.id}
                      onClick={() =>
                        patch(
                          view.id,
                          { isDefault: !view.isDefault },
                          view.isDefault ? "Default removed." : "Default view set.",
                        )
                      }
                    >
                      {view.isDefault ? "Remove default" : "Set default"}
                    </button>
                    <button
                      disabled={pending === view.id}
                      className="text-[var(--red)]"
                      onClick={() => {
                        if (window.confirm(`Delete saved view “${view.name}”?`))
                          patch(view.id, { isArchived: true }, "Saved view deleted.");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[var(--muted)]">No saved views yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseSavedQueryClient(json: string): TransactionQuery {
  try {
    return { ...queryDefaultsClient, ...JSON.parse(json), page: 1 };
  } catch {
    return queryDefaultsClient;
  }
}
const queryDefaultsClient: TransactionQuery = {
  q: "",
  account: "",
  category: "",
  period: "ALL",
  excluded: "all",
  transfer: "all",
  recurring: "all",
  sort: "date",
  direction: "desc",
  page: 1,
  pageSize: 25,
};

function TextFilter({
  label,
  value,
  type,
  onChange,
}: {
  label: string;
  value: string;
  type: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-[var(--muted)]">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function filterLabel(key: string, value: unknown) {
  return `${key.replace(/([A-Z])/g, " $1")}: ${String(value)}`;
}

function TransactionTable({
  transactions,
  transferMatches,
  open,
  totalCount,
  filteredCount,
  currentPage,
  totalPages,
  pageSize,
  onPage,
  onPageSize,
  selectedIds,
  onSelection,
}: {
  transactions: TransactionDto[];
  transferMatches: TransferMatchDto[];
  open: (transaction: TransactionDto) => void;
  totalCount: number;
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: string;
  onPage: (page: number) => void;
  onPageSize: (pageSize: string) => void;
  selectedIds: string[];
  onSelection: (ids: string[]) => void;
}) {
  const transferByTransaction = new Map<string, TransferMatchDto[]>();
  transferMatches.forEach((match) => {
    for (const id of [match.outgoingTransactionId, match.incomingTransactionId]) {
      transferByTransaction.set(id, [...(transferByTransaction.get(id) ?? []), match]);
    }
  });
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
        <div>
          <h2 className="text-lg font-semibold">Transactions</h2>
          <p className="text-sm text-[var(--muted)]">
            Showing {transactions.length ? (currentPage - 1) * Number(pageSize) + 1 : 0}-
            {Math.min(currentPage * Number(pageSize), filteredCount)} of {filteredCount} matching
            transactions ({totalCount} total).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="h-9 rounded-md border border-[var(--border)] px-3 text-sm disabled:opacity-50"
            disabled={currentPage <= 1}
            onClick={() => onPage(currentPage - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-[var(--muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="h-9 rounded-md border border-[var(--border)] px-3 text-sm disabled:opacity-50"
            disabled={currentPage >= totalPages}
            onClick={() => onPage(currentPage + 1)}
          >
            Next
          </button>
          <label className="sr-only" htmlFor="transaction-page-size">
            Rows per page
          </label>
          <select
            id="transaction-page-size"
            className="h-9 rounded-md border border-[var(--border)] px-2 text-sm"
            value={pageSize}
            onChange={(event) => onPageSize(event.target.value)}
          >
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
          </select>
        </div>
      </div>
      <div className="max-h-[680px] overflow-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-4">
                <input
                  type="checkbox"
                  aria-label="Select current page"
                  checked={
                    transactions.length > 0 &&
                    transactions.every((transaction) => selectedIds.includes(transaction.id))
                  }
                  onChange={(event) =>
                    onSelection(
                      event.target.checked ? transactions.map((transaction) => transaction.id) : [],
                    )
                  }
                />
              </th>
              {[
                "Date",
                "Merchant / Original",
                "Account",
                "Category",
                "Amount",
                "Status",
                "Source",
              ].map((h) => (
                <th key={h} className="px-4 py-4 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${transaction.normalizedMerchant}`}
                    checked={selectedIds.includes(transaction.id)}
                    onChange={(event) =>
                      onSelection(
                        event.target.checked
                          ? [...selectedIds, transaction.id]
                          : selectedIds.filter((id) => id !== transaction.id),
                      )
                    }
                  />
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(transaction.transactionDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left font-semibold"
                    onClick={() => open(transaction)}
                  >
                    {transaction.normalizedMerchant}
                  </button>
                  <div className="text-xs text-[var(--muted)]">
                    {transaction.originalDescription}
                  </div>
                  {transferByTransaction.get(transaction.id)?.length ? (
                    <div className="mt-1 text-xs font-semibold text-[var(--blue)]">
                      {transferByTransaction
                        .get(transaction.id)
                        ?.some((match) => match.status === "CONFIRMED")
                        ? "Internal transfer"
                        : "Transfer suggestion"}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{transaction.account.name}</td>
                <td className="px-4 py-3">
                  {transaction.category?.name ?? (
                    <span className="italic text-[var(--amber)]">Uncategorized</span>
                  )}
                </td>
                <td
                  className={
                    transaction.amountMinor > 0
                      ? "px-4 py-3 text-right font-semibold text-[var(--green)]"
                      : "px-4 py-3 text-right font-semibold"
                  }
                >
                  {formatMoney(transaction.amountMinor)}
                </td>
                <td className="px-4 py-3">
                  <Pill
                    tone={
                      transaction.type === "TRANSFER_IN" || transaction.type === "TRANSFER_OUT"
                        ? "info"
                        : transaction.reviewStatus === "REVIEWED"
                          ? "good"
                          : transaction.reviewStatus === "FLAGGED"
                            ? "bad"
                            : "warn"
                    }
                  >
                    {transaction.type === "TRANSFER_IN" || transaction.type === "TRANSFER_OUT"
                      ? transactionTypeLabels[transaction.type]
                      : (reviewStatusLabels[transaction.reviewStatus] ?? transaction.reviewStatus)}
                  </Pill>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {sourceTypeLabels[transaction.sourceType ?? "MANUAL"] ??
                    transaction.sourceType ??
                    "Manual"}
                </td>
              </tr>
            ))}
            {!transactions.length ? (
              <tr>
                <td className="px-4 py-8 text-center text-[var(--muted)]" colSpan={7}>
                  No transactions match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PreviewTable({ batch }: { batch: BatchDto | null }) {
  const summary = parseSummary(batch);
  const headers = summary.headers ?? [];
  const rows = summary.sampleRows ?? [];
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] p-5">
        <h3 className="text-lg font-semibold">CSV Preview</h3>
        <p className="text-sm text-[var(--muted)]">
          {batch
            ? `${batch.originalFilename} · ${batch.totalRowCount} rows · ${batch.encoding} · delimiter ${displayDelimiter(batch.delimiter)}`
            : "No preview yet"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr>
              {headers.map((header: string) => (
                <th key={header} className="px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: string[], index: number) => (
              <tr key={index} className="border-t border-[var(--border)]">
                {row.map((cell, cellIndex) => (
                  <td key={`${index}-${cellIndex}`} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ValidationSummary({ batch }: { batch: BatchDto | null }) {
  if (!batch) return null;
  const exactOverlaps = batch.rows.filter((row) => row.duplicateStatus === "EXACT_OVERLAP").length;
  const needsDecision = batch.rows.filter(
    (row) => row.duplicateStatus !== "NONE" && row.importDecision === "REVIEW",
  ).length;
  return (
    <Card className="grid gap-3 p-5 sm:grid-cols-5">
      <SummaryLine label="Ready to import" value={String(batch.acceptedRowCount)} />
      <SummaryLine label="Rejected" value={String(batch.rejectedRowCount)} />
      <SummaryLine label="Already exists" value={String(exactOverlaps)} />
      <SummaryLine label="Needs duplicate review" value={String(needsDecision)} />
      <SummaryLine label="Rows" value={String(batch.totalRowCount)} />
    </Card>
  );
}

function ReviewRows({
  batch,
  decisions,
  setDecisions,
}: {
  batch: BatchDto | null;
  decisions: Record<string, "IMPORT" | "SKIP" | "REVIEW">;
  setDecisions: (value: Record<string, "IMPORT" | "SKIP" | "REVIEW">) => void;
}) {
  if (!batch) return null;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              {["Row", "Description", "Amount", "Validation", "Duplicate", "Decision"].map(
                (head) => (
                  <th key={head} className="px-4 py-3">
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {batch.rows.map((row) => {
              const errors = parseErrors(row);
              return (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">{row.rowNumber}</td>
                  <td className="px-4 py-3">{row.originalDescription ?? "-"}</td>
                  <td className="px-4 py-3">
                    {row.parsedAmountMinor == null ? "-" : formatMoney(row.parsedAmountMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.validationStatus === "INVALID"
                          ? "bad"
                          : row.validationStatus === "WARNING"
                            ? "warn"
                            : "good"
                      }
                    >
                      {row.validationStatus === "VALID"
                        ? "Ready"
                        : row.duplicateStatus === "EXACT_OVERLAP"
                          ? "Already imported"
                          : row.validationStatus === "WARNING"
                            ? "Needs review"
                            : "Invalid"}
                    </Pill>
                    {errors.length ? (
                      <div className="mt-1 text-xs text-[var(--muted)]">{errors.join("; ")}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {duplicateLabel(row.duplicateStatus, row.duplicateReason)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Decision for row ${row.rowNumber}`}
                      className="h-9 rounded-md border border-[var(--border)] px-2"
                      disabled={row.validationStatus === "INVALID"}
                      value={decisions[row.id] ?? row.importDecision}
                      onChange={(event) =>
                        setDecisions({
                          ...decisions,
                          [row.id]: event.target.value as "IMPORT" | "SKIP" | "REVIEW",
                        })
                      }
                    >
                      {(["REVIEW", "IMPORT", "SKIP"] as const).map((decision) => (
                        <option key={decision} value={decision}>
                          {decisionLabels[decision]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TransactionDrawer({
  selected,
  form,
  categories,
  audit,
  transfers,
  transferNote,
  setTransferNote,
  onConfirm,
  onReject,
  onUnmatch,
  setSelected,
  setForm,
  save,
  pendingTransferActionId,
}: {
  selected: TransactionDto;
  form: {
    normalizedMerchant: string;
    categoryId: string;
    type: string;
    reviewStatus: string;
    excluded: boolean;
    notes: string;
  };
  categories: CategoryDto[];
  audit: AuditDto[];
  transfers: TransferMatchDto[];
  transferNote: string;
  setTransferNote: (value: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onUnmatch: (id: string) => void;
  setSelected: (value: TransactionDto | null) => void;
  setForm: (value: {
    normalizedMerchant: string;
    categoryId: string;
    type: string;
    reviewStatus: string;
    excluded: boolean;
    notes: string;
  }) => void;
  save: () => void;
  pendingTransferActionId: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setSelected(null)}>
      <aside
        data-testid="transaction-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-drawer-title"
        className="ml-auto h-full w-full max-w-[560px] overflow-y-auto bg-[var(--surface)] p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close transaction drawer"
          className="float-right rounded-full border border-[var(--teal)] px-3 py-1 text-[var(--teal)]"
          onClick={() => setSelected(null)}
        >
          x
        </button>
        <h2 id="transaction-drawer-title" className="text-2xl font-semibold">
          {selected.normalizedMerchant}
        </h2>
        <p className="mt-2 text-[var(--muted)]">
          Original imported values are immutable through this editor.
        </p>
        <div className="my-8 flex justify-between border-b border-[var(--border)] pb-6">
          <span className="text-[var(--muted)]">Parsed amount</span>
          <strong className="text-3xl">{formatMoney(selected.amountMinor)}</strong>
        </div>
        <Section
          title="Imported Data"
          rows={[
            ["Original description", selected.originalDescription],
            ["Original amount", selected.originalAmountText],
            ["Original date", selected.originalDateText],
            [
              "Source",
              `${sourceTypeLabels[selected.sourceType ?? "MANUAL"] ?? selected.sourceType ?? "Manual"}${selected.sourceRowNumber ? ` row ${selected.sourceRowNumber}` : ""}`,
            ],
          ]}
        />
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Editable Normalized Values
          </h3>
          <Field
            label="Merchant"
            value={form.normalizedMerchant}
            onChange={(normalizedMerchant) => setForm({ ...form, normalizedMerchant })}
          />
          <label className="block text-sm text-[var(--muted)]">
            Category
            <select
              className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            >
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-[var(--muted)]">
            Transaction type
            <select
              className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              {[
                "DEBIT",
                "CREDIT",
                "INCOME",
                "EXPENSE",
                "TRANSFER_OUT",
                "TRANSFER_IN",
                "REFUND",
                "FEE",
                "INTEREST",
                "UNKNOWN",
              ].map((type) => (
                <option key={type} value={type}>
                  {transactionTypeLabels[type] ?? type}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-[var(--muted)]">
            Review status
            <select
              className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
              value={form.reviewStatus}
              onChange={(event) => setForm({ ...form, reviewStatus: event.target.value })}
            >
              {["NEEDS_REVIEW", "REVIEWED", "FLAGGED"].map((value) => (
                <option key={value} value={value}>
                  {reviewStatusLabels[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.excluded}
              onChange={(event) => setForm({ ...form, excluded: event.target.checked })}
            />{" "}
            Exclude from summaries
          </label>
          <Field
            label="Notes"
            value={form.notes}
            onChange={(notes) => setForm({ ...form, notes })}
          />
        </div>
        <button
          className="mt-6 h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white"
          onClick={save}
        >
          Save transaction
        </button>
        <TransferDrawerSection
          selected={selected}
          transfers={transfers}
          note={transferNote}
          setNote={setTransferNote}
          onConfirm={onConfirm}
          onReject={onReject}
          onUnmatch={onUnmatch}
          pendingMatchId={pendingTransferActionId}
        />
        <Section
          title="Audit History"
          rows={
            audit.length
              ? audit.map((entry) => [
                  entry.field ?? entry.action,
                  `${entry.previousValue ?? "-"} -> ${entry.newValue ?? "-"} (${new Date(entry.createdAt).toLocaleString()})`,
                ])
              : [["No manual changes", "No audit records yet"]]
          }
        />
      </aside>
    </div>
  );
}

function TransferDrawerSection({
  selected,
  transfers,
  note,
  setNote,
  onConfirm,
  onReject,
  onUnmatch,
  pendingMatchId,
}: {
  selected: TransactionDto;
  transfers: TransferMatchDto[];
  note: string;
  setNote: (value: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onUnmatch: (id: string) => void;
  pendingMatchId: string;
}) {
  const confirmed = transfers.find((match) => match.status === "CONFIRMED");
  const suggestions = transfers.filter((match) => match.status === "SUGGESTED");
  return (
    <div className="mt-8 rounded-md border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        Transfer Matching
      </h3>
      {confirmed ? (
        <div className="mt-4">
          <Pill tone="good">Confirmed internal transfer</Pill>
          <p className="mt-3 text-sm">
            Counterpart: {counterpart(selected.id, confirmed).normalizedMerchant} on{" "}
            {counterpart(selected.id, confirmed).account.name}.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            This pair is excluded from household income and spending while remaining visible in
            account activity.
          </p>
          <label className="mt-3 block text-sm text-[var(--muted)]">
            Unmatch note
            <input
              className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            className="mt-3 rounded-md border border-[var(--red)] px-3 py-2 text-sm font-semibold text-[var(--red)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingMatchId === confirmed.id}
            onClick={() => onUnmatch(confirmed.id)}
          >
            {pendingMatchId === confirmed.id ? "Working..." : "Unmatch transfer"}
          </button>
        </div>
      ) : suggestions.length ? (
        <div className="mt-4 space-y-4">
          {suggestions.map((match) => {
            const other = counterpart(selected.id, match);
            return (
              <div key={match.id} className="rounded-md bg-[var(--surface-muted)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={match.confidence === "HIGH" ? "good" : "warn"}>
                    {match.confidence} {match.score}
                  </Pill>
                  <span className="text-sm font-semibold">{other.account.name}</span>
                  <span className="text-sm">{formatMoney(other.amountMinor)}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--muted)]">
                  {match.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm font-medium">
                  This will classify both transactions as an internal transfer and exclude them from
                  income and spending totals.
                </p>
                <label className="mt-3 block text-sm text-[var(--muted)]">
                  Transfer note
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pendingMatchId === match.id}
                    onClick={() => onConfirm(match.id)}
                  >
                    {pendingMatchId === match.id ? "Working..." : "Confirm transfer"}
                  </button>
                  <button
                    className="rounded-md border border-[var(--red)] px-3 py-2 text-sm font-semibold text-[var(--red)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pendingMatchId === match.id}
                    onClick={() => onReject(match.id)}
                  >
                    {pendingMatchId === match.id ? "Working..." : "Reject suggestion"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No active transfer suggestion for this transaction.
        </p>
      )}
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  values,
  labels = {},
  onChange,
}: {
  label: string;
  value: T;
  values: readonly T[];
  labels?: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block text-sm text-[var(--muted)]">
      {label}
      <select
        aria-label={label}
        className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {values.map((item) => (
          <option key={item || "blank"} value={item}>
            {labels[item] ?? (item || "None")}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColumnSelect({
  label,
  value,
  headers,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-[var(--muted)]">
      {label}
      <select
        className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {optional ? <option value="">None</option> : <option value="">Choose column</option>}
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-[var(--muted)]">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border border-[var(--border)] px-3 text-[var(--text)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Section({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="mt-8">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {title}
      </h3>
      <div className="space-y-3">
        {rows.map(([a, b]) => (
          <div key={`${title}-${a}`} className="flex justify-between gap-8 text-sm">
            <span className="text-[var(--muted)]">{a}</span>
            <code className="text-right">{b}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return response.ok
    ? { ok: true, ...json }
    : { ok: false, error: json.error ?? "Request failed." };
}

function undoCleanupWarning(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("summaryJson" in payload)) return "";
  const summaryJson = (payload as { summaryJson?: unknown }).summaryJson;
  if (typeof summaryJson !== "string") return "";
  try {
    const summary = JSON.parse(summaryJson) as { undoCleanupWarning?: unknown };
    return typeof summary.undoCleanupWarning === "string" ? summary.undoCleanupWarning : "";
  } catch {
    return "";
  }
}

function parseSummary(batch: BatchDto | null): {
  headers?: string[];
  sampleRows?: string[][];
  ruleMatchedCount?: number;
  ruleConflictCount?: number;
  ruleMerchantNormalizedCount?: number;
  ruleCategoryAssignedCount?: number;
  stillNeedsReview?: number;
  skippedCount?: number;
  exactOverlapSkippedCount?: number;
} {
  if (!batch?.summaryJson) return {};
  try {
    return JSON.parse(batch.summaryJson);
  } catch {
    return {};
  }
}

function parseErrors(row: ImportRowDto) {
  try {
    return JSON.parse(row.validationErrorsJson) as string[];
  } catch {
    return [];
  }
}

function duplicateLabel(status: string, reason?: string | null) {
  if (status === "NONE") return "No duplicate found";
  const label = duplicateStatusLabels[status] ?? "Possible duplicate transaction";
  return reason ? `${label}: ${reason}` : label;
}

function displayDelimiter(delimiter: string) {
  return delimiter === "\t" ? "tab" : delimiter;
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function daysBetween(a: string, b: string) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / dayMs);
}

function counterpart(transactionId: string, match: TransferMatchDto) {
  return match.outgoingTransactionId === transactionId
    ? match.incomingTransaction
    : match.outgoingTransaction;
}

function findHeader(headers: string[], candidates: string[]) {
  return (
    headers.find((header) =>
      candidates.some((candidate) => header.toLowerCase().includes(candidate)),
    ) ?? ""
  );
}
