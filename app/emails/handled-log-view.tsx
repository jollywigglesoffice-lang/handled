"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useEmailCompletions } from "@/app/email-completions-context";
import { logModeLabel } from "@/lib/autopilot/copy";
import {
  HANDLED_LOG_EVENT,
  readHandledLogStats,
  removeHandledLogEntry,
  unmarkAutopilotProcessed,
} from "@/lib/autopilot/log-storage";
import type { HandledLogEntry, HandledLogStats } from "@/lib/autopilot/types";
import { scopedEmailKey } from "@/lib/gmail/account-types";
import { revertDoneInboxEffects } from "@/lib/inbox-truth/apply-done";

type HandledLogViewProps = {
  locale: "en" | "it";
};

const COPY = {
  en: {
    title: "Handled Log",
    subtitle:
      "Every action Handled took — what happened, why, and how to reverse it.",
    handledForYou: "Handled for you",
    youConfirmed: "You confirmed",
    total: "Total actions",
    recent: "Recent actions",
    empty:
      "Nothing logged yet. When Handled organizes mail for you, every action appears here.",
    inbox: "Back to inbox",
    undo: "Undo",
    undoing: "Undoing…",
    undone: "Action reversed",
    action: "Action",
    reason: "Why",
    rule: "Rule",
    transparency:
      "Handled never acts without leaving a trace. You can always reverse automated actions.",
  },
  it: {
    title: "Registro Handled",
    subtitle:
      "Ogni azione di Handled — cosa è successo, perché, e come annullarla.",
    handledForYou: "Gestito per te",
    youConfirmed: "Hai confermato",
    total: "Azioni totali",
    recent: "Azioni recenti",
    empty:
      "Nessuna azione ancora. Quando Handled organizza la posta, ogni azione compare qui.",
    inbox: "Torna all'inbox",
    undo: "Annulla",
    undoing: "Annullamento…",
    undone: "Azione annullata",
    action: "Azione",
    reason: "Perché",
    rule: "Regola",
    transparency:
      "Handled non agisce mai senza lasciare traccia. Puoi sempre annullare le azioni automatiche.",
  },
} as const;

export function HandledLogView({ locale }: HandledLogViewProps) {
  const t = COPY[locale];
  const { uncompleteEmails } = useEmailCompletions();
  const [stats, setStats] = useState<HandledLogStats>(() => readHandledLogStats());
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setStats(readHandledLogStats());
    sync();
    window.addEventListener(HANDLED_LOG_EVENT, sync);
    return () => window.removeEventListener(HANDLED_LOG_EVENT, sync);
  }, []);

  const handleUndo = useCallback(
    async (entry: HandledLogEntry) => {
      setUndoingId(entry.id);
      try {
        revertDoneInboxEffects([{ id: entry.emailId, accountId: entry.accountId }]);
        await uncompleteEmails([entry.emailId]);
        unmarkAutopilotProcessed(scopedEmailKey(entry.emailId, entry.accountId));
        removeHandledLogEntry(entry.id);
        setFeedback(t.undone);
        window.setTimeout(() => setFeedback(null), 3000);
      } finally {
        setUndoingId(null);
      }
    },
    [uncompleteEmails, t.undone],
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t.title}</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-gray-500">{t.subtitle}</p>
        <p className="mt-2 max-w-lg text-xs leading-relaxed text-gray-400">{t.transparency}</p>
      </header>

      {feedback ? (
        <p className="text-sm font-medium text-emerald-700">{feedback}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t.total} value={stats.totalHandled} emphasis />
        <StatCard label={t.handledForYou} value={stats.handledForYou} />
        <StatCard label={t.youConfirmed} value={stats.suggestedConfirmed} />
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {t.recent}
        </h2>
        {stats.entries.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">{t.empty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {stats.entries.slice(0, 40).map((entry) => (
              <li key={entry.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {entry.subject}
                    </p>
                    <p className="truncate text-xs text-gray-500">{entry.sender}</p>
                    <dl className="mt-2 space-y-0.5 text-xs text-gray-500">
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-400">{t.action}</dt>
                        <dd>{entry.actionTaken}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-400">{t.reason}</dt>
                        <dd>{entry.reason}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-400">{t.rule}</dt>
                        <dd>{entry.ruleTriggered}</dd>
                      </div>
                    </dl>
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      {logModeLabel(entry.mode, locale)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <time className="text-[11px] text-gray-300" dateTime={entry.at}>
                      {formatLogTime(entry.at, locale)}
                    </time>
                    <button
                      type="button"
                      disabled={undoingId === entry.id}
                      onClick={() => void handleUndo(entry)}
                      className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
                    >
                      {undoingId === entry.id ? t.undoing : t.undo}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/emails"
        className="inline-flex text-sm font-medium text-accent hover:text-accent-hover"
      >
        {t.inbox} →
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ${
        emphasis ? "bg-violet-50/60 ring-1 ring-violet-100" : "bg-gray-50/80"
      }`}
    >
      <p className="text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

function formatLogTime(iso: string, locale: "en" | "it"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "it" ? "it-IT" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
