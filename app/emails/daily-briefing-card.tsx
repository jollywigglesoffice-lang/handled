"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useEmailCompletions } from "@/app/email-completions-context";
import { useWaitingOnMetadata } from "@/app/waiting-on-metadata-context";
import { buildWaitingBriefingLines } from "@/lib/waiting-on/dashboard";
import { useUserPreferences } from "@/app/user-preferences-context";
import {
  buildInboxBriefingCard,
  buildVisitSnapshot,
} from "@/lib/daily-briefing/inbox-briefing";
import type { DailyBriefingMessage } from "@/lib/daily-briefing/types";
import {
  loadVisitSnapshot,
  saveVisitSnapshot,
} from "@/lib/daily-briefing/visit-snapshot";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { formatDuration } from "@/lib/inbox-zero/estimate";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";

type DailyBriefingCardProps = {
  counts: Record<InboxAiCategory, number>;
  messages: DailyBriefingMessage[];
  locale: "en" | "it";
  onClearPromotions: () => void;
  onHandleQuickReplies: () => void;
  onInboxZero: () => void;
};

const COPY = {
  en: {
    whatChanged: "What changed",
    effort: "Estimated inbox effort",
    startInboxZero: "Start Inbox Zero",
    quickReplies: "Quick replies",
    clearPromotions: "Clear promotions",
    allClear: "You're all caught up.",
  },
  it: {
    whatChanged: "Cosa è cambiato",
    effort: "Sforzo stimato per la inbox",
    startInboxZero: "Avvia Inbox Zero",
    quickReplies: "Risposte veloci",
    clearPromotions: "Svuota promozioni",
    allClear: "Sei in pari.",
  },
} as const;

export function DailyBriefingCard({
  counts,
  messages,
  locale,
  onClearPromotions,
  onHandleQuickReplies,
  onInboxZero,
}: DailyBriefingCardProps) {
  const { waitingOpenRecords, waitingResponseRecords } = useEmailCompletions();
  const { summary: waitingSummary } = useWaitingOnMetadata();
  const { userName } = useUserPreferences();
  const t = COPY[locale];

  const [previousSnapshot] = useState(() => loadVisitSnapshot());

  const waitingBriefingLines = useMemo(
    () => buildWaitingBriefingLines(waitingSummary, locale),
    [waitingSummary, locale],
  );

  const briefing = useMemo(
    () =>
      buildInboxBriefingCard({
        locale,
        displayName: userName,
        counts,
        messages,
        waitingOnCount: waitingOpenRecords.length,
        responseReceivedCount: waitingResponseRecords.length,
        previousSnapshot,
        waitingRecords: waitingResponseRecords,
      }),
    [
      locale,
      userName,
      counts,
      messages,
      waitingOpenRecords.length,
      waitingResponseRecords,
      previousSnapshot,
    ],
  );

  useEffect(() => {
    function persistSnapshot() {
      if (messages.length === 0) return;
      saveVisitSnapshot(
        buildVisitSnapshot(
          messages,
          counts,
          waitingOpenRecords.length + waitingResponseRecords.length,
        ),
      );
    }

    const onHide = () => {
      if (document.visibilityState === "hidden") persistSnapshot();
    };

    window.addEventListener("beforeunload", persistSnapshot);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      persistSnapshot();
      window.removeEventListener("beforeunload", persistSnapshot);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [
    messages,
    counts,
    waitingOpenRecords.length,
    waitingResponseRecords.length,
  ]);

  const hasWork =
    counts.needs_attention > 0 ||
    counts.quick_reply > 0 ||
    waitingResponseRecords.length > 0 ||
    waitingOpenRecords.length > 0;

  const hasContent =
    briefing.lines.length > 0 ||
    waitingBriefingLines.length > 0 ||
    briefing.importantChanges.length > 0 ||
    briefing.showEffort;

  if (!hasContent) {
    return (
      <section className="rounded-2xl border border-[#E2E8F0] bg-[#FAFBFC] px-5 py-5 sm:px-6">
        <p className="text-base font-medium text-[#0F172A]">{briefing.greeting}</p>
        <p className="mt-2 text-sm text-gray-500">{t.allClear}</p>
      </section>
    );
  }

  const showActions = hasWork || counts.promotion > 0;

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-[#FAFBFC] px-5 py-5 sm:px-6">
      <p className="text-base font-medium text-[#0F172A]">{briefing.greeting}</p>

      {briefing.lines.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {briefing.todayLabel}
          </p>
          <ul className="mt-2 space-y-1">
            {briefing.lines.map((line) => (
              <li key={line.id} className="text-sm text-gray-700">
                {line.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {waitingBriefingLines.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-[#EEF2F6] pt-4">
          {waitingBriefingLines.map((line) => (
            <li key={line.id} className="text-sm text-gray-700">
              {line.label}
            </li>
          ))}
        </ul>
      ) : null}

      {briefing.importantChanges.length > 0 ? (
        <div className="mt-4 border-t border-[#EEF2F6] pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {t.whatChanged}
          </p>
          <ul className="mt-2 space-y-1">
            {briefing.importantChanges.map((change) => (
              <li key={change.id}>
                <Link
                  href={`/emails/${encodeURIComponent(change.emailId)}`}
                  onClick={() =>
                    captureInboxReturnFromOpen(
                      { view: "inbox", categoryTab: "all" },
                      change.emailId,
                    )
                  }
                  className="text-sm text-gray-700 transition hover:text-accent"
                >
                  {change.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {briefing.showEffort ? (
        <p className="mt-4 text-sm text-gray-600">
          <span className="text-gray-500">{t.effort}:</span>{" "}
          <span className="font-medium text-[#0F172A]">
            {formatDuration(briefing.effortSeconds, locale)}
          </span>
        </p>
      ) : null}

      {showActions ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EEF2F6] pt-4">
          <button
            type="button"
            onClick={onInboxZero}
            className="rounded-lg bg-[#9733ff] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover"
          >
            {t.startInboxZero}
          </button>
          {counts.quick_reply > 0 ? (
            <BriefingAction onClick={onHandleQuickReplies}>{t.quickReplies}</BriefingAction>
          ) : null}
          {counts.promotion > 0 ? (
            <BriefingAction onClick={onClearPromotions}>{t.clearPromotions}</BriefingAction>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function BriefingAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-accent/30 hover:text-accent"
    >
      {children}
    </button>
  );
}
