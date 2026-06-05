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
};

function ClutterBatchGroup({
  batch,
  locale,
  onCategoryChange,
  readStateMap,
  inboxReturnCapture,
}: {
  batch: ClutterBatch;
  locale: "en" | "it";
  onCategoryChange: InboxClutterSectionProps["onCategoryChange"];
  readStateMap?: ReadStateMap;
  inboxReturnCapture?: InboxReturnCapture;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-100 bg-white/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/80"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{batch.label}</p>
          <p className="mt-0.5 text-xs text-gray-500">{batch.reassurance}</p>
        </div>
        <span className="shrink-0 text-xs text-gray-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-gray-50 px-3 pb-3 pt-2">
          {batch.messages.map((message) => (
            <GmailInboxCard
              key={message.id}
              message={message as GmailCardMessage}
              locale={locale}
              onCategoryChange={onCategoryChange}
              readStateMap={readStateMap}
              inboxReturnCapture={inboxReturnCapture}
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
    <section className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5">
      <button
        type="button"
        onClick={() => setSectionOpen((c) => !c)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-gray-800">
            {locale === "it" ? "Aggiornamenti che possono aspettare" : "Updates that can wait"}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{summary}</p>
          <p className="mt-1 text-xs text-gray-400">{reassurance}</p>
        </div>
        <span className="text-xs text-gray-400">{sectionOpen ? "Hide" : "Show"}</span>
      </button>

      {sectionOpen ? (
        <div className="mt-4 space-y-2">
          {batches.map((batch) => (
            <ClutterBatchGroup
              key={batch.id}
              batch={batch}
              locale={locale}
              onCategoryChange={onCategoryChange}
              readStateMap={readStateMap}
              inboxReturnCapture={inboxReturnCapture}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
