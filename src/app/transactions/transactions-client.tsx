"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Link2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Button, Card, Pill, PlannedControl } from "@/components/data-display/primitives";
import { formatMoney } from "@/domain/money/money";

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
  REFUND: "Refund",
  FEE: "Fee",
  INTEREST: "Interest",
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

const signConventionLabels: Record<string, string> = {
  DEBITS_NEGATIVE: "Debits are negative",
  DEBITS_POSITIVE: "Debits are positive",
};

const duplicateStatusLabels: Record<string, string> = {
  NONE: "No duplicate found",
  FILE_ROW: "Duplicate row in this file",
  EXISTING_TRANSACTION: "Possible duplicate transaction",
};

const decisionLabels: Record<string, string> = {
  IMPORT: "Import",
  SKIP: "Skip",
  REVIEW: "Review later",
};

const batchStatusLabels: Record<string, string> = {
  STAGED: "Staged",
  VALIDATED: "Validated",
  IMPORTED: "Imported",
  PARTIALLY_IMPORTED: "Partially imported",
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
}: {
  transactions: TransactionDto[];
  categories: CategoryDto[];
  accounts: AccountDto[];
  profiles: ProfileDto[];
  batches: BatchDto[];
  transferMatches: TransferMatchDto[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<TransactionDto | null>(null);
  const [audit, setAudit] = useState<AuditDto[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [importOpen, setImportOpen] = useState(false);
  const [drawerTransfers, setDrawerTransfers] = useState<TransferMatchDto[]>([]);
  const [transferNote, setTransferNote] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [transferError, setTransferError] = useState("");
  const [filters, setFilters] = useState({
    q: searchParams.get("q") ?? "",
    accountId: searchParams.get("account") ?? "",
    categoryId: searchParams.get("category") ?? "",
    type: searchParams.get("type") ?? "",
    pageSize: searchParams.get("pageSize") ?? "25",
  });
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") ?? "1")));
  const [form, setForm] = useState({
    normalizedMerchant: "",
    categoryId: "",
    type: "DEBIT",
    reviewStatus: "NEEDS_REVIEW",
    excluded: false,
    notes: "",
  });

  const filteredTransactions = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesQuery =
        !query ||
        [
          transaction.normalizedMerchant,
          transaction.originalDescription,
          transaction.account.name,
          transaction.category?.name ?? "",
          transaction.sourceFilename ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return (
        matchesQuery &&
        (!filters.accountId || transaction.account.name === filters.accountId) &&
        (!filters.categoryId || (transaction.categoryId ?? "") === filters.categoryId) &&
        (!filters.type || transaction.type === filters.type)
      );
    });
  }, [filters, transactions]);

  const pageSize = Number(filters.pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function updateUrl(nextFilters = filters, nextPage = page) {
    const params = new URLSearchParams();
    if (nextFilters.q) params.set("q", nextFilters.q);
    if (nextFilters.accountId) params.set("account", nextFilters.accountId);
    if (nextFilters.categoryId) params.set("category", nextFilters.categoryId);
    if (nextFilters.type) params.set("type", nextFilters.type);
    if (nextFilters.pageSize !== "25") params.set("pageSize", nextFilters.pageSize);
    if (nextPage > 1) params.set("page", String(nextPage));
    router.replace(`/transactions${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }

  function updateFilter(key: keyof typeof filters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    updateUrl(next, 1);
  }

  function updatePage(nextPage: number) {
    const bounded = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(bounded);
    updateUrl(filters, bounded);
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
    const response = await fetch("/api/transfers", { method: "POST" });
    setStatus(response.ok ? "saved" : "error");
    setAnnouncement(response.ok ? "Transfer scan complete." : "Transfer scan failed.");
    startTransition(() => router.refresh());
  }

  async function transferAction(
    url: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setStatus("saving");
    setTransferError("");
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
    setAnnouncement(message);
    setTransferError(response.ok ? "" : message);
    setTransferNote("");
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

  async function undoBatch(batchId: string) {
    const response = await fetch(`/api/imports/${batchId}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "UNDO IMPORT" }),
    });
    setStatus(response.ok ? "saved" : "error");
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
        <PlannedControl>
          <SlidersHorizontal className="h-4 w-4" /> Saved Views
        </PlannedControl>
        {status === "saving" || isPending ? <Pill tone="info">Saving</Pill> : null}
        {status === "saved" ? <Pill tone="good">Saved</Pill> : null}
        {status === "error" ? <Pill tone="bad">Action failed</Pill> : null}
      </div>
      <ImportHistory batches={batches} onUndo={undoBatch} />
      <TransferReviewPanel
        matches={transferMatches}
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
          )
        }
        onReject={(id) =>
          transferAction(
            `/api/transfers/${id}/reject`,
            { confirmation: "REJECT TRANSFER", notes: transferNote || undefined },
            "Transfer suggestion rejected.",
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
      />
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <TransactionFilters
        filters={filters}
        accounts={accounts}
        categories={categories}
        onChange={updateFilter}
      />
      <TransactionTable
        transactions={visibleTransactions}
        transferMatches={transferMatches}
        open={open}
        totalCount={transactions.length}
        filteredCount={filteredTransactions.length}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={filters.pageSize}
        onPage={updatePage}
        onPageSize={(next) => updateFilter("pageSize", next)}
      />
      {importOpen ? (
        <ImportDialog
          accounts={accounts}
          profiles={profiles}
          onClose={() => setImportOpen(false)}
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
            )
          }
          onReject={(id) =>
            transferAction(
              `/api/transfers/${id}/reject`,
              { confirmation: "REJECT TRANSFER", notes: transferNote || undefined },
              "Transfer suggestion rejected.",
            )
          }
          onUnmatch={(id) =>
            transferAction(
              `/api/transfers/${id}/unmatch`,
              { confirmation: "UNMATCH TRANSFER", notes: transferNote || undefined },
              "Transfer unmatched.",
            )
          }
          setSelected={setSelected}
          setForm={setForm}
          save={save}
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
}: {
  matches: TransferMatchDto[];
  transactions: TransactionDto[];
  onScan: () => void;
  onOpen: (id: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onManual: (outgoingTransactionId: string, incomingTransactionId: string) => void;
  error: string;
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
                {["Confidence", "Amount", "Accounts", "Dates", "Reasons", "Actions"].map((head) => (
                  <th key={head} className="py-3 pr-4">
                    {head}
                  </th>
                ))}
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
                        className="rounded-md border px-3 py-1"
                        onClick={() => onConfirm(match.id)}
                      >
                        Confirm transfer
                      </button>
                      <button
                        className="rounded-md border px-3 py-1 text-[var(--red)]"
                        onClick={() => onReject(match.id)}
                      >
                        Reject suggestion
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
            className="h-10 rounded-md bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={!manualEligible}
            onClick={() => onManual(manualOut, manualIn)}
          >
            Create manual match
          </button>
        </div>
        {selectedOut && !eligibleIncoming.length ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No eligible incoming transactions match the selected amount, account, and date window.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function ImportDialog({
  accounts,
  profiles,
  onClose,
  onComplete,
}: {
  accounts: AccountDto[];
  profiles: ProfileDto[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const firstAccount = accounts[0]?.id ?? "";
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
              <Button onClick={confirm} disabled={busy || (batch?.repeatedFile && !allowRepeated)}>
                Confirm import
              </Button>
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
                <SummaryLine
                  label="Skipped"
                  value={String(batch.totalRowCount - batch.importedTransactionCount)}
                />
                <SummaryLine label="Invalid" value={String(batch.rejectedRowCount)} />
                <SummaryLine
                  label="Duplicate candidates"
                  value={String(batch.duplicateCandidateCount)}
                />
                <SummaryLine label="Account" value={batch.account.name} />
                <SummaryLine label="Batch" value={batch.originalFilename} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={onComplete}>View imported transactions</Button>
                {["IMPORTED", "PARTIALLY_IMPORTED"].includes(batch.status) ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      postJson(`/api/imports/${batch.id}/undo`, { confirm: "UNDO IMPORT" }).then(
                        onComplete,
                      )
                    }
                  >
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

function TransactionFilters({
  filters,
  accounts,
  categories,
  onChange,
}: {
  filters: {
    q: string;
    accountId: string;
    categoryId: string;
    type: string;
    pageSize: string;
  };
  accounts: AccountDto[];
  categories: CategoryDto[];
  onChange: (key: keyof typeof filters, value: string) => void;
}) {
  return (
    <Card className="mb-4 p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
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
          value={filters.accountId}
          values={["", ...accounts.map((account) => account.name)]}
          labels={{ "": "All accounts" }}
          onChange={(value) => onChange("accountId", value)}
        />
        <Select
          label="Category"
          value={filters.categoryId}
          values={["", ...categories.map((category) => category.id)]}
          labels={{
            "": "All categories",
            ...Object.fromEntries(categories.map((category) => [category.id, category.name])),
          }}
          onChange={(value) => onChange("categoryId", value)}
        />
        <Select
          label="Type"
          value={filters.type}
          values={["", ...Object.keys(transactionTypeLabels)]}
          labels={{ "": "All types", ...transactionTypeLabels }}
          onChange={(value) => onChange("type", value)}
        />
        <Select
          label="Rows"
          value={filters.pageSize}
          values={["25", "50", "100"]}
          onChange={(value) => onChange("pageSize", value)}
        />
      </div>
    </Card>
  );
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
  return (
    <Card className="grid gap-3 p-5 sm:grid-cols-4">
      <SummaryLine label="Accepted" value={String(batch.acceptedRowCount)} />
      <SummaryLine label="Rejected" value={String(batch.rejectedRowCount)} />
      <SummaryLine label="Duplicate candidates" value={String(batch.duplicateCandidateCount)} />
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
                      {(["IMPORT", "SKIP", "REVIEW"] as const).map((decision) => (
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
}: {
  selected: TransactionDto;
  transfers: TransferMatchDto[];
  note: string;
  setNote: (value: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onUnmatch: (id: string) => void;
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
            className="mt-3 rounded-md border border-[var(--red)] px-3 py-2 text-sm font-semibold text-[var(--red)]"
            onClick={() => onUnmatch(confirmed.id)}
          >
            Unmatch transfer
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
                    className="rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => onConfirm(match.id)}
                  >
                    Confirm transfer
                  </button>
                  <button
                    className="rounded-md border border-[var(--red)] px-3 py-2 text-sm font-semibold text-[var(--red)]"
                    onClick={() => onReject(match.id)}
                  >
                    Reject suggestion
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

function parseSummary(batch: BatchDto | null): { headers?: string[]; sampleRows?: string[][] } {
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
