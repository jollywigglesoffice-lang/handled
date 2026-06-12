"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import type { ConnectedGmailAccount } from "@/lib/gmail/account-types";
import { startConnectGmailAccount } from "@/lib/gmail/connect-account-client";
import { SettingsSection } from "@/app/settings/settings-section";

const HELPER_COPY =
  "Connect another Gmail account to manage multiple inboxes in one place.";
const PLAN_NOTE = "Additional accounts may require a higher plan later.";

export function ConnectedAccountsSettings() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedGmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/accounts", {
        headers: await protectedApiHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load connected accounts.");
      const data = (await res.json()) as { accounts?: ConnectedGmailAccount[] };
      setAccounts(data.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setSuccess("Gmail account connected. It will appear in your unified inbox.");
      void loadAccounts();
    }
    const connectError = searchParams.get("connect_error");
    if (connectError) {
      setError(
        connectError === "save_failed"
          ? "Connected to Google, but Handled could not save the account. Try again."
          : "Could not connect Gmail account. Please try again.",
      );
    }
  }, [searchParams, loadAccounts]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    setSuccess(null);
    const result = await startConnectGmailAccount();
    if (!result.ok) {
      setError(result.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (accounts.length <= 1) return;
    setDisconnectingId(accountId);
    setError(null);
    try {
      const res = await fetch(`/api/gmail/accounts/${encodeURIComponent(accountId)}`, {
        method: "DELETE",
        headers: await protectedApiHeaders(),
      });
      if (!res.ok) throw new Error("Could not disconnect account.");
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setSuccess("Account disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed.");
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleRename = async (accountId: string, label: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/gmail/accounts/${encodeURIComponent(accountId)}`, {
        method: "PATCH",
        headers: {
          ...(await protectedApiHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label }),
      });
      const data = (await res.json()) as { account?: ConnectedGmailAccount; error?: string };
      if (!res.ok || !data.account) {
        throw new Error("Could not rename account.");
      }
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? data.account! : a)),
      );
      setSuccess("Account label updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    }
  };

  return (
    <SettingsSection
      title="Connected Accounts"
      description="Link multiple Gmail inboxes to one Handled login."
      className="scroll-mt-6 py-8"
    >
      <div id="connected-accounts" className="-mt-4" aria-hidden />
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-secondary">{HELPER_COPY}</p>
        <p className="text-xs text-gray-400">{PLAN_NOTE}</p>

        {loading ? (
          <p className="text-sm text-secondary">Loading accounts…</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                canDisconnect={accounts.length > 1}
                disconnecting={disconnectingId === account.id}
                onDisconnect={() => void handleDisconnect(account.id)}
                onRename={(label) => void handleRename(account.id, label)}
              />
            ))}

            {accounts.length === 0 ? (
              <p className="text-sm text-secondary">No Gmail accounts connected yet.</p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/30 hover:bg-accent-muted/30 disabled:opacity-60"
            >
              <span aria-hidden className="text-base leading-none text-accent">
                +
              </span>
              {connecting ? "Opening Google…" : "Connect another Gmail account"}
            </button>
          </div>
        )}

        {success ? (
          <p className="text-sm text-emerald-700">{success}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </SettingsSection>
  );
}

function AccountRow({
  account,
  canDisconnect,
  disconnecting,
  onDisconnect,
  onRename,
}: {
  account: ConnectedGmailAccount;
  canDisconnect: boolean;
  disconnecting: boolean;
  onDisconnect: () => void;
  onRename: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account.label);

  useEffect(() => {
    if (!editing) setDraft(account.label);
  }, [account.label, editing]);

  const saveRename = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === account.label) {
      setEditing(false);
      setDraft(account.label);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 transition-colors duration-200 hover:border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setDraft(account.label);
                  }
                }}
                className="min-w-[10rem] flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-foreground focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/20"
                autoFocus
              />
              <button
                type="button"
                onClick={saveRename}
                className="text-xs font-medium text-accent hover:text-accent/80"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(account.label);
                }}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{account.label}</p>
              {account.isPrimary ? (
                <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Primary
                </span>
              ) : null}
            </div>
          )}
          <p className="mt-0.5 truncate text-xs text-secondary">{account.email}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-medium text-emerald-700">Connected</span>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-gray-500 transition-colors hover:text-accent"
            >
              Rename
            </button>
          ) : null}
          {canDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={disconnecting}
              className="text-xs font-medium text-gray-500 transition-colors hover:text-red-600 disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
