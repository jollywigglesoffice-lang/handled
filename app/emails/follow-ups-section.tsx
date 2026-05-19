"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FollowUpCard } from "@/app/emails/follow-up-card";
import { useUiCopy } from "@/app/use-ui-copy";
import { syncFollowUpRemindersFromAccount } from "@/lib/follow-up-reminders/client-sync";
import type { FollowUpInboxItem, FollowUpSectionKey } from "@/lib/follow-up/types";
import { sectionKeyForItem } from "@/lib/follow-up/types";
import { inboxFetchHeaders } from "@/lib/inbox-fetch-headers";

type InboxMessageForAnalyze = {
  id: string;
  threadId?: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  category: string;
  internalDateMs?: number;
};

type FollowUpsSectionProps = {
  messages: InboxMessageForAnalyze[];
  locale: "en" | "it";
  visible?: boolean;
};

const TAB_ORDER: FollowUpSectionKey[] = [
  "at_risk",
  "follow_ups",
  "waiting_on",
  "pending",
  "unresolved",
];

export function FollowUpsSection({ messages, locale, visible = true }: FollowUpsSectionProps) {
  const ui = useUiCopy();
  const [items, setItems] = useState<FollowUpInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FollowUpSectionKey>("follow_ups");

  const tabLabels: Record<FollowUpSectionKey, string> = {
    at_risk: ui.followUp.atRiskTab,
    follow_ups: ui.followUp.followUpsTab,
    waiting_on: ui.followUp.waitingOnTab,
    unresolved: ui.followUp.unresolvedTab,
    pending: ui.followUp.pendingTab,
  };

  const load = useCallback(async () => {
    if (!visible || messages.length === 0) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      await syncFollowUpRemindersFromAccount();
      const res = await fetch("/api/follow-ups/analyze", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...inboxFetchHeaders(),
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            ...m,
            internalDateMs: m.internalDateMs ?? (m.date ? new Date(m.date).getTime() : 0),
          })),
        }),
      });
      const data = (await res.json()) as { items?: FollowUpInboxItem[] };
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [messages, visible]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("handled-follow-ups-changed", onRefresh);
    return () => window.removeEventListener("handled-follow-ups-changed", onRefresh);
  }, [load]);

  const byTab = useMemo(() => {
    const map: Record<FollowUpSectionKey, FollowUpInboxItem[]> = {
      at_risk: [],
      follow_ups: [],
      waiting_on: [],
      unresolved: [],
      pending: [],
    };
    for (const item of items) {
      map[sectionKeyForItem(item)].push(item);
    }
    return map;
  }, [items]);

  const activeItems = byTab[activeTab];
  const totalCount = items.length;

  if (!visible) return null;

  return (
    <section className="rounded-2xl border border-violet-100 bg-[#FFFFFF] p-6 shadow-sm">
      <div className="border-b border-violet-50 pb-4">
        <h2 className="text-lg font-semibold tracking-tight text-[#0F172A]">
          {ui.followUp.sectionTitle}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">{ui.followUp.sectionSubtitle}</p>
        <p className="mt-1 text-xs text-gray-400">{ui.followUp.sectionCalmNote}</p>
        {totalCount > 0 ? (
          <p className="mt-2 text-xs font-medium text-violet-700">
            {totalCount} conversation{totalCount === 1 ? "" : "s"} on your radar
          </p>
        ) : null}
      </div>

      {totalCount > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {TAB_ORDER.map((key) => {
            const count = byTab[key].length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activeTab === key
                    ? "border-violet-300 bg-violet-100 text-violet-900"
                    : "border-[#E2E8F0] bg-white text-gray-600 hover:border-violet-200"
                }`}
              >
                {tabLabels[key]} ({count})
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-400">Reviewing conversations…</p>
        ) : activeItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-8 text-center text-sm text-gray-500">
            {ui.followUp.emptyState}
          </p>
        ) : (
          activeItems.map((item) => (
            <FollowUpCard
              key={item.emailId}
              item={item}
              locale={locale}
              onUpdated={() => {
                window.dispatchEvent(new Event("handled-follow-ups-changed"));
                void load();
              }}
            />
          ))
        )}
      </div>
    </section>
  );
}
