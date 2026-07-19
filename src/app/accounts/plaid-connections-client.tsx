"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnExit, type PlaidLinkOnSuccess } from "react-plaid-link";
import { Button, Card, Pill } from "@/components/data-display/primitives";
import { formatMoney } from "@/domain/money/money";

type Dashboard = {
  configuration: {
    configured: boolean;
    environment: string | null;
    missing: string[];
    realConnectionsEnabled: boolean;
    localOperation: string;
  };
  workspaceType: string;
  canConnect: boolean;
  items: Array<{
    id: string;
    institutionName: string;
    environment: string;
    status: string;
    lastSuccessfulSyncAt?: string | null;
    lastSyncErrorCode?: string | null;
    lastSyncErrorMessage?: string | null;
    reauthenticationRequired: boolean;
    disconnectedAt?: string | null;
    accounts: Array<{
      id: string;
      displayName: string;
      officialName?: string | null;
      mask?: string | null;
      type: string;
      subtype?: string | null;
      currency?: string | null;
      currentBalanceMinor?: number | null;
      availableBalanceMinor?: number | null;
      balanceAsOf?: string | null;
      selectedForImport: boolean;
      matchStatus: string;
      matchConfidence?: string | null;
      matchEvidence: string[];
      localAccount: { id: string; name: string; type: string } | null;
    }>;
  }>;
};

export function PlaidConnectionsClient({
  dashboard,
  localAccounts,
}: {
  dashboard: Dashboard;
  localAccounts: Array<{ id: string; name: string; type: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [updateItemId, setUpdateItemId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function beginLink(itemId?: string) {
    setError("");
    setStatus("Preparing secure connection…");
    setUpdateItemId(itemId ?? null);
    const response = await fetch("/api/plaid/link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemId ? { updateItemId: itemId } : {}),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus("");
      setError(payload.error ?? "Unable to start Plaid Link.");
      return;
    }
    setLinkToken(payload.linkToken);
  }

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      if (updateItemId) {
        setStatus("Institution access updated.");
        setLinkToken(null);
        setUpdateItemId(null);
        startTransition(() => router.refresh());
        return;
      }
      setStatus("Securing connection and retrieving account metadata…");
      const response = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          selectedProviderAccountIds: metadata.accounts.map((account) => account.id),
        }),
      });
      const payload = await response.json();
      setLinkToken(null);
      if (!response.ok) {
        setStatus("");
        setError(payload.error ?? "Unable to save the connected institution.");
        return;
      }
      setStatus(
        `Connected ${payload.accountCount} account${payload.accountCount === 1 ? "" : "s"}. Review account matches, then sync.`,
      );
      startTransition(() => router.refresh());
    },
    [router, updateItemId],
  );
  const onExit = useCallback<PlaidLinkOnExit>((linkError) => {
    setLinkToken(null);
    setUpdateItemId(null);
    setStatus(linkError ? "" : "Connection canceled. No account data was saved.");
    if (linkError)
      setError(linkError.display_message || "Plaid Link could not complete the connection.");
  }, []);

  return (
    <Card className="mb-7 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Connected institutions</h2>
            <Pill tone={dashboard.configuration.environment === "production" ? "warn" : "info"}>
              {dashboard.configuration.environment ?? "Not configured"}
            </Pill>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            Plaid Transactions and balance metadata feed the same local accounts and ledger used by
            CSV imports. Synchronization is user-triggered in local-only mode.
          </p>
        </div>
        {dashboard.canConnect ? (
          <Button onClick={() => beginLink()}>Connect institution</Button>
        ) : null}
      </div>
      {!dashboard.configuration.configured ? (
        <Notice tone="warn">
          Plaid is disabled until the server-only environment variables listed in{" "}
          <code>.env.example</code> are configured. Missing:{" "}
          {dashboard.configuration.missing.join(", ")}.
        </Notice>
      ) : null}
      {dashboard.configuration.environment === "sandbox" && dashboard.workspaceType === "REAL" ? (
        <Notice tone="warn">
          Sandbox connections are blocked in this real workspace. Point the app at an isolated DEMO
          or TEST database before testing Plaid.
        </Notice>
      ) : null}
      {dashboard.configuration.environment === "production" &&
      !dashboard.configuration.realConnectionsEnabled ? (
        <Notice tone="warn">
          Real connections remain locked until Sandbox validation passes and{" "}
          <code>PLAID_REAL_CONNECTIONS_ENABLED=true</code> is set locally.
        </Notice>
      ) : null}
      {status ? (
        <div role="status" className="mt-4 rounded-md bg-[var(--teal-soft)] p-3 text-sm">
          {status}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-4 rounded-md bg-[var(--red-soft)] p-3 text-sm">
          {error}
        </div>
      ) : null}
      {linkToken ? <PlaidLauncher token={linkToken} onSuccess={onSuccess} onExit={onExit} /> : null}
      <div className="mt-5 space-y-4">
        {dashboard.items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No institutions are connected in this workspace.
          </p>
        ) : (
          dashboard.items.map((item) => (
            <Institution
              key={item.id}
              item={item}
              localAccounts={localAccounts}
              busy={isPending}
              onBeginLink={beginLink}
              onChanged={(message) => {
                setStatus(message);
                startTransition(() => router.refresh());
              }}
              onError={setError}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function PlaidLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: PlaidLinkOnSuccess;
  onExit: PlaidLinkOnExit;
}) {
  const { open, ready, error } = usePlaidLink({ token, onSuccess, onExit });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return error ? (
    <div role="alert" className="mt-4 rounded-md bg-[var(--red-soft)] p-3 text-sm">
      Plaid Link failed to load. No account data was saved.
    </div>
  ) : null;
}

function Institution({
  item,
  localAccounts,
  busy,
  onBeginLink,
  onChanged,
  onError,
}: {
  item: Dashboard["items"][number];
  localAccounts: Array<{ id: string; name: string; type: string }>;
  busy: boolean;
  onBeginLink: (id?: string) => Promise<void>;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  async function action(path: string, body?: unknown) {
    onError("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const payload = await response.json();
    if (!response.ok) {
      onError(payload.error ?? "The institution action failed.");
      return false;
    }
    return true;
  }
  return (
    <section className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{item.institutionName}</h3>
            <Pill
              tone={
                item.status === "ACTIVE"
                  ? "good"
                  : item.reauthenticationRequired
                    ? "warn"
                    : "neutral"
              }
            >
              {item.status.replaceAll("_", " ")}
            </Pill>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {item.lastSuccessfulSyncAt
              ? `Last synchronized ${new Date(item.lastSuccessfulSyncAt).toLocaleString()}`
              : "Not synchronized yet"}
          </p>
        </div>
        {item.status !== "DISCONNECTED" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (await action(`/api/plaid/items/${item.id}/sync`))
                  onChanged(
                    "Synchronization completed. Balances and transaction provenance were updated.",
                  );
              }}
            >
              Sync now
            </Button>
            {item.reauthenticationRequired ? (
              <Button variant="secondary" onClick={() => onBeginLink(item.id)}>
                Reauthenticate
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Disconnect ${item.institutionName}? The provider token will be removed and local history preserved.`,
                  )
                )
                  return;
                if (
                  await action(`/api/plaid/items/${item.id}/disconnect`, {
                    confirmation: "DISCONNECT",
                  })
                )
                  onChanged(
                    "Institution disconnected. Access token removed; local history preserved.",
                  );
              }}
            >
              Disconnect
            </Button>
          </div>
        ) : null}
      </div>
      {item.lastSyncErrorMessage ? (
        <div className="mt-3 rounded-md bg-[var(--red-soft)] p-3 text-sm">
          {item.lastSyncErrorMessage} {item.lastSyncErrorCode ? `(${item.lastSyncErrorCode})` : ""}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {item.accounts.map((account) => (
          <ConnectedAccount
            key={account.id}
            account={account}
            localAccounts={localAccounts}
            onMatch={async (body) => {
              if (await action(`/api/plaid/accounts/${account.id}/match`, body))
                onChanged("Connected account match updated.");
            }}
          />
        ))}
      </div>
    </section>
  );
}

function ConnectedAccount({
  account,
  localAccounts,
  onMatch,
}: {
  account: Dashboard["items"][number]["accounts"][number];
  localAccounts: Array<{ id: string; name: string; type: string }>;
  onMatch: (body: unknown) => Promise<void>;
}) {
  const [localId, setLocalId] = useState(account.localAccount?.id ?? "");
  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {account.displayName}
            {account.mask ? ` ••••${account.mask}` : ""}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {account.type}
            {account.subtype ? ` · ${account.subtype}` : ""} ·{" "}
            {account.currency ?? "Currency unavailable"}
          </div>
        </div>
        <Pill
          tone={
            account.localAccount ? "good" : account.matchStatus === "PROPOSED" ? "warn" : "neutral"
          }
        >
          {account.matchStatus.replaceAll("_", " ")}
        </Pill>
      </div>
      <div className="mt-3 flex gap-4 text-sm">
        <span>
          Current:{" "}
          {account.currentBalanceMinor == null
            ? "Unavailable"
            : formatMoney(account.currentBalanceMinor)}
        </span>
        <span>
          Available:{" "}
          {account.availableBalanceMinor == null
            ? "Unavailable"
            : formatMoney(account.availableBalanceMinor)}
        </span>
      </div>
      {account.balanceAsOf ? (
        <div className="mt-1 text-xs text-[var(--muted)]">
          Provider-reported {new Date(account.balanceAsOf).toLocaleString()}
        </div>
      ) : null}
      {account.matchEvidence.length ? (
        <ul className="mt-2 list-disc pl-5 text-xs text-[var(--muted)]">
          {account.matchEvidence.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {!account.localAccount && account.matchStatus !== "IGNORED" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            aria-label={`Local account for ${account.displayName}`}
            value={localId}
            onChange={(event) => setLocalId(event.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="">Choose local account</option>
            {localAccounts.map((local) => (
              <option key={local.id} value={local.id}>
                {local.name} · {local.type}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            disabled={!localId}
            onClick={() => onMatch({ action: "LINK", localAccountId: localId })}
          >
            Link selected
          </Button>
          <Button variant="secondary" onClick={() => onMatch({ action: "CREATE" })}>
            Create proposed account
          </Button>
          <Button variant="secondary" onClick={() => onMatch({ action: "IGNORE" })}>
            Ignore
          </Button>
        </div>
      ) : account.localAccount ? (
        <p className="mt-3 text-sm">
          Matched to <strong>{account.localAccount.name}</strong>.
        </p>
      ) : null}
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warn" }) {
  return (
    <div
      className={
        tone === "warn" ? "mt-4 rounded-md bg-[var(--amber-soft)] p-3 text-sm" : "mt-4 p-3 text-sm"
      }
    >
      {children}
    </div>
  );
}
