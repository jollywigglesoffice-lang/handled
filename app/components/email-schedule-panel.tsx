"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarAvailabilityResult, SuggestedTimeSlot } from "@/lib/time-impact/types";
import {
  connectGoogleCalendarViaOAuth,
  syncCalendarConnectionFromApi,
} from "@/lib/calendar-awareness/connection";
import { draftSchedulingReply } from "@/lib/calendar-awareness/slots";
import { trackEvent } from "@/lib/analytics";

export type EmailSchedulePanelProps = {
  emailId: string;
  sender: string;
  subject: string;
  locale: "en" | "it";
  accountId?: string;
  detailHref?: string;
  onDraftReply?: (text: string) => void;
  onScheduled?: (message: string) => void;
  embedded?: boolean;
};

type ProposeMode = "accept" | "propose";

type PendingSchedule = {
  slot: SuggestedTimeSlot;
  mode: ProposeMode;
  useAlternative: boolean;
};

const COPY = {
  en: {
    title: "Reply with a time",
    suggestTimes: "Load times from calendar",
    loading: "Reading your Google Calendar…",
    conflict: "Conflicts with your calendar",
    useAlt: "Use free alternative",
    accept: "Accept",
    change: "Change time",
    propose: "Propose different time",
    liveCalendar: "Verified against your Google Calendar — never estimated.",
    connectCta: "Connect your calendar to schedule directly from email",
    connectHint: "Handled never shows guessed times. Connect Google Calendar to load real availability.",
    connectButton: "Connect Google Calendar",
    error: "Could not load Google Calendar availability.",
    empty: "No free slots found in the next two weeks.",
    inserted: "Draft reply ready below — edit before sending.",
    retry: "Retry",
    confirmTitle: "Confirm this time?",
    confirmBody: "Handled will add a tentative calendar hold and insert a draft reply. Nothing is sent until you approve.",
    confirmAccept: "Add to calendar & draft reply",
    confirmPropose: "Draft proposal & calendar hold",
    cancel: "Cancel",
    pickTime: "Pick a different time",
    back: "Back",
    calendarLinked: "Calendar hold added — edit your reply below before sending.",
  },
  it: {
    title: "Rispondi con un orario",
    suggestTimes: "Carica orari dal calendario",
    loading: "Lettura di Google Calendar…",
    conflict: "Conflitto con il calendario",
    useAlt: "Usa alternativa libera",
    accept: "Accetta",
    change: "Cambia orario",
    propose: "Proponi altro orario",
    liveCalendar: "Verificato su Google Calendar — mai stimato.",
    connectCta: "Collega il calendario per programmare direttamente dall'email",
    connectHint: "Handled non mostra orari inventati. Collega Google Calendar per la disponibilità reale.",
    connectButton: "Collega Google Calendar",
    error: "Impossibile caricare la disponibilità di Google Calendar.",
    empty: "Nessuno slot libero nelle prossime due settimane.",
    inserted: "Bozza pronta sotto — modifica prima di inviare.",
    retry: "Riprova",
    confirmTitle: "Confermi questo orario?",
    confirmBody: "Handled aggiunge un appuntamento provvisorio e inserisce una bozza di risposta. Nulla viene inviato finché non approvi.",
    confirmAccept: "Aggiungi al calendario e bozza",
    confirmPropose: "Bozza proposta e appuntamento",
    cancel: "Annulla",
    pickTime: "Scegli un altro orario",
    back: "Indietro",
    calendarLinked: "Appuntamento aggiunto — modifica la risposta sotto prima di inviare.",
  },
} as const;

type PanelState = "unknown" | "disconnected" | "connected" | "api_error" | "empty";

export function EmailSchedulePanel({
  emailId,
  sender,
  subject,
  locale,
  accountId,
  onDraftReply,
  onScheduled,
  embedded = false,
}: EmailSchedulePanelProps) {
  const t = COPY[locale];
  const [data, setData] = useState<CalendarAvailabilityResult | null>(null);
  const [allSlots, setAllSlots] = useState<SuggestedTimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelState, setPanelState] = useState<PanelState>("unknown");
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [altForSlot, setAltForSlot] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<PendingSchedule | null>(null);
  const [changeMode, setChangeMode] = useState(false);
  const [changeLoading, setChangeLoading] = useState(false);

  const loadAvailability = useCallback(
    async (count = 3) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ locale, count: String(count) });
        if (accountId) params.set("accountId", accountId);
        const res = await fetch(`/api/calendar/availability?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("fetch failed");
        const json = (await res.json()) as CalendarAvailabilityResult;

        if (json.calendarApiError) {
          setPanelState("api_error");
          setError(t.error);
          setData(null);
          return;
        }

        if (!json.calendarConnected) {
          setPanelState("disconnected");
          setData(null);
          return;
        }

        syncCalendarConnectionFromApi(true);
        setData(json);

        if (!json.slots.length) {
          setPanelState("empty");
          return;
        }

        setPanelState("connected");
      } catch {
        setPanelState("api_error");
        setError(t.error);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [locale, accountId, t.error],
  );

  const loadExtendedSlots = useCallback(async () => {
    setChangeLoading(true);
    try {
      const params = new URLSearchParams({ locale, count: "12" });
      if (accountId) params.set("accountId", accountId);
      const res = await fetch(`/api/calendar/availability?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = (await res.json()) as CalendarAvailabilityResult;
      setAllSlots(json.slots ?? []);
      setChangeMode(true);
    } catch {
      setError(t.error);
    } finally {
      setChangeLoading(false);
    }
  }, [locale, accountId, t.error]);

  useEffect(() => {
    if (embedded) {
      void loadAvailability();
    }
  }, [embedded, loadAvailability]);

  async function handleConnect() {
    setConnecting(true);
    await connectGoogleCalendarViaOAuth();
    setConnecting(false);
  }

  function effectiveSlot(slot: SuggestedTimeSlot, useAlt: boolean): SuggestedTimeSlot {
    if (useAlt && slot.alternativeStart && slot.alternativeEnd) {
      return {
        ...slot,
        start: slot.alternativeStart,
        end: slot.alternativeEnd,
        label: slot.alternativeLabel ?? slot.label,
        hasConflict: false,
      };
    }
    return slot;
  }

  function openConfirm(slot: SuggestedTimeSlot, mode: ProposeMode) {
    const useAlt = altForSlot[slot.id] ?? false;
    setPending({ slot, mode, useAlternative: useAlt });
    setChangeMode(false);
  }

  async function confirmSchedule() {
    if (!pending) return;
    const slot = effectiveSlot(pending.slot, pending.useAlternative);
    setBusySlotId(slot.id);
    try {
      const res = await fetch("/api/calendar/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          sender,
          subject,
          emailId,
          locale,
          accountId,
          useAlternative: pending.useAlternative,
          proposeMode: pending.mode,
        }),
      });
      if (!res.ok) throw new Error("schedule failed");
      const result = (await res.json()) as {
        message: string;
        draftReplySnippet: string;
        calendarEventLink?: string | null;
      };
      trackEvent("inbox_schedule_approved", {
        email_id: emailId,
        slot_id: slot.id,
        had_conflict: slot.hasConflict,
        mode: pending.mode,
      });
      let draft = result.draftReplySnippet;
      if (result.calendarEventLink) {
        draft = `${draft}\n\n${result.calendarEventLink}`;
      }
      if (draft) onDraftReply?.(draft);
      onScheduled?.(result.message ?? t.calendarLinked);
      setPending(null);
    } catch {
      setPanelState("api_error");
      setError(t.error);
    } finally {
      setBusySlotId(null);
    }
  }

  const shellClass = embedded
    ? "space-y-3 rounded-xl border border-gray-100 bg-white/80 px-4 py-4"
    : "space-y-3 rounded-xl bg-gray-50/60 px-4 py-4";

  if (loading && panelState === "unknown") {
    return (
      <div className={shellClass}>
        <p className="text-sm text-gray-400">{t.loading}</p>
      </div>
    );
  }

  if (panelState === "disconnected") {
    return (
      <div className={shellClass}>
        <p className="text-sm font-medium text-gray-800">{t.connectCta}</p>
        <p className="text-xs text-gray-500">{t.connectHint}</p>
        <button
          type="button"
          disabled={connecting}
          onClick={() => void handleConnect()}
          className="mt-1 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {connecting ? "…" : t.connectButton}
        </button>
      </div>
    );
  }

  if (panelState === "api_error") {
    return (
      <div className={shellClass}>
        <p className="text-sm text-red-600">{error ?? t.error}</p>
        <button
          type="button"
          onClick={() => void loadAvailability()}
          className="text-xs font-medium text-gray-600 underline"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (!embedded && panelState === "unknown") {
    return (
      <div className={shellClass}>
        <p className="text-sm font-medium text-gray-700">{t.title}</p>
        <ScheduleAction onClick={() => void loadAvailability()}>{t.suggestTimes}</ScheduleAction>
      </div>
    );
  }

  if (panelState === "empty") {
    return (
      <div className={shellClass}>
        <p className="text-sm text-gray-600">{t.empty}</p>
        <button
          type="button"
          onClick={() => void loadAvailability()}
          className="text-xs font-medium text-gray-600 underline"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (pending) {
    const slot = effectiveSlot(pending.slot, pending.useAlternative);
    const preview = draftSchedulingReply(slot, locale, pending.mode);
    return (
      <div className={shellClass}>
        <p className="text-sm font-medium text-gray-800">{t.confirmTitle}</p>
        <p className="text-sm text-gray-700">{slot.label}</p>
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-600">
          &ldquo;{preview}&rdquo;
        </p>
        <p className="text-xs text-gray-500">{t.confirmBody}</p>
        <div className="flex flex-wrap gap-2">
          <ScheduleAction primary onClick={() => void confirmSchedule()} disabled={!!busySlotId}>
            {busySlotId ? "…" : pending.mode === "propose" ? t.confirmPropose : t.confirmAccept}
          </ScheduleAction>
          <ScheduleAction onClick={() => setPending(null)}>{t.cancel}</ScheduleAction>
        </div>
      </div>
    );
  }

  if (changeMode) {
    const slots = allSlots.length ? allSlots : data?.slots ?? [];
    return (
      <div className={shellClass}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-800">{t.pickTime}</p>
          <button
            type="button"
            onClick={() => setChangeMode(false)}
            className="text-xs text-gray-500 underline"
          >
            {t.back}
          </button>
        </div>
        {changeLoading ? (
          <p className="text-sm text-gray-400">{t.loading}</p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => openConfirm(slot, "accept")}
                className="block w-full rounded-lg bg-white px-3 py-2.5 text-left text-sm font-medium text-gray-800 shadow-sm ring-1 ring-gray-100 hover:bg-gray-50"
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!data?.slots.length) {
    return (
      <div className={shellClass}>
        <p className="text-sm text-gray-600">{t.empty}</p>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <p className="text-sm font-medium text-gray-800">{t.title}</p>
      <p className="text-xs text-gray-500">{t.liveCalendar}</p>

      <div className="space-y-2">
        {data.slots.map((slot) => {
          const useAlt = altForSlot[slot.id] && slot.alternativeLabel;
          const label = useAlt ? slot.alternativeLabel! : slot.label;
          return (
            <div
              key={slot.id}
              className="rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100"
            >
              <p className="text-sm font-medium text-gray-800">{label}</p>
              {slot.hasConflict ? (
                <p className="mt-0.5 text-xs text-amber-700/90">
                  {t.conflict}
                  {slot.alternativeLabel ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={() =>
                          setAltForSlot((m) => ({ ...m, [slot.id]: !m[slot.id] }))
                        }
                        className="font-medium underline"
                      >
                        {t.useAlt}
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ScheduleAction
                  primary
                  small
                  disabled={busySlotId === slot.id}
                  onClick={() => openConfirm(slot, "accept")}
                >
                  {t.accept}
                </ScheduleAction>
                <ScheduleAction
                  small
                  disabled={changeLoading}
                  onClick={() => void loadExtendedSlots()}
                >
                  {t.change}
                </ScheduleAction>
                <ScheduleAction
                  small
                  onClick={() => openConfirm(slot, "propose")}
                >
                  {t.propose}
                </ScheduleAction>
              </div>
            </div>
          );
        })}
      </div>

      {onDraftReply ? (
        <p className="text-[11px] text-gray-400">{t.inserted}</p>
      ) : null}
    </div>
  );
}

function ScheduleAction({
  children,
  onClick,
  primary,
  small,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const size = small ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md font-medium transition disabled:opacity-50 ${size} ${
        primary
          ? "bg-gray-900 text-white hover:bg-gray-800"
          : "text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
