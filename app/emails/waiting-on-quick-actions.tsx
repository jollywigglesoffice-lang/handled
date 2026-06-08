"use client";

import { useState } from "react";
import Link from "next/link";
import { useWaitingOnMetadata } from "@/app/waiting-on-metadata-context";
import { WaitingFollowUpPanel } from "@/app/emails/waiting-follow-up-panel";
import type { EmailCompletionRecord } from "@/lib/email-completions/types";
import { captureInboxReturnFromOpen } from "@/lib/inbox-return-context";

const COPY = {
  en: {
    markResolved: "✓ Mark Resolved",
    sendFollowUp: "✓ Send Follow-up",
    changeFollowUp: "Change Follow-up Date",
    addNote: "Add Note",
    returnToInbox: "Return To Inbox",
    saveNote: "Save note",
    notePlaceholder: "Add a note…",
    followUpTomorrow: "Tomorrow",
    followUp3Days: "In 3 days",
    followUp7Days: "In 7 days",
    clearFollowUp: "Clear date",
    cancel: "Cancel",
  },
  it: {
    markResolved: "✓ Segna risolta",
    sendFollowUp: "✓ Invia follow-up",
    changeFollowUp: "Cambia data follow-up",
    addNote: "Aggiungi nota",
    returnToInbox: "Torna all'inbox",
    saveNote: "Salva nota",
    notePlaceholder: "Aggiungi una nota…",
    followUpTomorrow: "Domani",
    followUp3Days: "Tra 3 giorni",
    followUp7Days: "Tra 7 giorni",
    clearFollowUp: "Rimuovi data",
    cancel: "Annulla",
  },
} as const;

const MS_PER_DAY = 86_400_000;

type WaitingOnQuickActionsProps = {
  record: EmailCompletionRecord;
  note?: string;
  locale: "en" | "it";
};

export function WaitingOnQuickActions({ record, note, locale }: WaitingOnQuickActionsProps) {
  const {
    updateWaitingNote,
    setWaitingFollowUpDate,
    markWaitingFollowedUp,
    markWaitingResolved,
    returnWaitingToInbox,
  } = useWaitingOnMetadata();

  const t = COPY[locale];
  const [showNote, setShowNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note ?? "");
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [showFollowUpDraft, setShowFollowUpDraft] = useState(false);

  function addDaysFromNow(days: number): number {
    return Date.now() + days * MS_PER_DAY;
  }

  return (
    <div className="space-y-3 border-t border-[#F1F5F9] pt-3">
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => void markWaitingResolved(record.emailId, locale)}>
          {t.markResolved}
        </ActionButton>
        <ActionButton
          onClick={() => {
            setShowFollowUpDraft((v) => !v);
            setShowFollowUpPicker(false);
            setShowNote(false);
          }}
        >
          {t.sendFollowUp}
        </ActionButton>
        <ActionButton
          onClick={() => {
            setShowFollowUpPicker((v) => !v);
            setShowFollowUpDraft(false);
            setShowNote(false);
          }}
        >
          {t.changeFollowUp}
        </ActionButton>
        <ActionButton
          onClick={() => {
            setShowNote((v) => !v);
            setShowFollowUpPicker(false);
            setShowFollowUpDraft(false);
          }}
        >
          {t.addNote}
        </ActionButton>
        <ActionButton onClick={() => void returnWaitingToInbox(record.emailId)}>
          {t.returnToInbox}
        </ActionButton>
      </div>

      {showNote ? (
        <div className="space-y-2 rounded-lg border border-[#E2E8F0] bg-gray-50/50 p-3">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder={t.notePlaceholder}
            rows={3}
            className="w-full resize-y rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <ActionButton
              primary
              onClick={() => {
                updateWaitingNote(record.emailId, noteDraft);
                setShowNote(false);
              }}
            >
              {t.saveNote}
            </ActionButton>
            <ActionButton onClick={() => setShowNote(false)}>{t.cancel}</ActionButton>
          </div>
        </div>
      ) : null}

      {note && !showNote ? (
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-400">Note: </span>
          {note}
        </p>
      ) : null}

      {showFollowUpPicker ? (
        <div className="flex flex-wrap gap-2 rounded-lg border border-[#E2E8F0] bg-gray-50/50 p-3">
          <ActionButton
            onClick={() => {
              void setWaitingFollowUpDate(record.emailId, addDaysFromNow(1));
              setShowFollowUpPicker(false);
            }}
          >
            {t.followUpTomorrow}
          </ActionButton>
          <ActionButton
            onClick={() => {
              void setWaitingFollowUpDate(record.emailId, addDaysFromNow(3));
              setShowFollowUpPicker(false);
            }}
          >
            {t.followUp3Days}
          </ActionButton>
          <ActionButton
            onClick={() => {
              void setWaitingFollowUpDate(record.emailId, addDaysFromNow(7));
              setShowFollowUpPicker(false);
            }}
          >
            {t.followUp7Days}
          </ActionButton>
          <ActionButton
            onClick={() => {
              void setWaitingFollowUpDate(record.emailId, null);
              setShowFollowUpPicker(false);
            }}
          >
            {t.clearFollowUp}
          </ActionButton>
        </div>
      ) : null}

      {showFollowUpDraft ? (
        <div className="space-y-2">
          <WaitingFollowUpPanel
            record={record}
            locale={locale}
            showSuggestion
            compact
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/emails/${encodeURIComponent(record.emailId)}`}
              onClick={() => {
                markWaitingFollowedUp(record.emailId);
                captureInboxReturnFromOpen(
                  { view: "waiting", categoryTab: "all" },
                  record.emailId,
                );
              }}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-100"
            >
              {locale === "it" ? "Apri email per inviare" : "Open email to send"}
            </Link>
            <ActionButton
              onClick={() => {
                markWaitingFollowedUp(record.emailId);
                setShowFollowUpDraft(false);
              }}
            >
              {locale === "it" ? "Segna follow-up inviato" : "Mark follow-up sent"}
            </ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        primary
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-[#E2E8F0] bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
