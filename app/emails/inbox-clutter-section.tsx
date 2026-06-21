"use client";

import { useMemo, useState } from "react";
import { GmailInboxCard, type GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { notUrgentSectionReassurance } from "@/lib/attention-calm";
import { buildClutterBatches, type ClutterBatch } from "@/lib/inbox-clutter-batch";
import type { InboxCategoryChangeOptions } from "@/lib/inbox-category-change";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { ReadStateMap } from "@/lib/read-state/client-storage";
import type { InboxReturnCapture } from "@/lib/inbox-return-context";

type InboxClutterSectionProps = {
  messages: GmailCardMessage[];
  locale: "en" | "it";
  onCategoryChange: (
    id: string,
    category: InboxAiCategory,
    options?: InboxCategoryChangeOptions,
  ) => void;
  readStateMap?: ReadStateMap;
  defaultCollapsed?: boolean;
  inboxReturnCapture?: InboxReturnCapture;
  /** Opens the dedicated Promotions category tab. */
  onOpenPromotionsTab?: () => void;
  showAccountBadges?: boolean;
};

function ClutterBatchGroup({
  batch,
  locale,
  onCategoryChange,
  readStateMap,
  inboxReturnCapture,
  showAccountBadges,
}: {
  batch: ClutterBatch;
  locale: "en" | "it";
  onCategoryChange: InboxClutterSectionProps["onCategoryChange"];
  readStateMap?: ReadStateMap;
  inboxReturnCapture?: InboxReturnCapture;
  showAccountBadges?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 py-2 text-left transition-colors hover:bg-gray-50/50"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700">{batch.label}</p>
          <p className="mt-0.5 text-xs text-gray-400">{batch.reassurance}</p>
        </div>
        <span className="shrink-0 text-[11px] text-gray-300">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="pb-2">
          {batch.messages.map((message) => (
            <GmailInboxCard
              key={message.id}
              message={message as GmailCardMessage}
              locale={locale}
              onCategoryChange={onCategoryChange}
              readStateMap={readStateMap}
              inboxReturnCapture={inboxReturnCapture}
              showAccountBadge={showAccountBadges}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function InboxClutterSection({
  messages,
  locale,
  onCategoryChange,
  readStateMap,
  defaultCollapsed = true,
  inboxReturnCapture,
  onOpenPromotionsTab,
  showAccountBadges = false,
}: InboxClutterSectionProps) {
  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);

  const batches = useMemo(
    () =>
      buildClutterBatches(
        messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          subject: m.subject,
          snippet: m.snippet,
          category: m.category,
        })),
        locale,
      ),
    [messages, locale],
  );

  if (!messages.length) return null;

  const reassurance = notUrgentSectionReassurance("clutter", messages.length, locale);
  const summary =
    batches.length === 1
      ? batches[0]!.label
      : locale === "it"
        ? `${messages.length} aggiornamenti a bassa priorità — raggruppati`
        : `${messages.length} low-priority updates — grouped for you`;

  return (
    <section className="border-t border-gray-100 pt-6">
      <button
        type="button"
        onClick={() => setSectionOpen((c) => !c)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {locale === "it" ? "Aggiornamenti che possono aspettare" : "Updates that can wait"}
          </p>
          <p className="mt-1 text-sm text-gray-500">{summary}</p>
          <p className="mt-0.5 text-[11px] text-gray-300">{reassurance}</p>
          {onOpenPromotionsTab ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPromotionsTab();
              }}
              className="mt-2 text-xs font-medium text-accent transition hover:text-accent/80"
            >
              {locale === "it"
                ? "Apri tutte in Promozioni →"
                : "Open all in Promotions →"}
            </button>
          ) : null}
        </div>
        <span className="text-[11px] text-gray-300">{sectionOpen ? "Hide" : "Show"}</span>
      </button>

      {sectionOpen ? (
        <div className="mt-3 divide-y divide-gray-100/80">
          {batches.map((batch) => (
            <ClutterBatchGroup
              key={batch.id}
              batch={batch}
              locale={locale}
              onCategoryChange={onCategoryChange}
              readStateMap={readStateMap}
              inboxReturnCapture={inboxReturnCapture}
              showAccountBadges={showAccountBadges}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
