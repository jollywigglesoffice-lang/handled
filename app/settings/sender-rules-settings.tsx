"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type InboxAiCategory,
  inboxCategorySectionTitle,
} from "@/lib/inbox-ai-categories";
import {
  loadClientSenderPreferences,
  saveClientSenderPreferences,
  type SenderPreference,
} from "@/lib/inbox-sender-preferences";

const CATEGORY_OPTIONS: InboxAiCategory[] = [
  "needs_attention",
  "quick_reply",
  "promotion",
  "newsletter",
  "handled",
];

export function SenderRulesSettings() {
  const [rules, setRules] = useState<SenderPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sender-rules", { credentials: "same-origin" });
      const data = (await res.json()) as { rules?: SenderPreference[] };
      if (res.ok && data.rules) {
        setRules(data.rules);
        saveClientSenderPreferences(data.rules);
      } else {
        setRules(loadClientSenderPreferences());
      }
    } catch {
      setRules(loadClientSenderPreferences());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: SenderPreference[]) {
    setRules(next);
    saveClientSenderPreferences(next);
    setSyncing(true);
    setMessage("Saving…");
    try {
      const res = await fetch("/api/sender-rules", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: next }),
      });
      if (res.ok) {
        setMessage("Saved to your Handled account.");
        window.dispatchEvent(new Event("handled-sender-preferences-changed"));
        window.dispatchEvent(new Event("handled-inbox-refresh-requested"));
      } else {
        setMessage("Saved on this device until sync succeeds.");
      }
    } catch {
      setMessage("Saved on this device until sync succeeds.");
    } finally {
      setSyncing(false);
    }
  }

  function updateRule(id: string, patch: Partial<SenderPreference>) {
    void persist(
      rules.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)),
    );
  }

  async function removeRule(id: string) {
    const next = rules.filter((r) => r.id !== id);
    await persist(next);
    try {
      await fetch(`/api/sender-rules?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch {
      // local already updated
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-sm">
        <p className="text-sm text-gray-500">Loading learned sender rules…</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-sm sm:p-8">
      <div>
        <h2 className="text-base font-medium tracking-tight text-[#0F172A] sm:text-lg">
          Learned sender rules
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          When you recategorize an email and choose &ldquo;always from this sender,&rdquo; Handled
          remembers it here. These rules run before keyword rules and AI triage.
        </p>
      </div>

      {message ? (
        <p className="text-xs text-emerald-700">{syncing ? "Syncing…" : message}</p>
      ) : null}

      {rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-sm text-gray-500">
          No sender rules yet. Change a category on any inbox email and choose &ldquo;Always
          categorize emails from this sender like this.&rdquo;
        </p>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#0F172A]">
                  {rule.senderEmail || rule.senderDomain || "Sender"}
                </p>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={rule.enabled !== false}
                    onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <select
                value={rule.category}
                onChange={(e) =>
                  updateRule(rule.id, {
                    category: e.target.value as InboxAiCategory,
                  })
                }
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {inboxCategorySectionTitle(c, "en")}
                  </option>
                ))}
              </select>
              <div className="flex justify-between gap-2">
                <p className="text-xs text-gray-400">
                  {rule.updatedAt
                    ? `Updated ${new Date(rule.updatedAt).toLocaleString()}`
                    : null}
                </p>
                <button
                  type="button"
                  onClick={() => void removeRule(rule.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
