"use client";

import type { InboxTruthSnapshot } from "@/lib/inbox-truth/types";

type GmailTruthPanelProps = {
  snapshot: InboxTruthSnapshot;
  locale: "en" | "it";
  hasMoreToLoad: boolean;
};

const COPY = {
  en: {
    title: "Gmail sync",
    gmailInbox: "Gmail inbox",
    gmailUnread: "Gmail unread",
    loaded: "Loaded into Handled",
    completed: "Completed in Handled",
    waiting: "Waiting on",
    viewing: (loaded: number, total: number) =>
      `Viewing ${loaded.toLocaleString()} of ${total.toLocaleString()} Gmail inbox emails`,
    viewingUnknown: (loaded: number) =>
      `Viewing ${loaded.toLocaleString()} Gmail inbox emails`,
    loadMoreHint: "Load more to see older mail",
    visibleNote: (visible: number) =>
      `${visible.toLocaleString()} visible after filters`,
  },
  it: {
    title: "Sincronizzazione Gmail",
    gmailInbox: "Inbox Gmail",
    gmailUnread: "Non lette Gmail",
    loaded: "Caricate in Handled",
    completed: "Completate in Handled",
    waiting: "In attesa",
    viewing: (loaded: number, total: number) =>
      `Visualizzando ${loaded.toLocaleString()} di ${total.toLocaleString()} email nell'inbox Gmail`,
    viewingUnknown: (loaded: number) =>
      `Visualizzando ${loaded.toLocaleString()} email nell'inbox Gmail`,
    loadMoreHint: "Carica altre per vedere email più vecchie",
    visibleNote: (visible: number) =>
      `${visible.toLocaleString()} visibili dopo i filtri`,
  },
} as const;

function StatCell({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-[5.5rem]">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          emphasize ? "text-[#0F172A]" : "text-gray-700"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatCount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

export function GmailTruthPanel({ snapshot, locale, hasMoreToLoad }: GmailTruthPanelProps) {
  const t = COPY[locale];
  const gmailTotal = snapshot.gmailInboxTotal;
  const viewingLine =
    gmailTotal != null
      ? t.viewing(snapshot.loadedCount, gmailTotal)
      : t.viewingUnknown(snapshot.loadedCount);

  return (
    <section
      aria-label={t.title}
      className="rounded-xl border border-gray-200/80 bg-gray-50/60 px-4 py-3"
    >
      <p className="text-sm font-medium text-gray-800">{viewingLine}</p>
      {hasMoreToLoad && gmailTotal != null && snapshot.loadedCount < gmailTotal ? (
        <p className="mt-0.5 text-xs text-gray-500">{t.loadMoreHint}</p>
      ) : null}
      {snapshot.visibleCount !== snapshot.loadedCount ? (
        <p className="mt-0.5 text-xs text-gray-500">{t.visibleNote(snapshot.visibleCount)}</p>
      ) : null}

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        <StatCell label={t.gmailInbox} value={formatCount(snapshot.gmailInboxTotal)} emphasize />
        <StatCell label={t.gmailUnread} value={formatCount(snapshot.gmailUnreadTotal)} emphasize />
        <StatCell label={t.loaded} value={formatCount(snapshot.loadedCount)} />
        <StatCell label={t.completed} value={formatCount(snapshot.completedCount)} />
        <StatCell label={t.waiting} value={formatCount(snapshot.waitingOnCount)} />
      </dl>
    </section>
  );
}
