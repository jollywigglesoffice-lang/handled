"use client";

import { useCallback, useEffect, useState } from "react";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import {
  CALENDAR_SAFETY_RULES,
  connectGoogleCalendarViaOAuth,
  disconnectGoogleCalendarPlaceholder,
  fetchCalendarConnectionStatus,
  syncCalendarConnectionFromApi,
  type CalendarConnectionState,
} from "@/lib/calendar-awareness";

export function CalendarSettings({ embedded = false }: { embedded?: boolean }) {
  const [connection, setConnection] = useState<CalendarConnectionState>({
    status: "disconnected",
  });
  const [status, setStatus] = useState<SaveStatusState>("idle");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const api = await fetchCalendarConnectionStatus();
    syncCalendarConnectionFromApi(api.calendarConnected, api.accountEmail ?? undefined);
    setConnection({
      status: api.calendarConnected ? "connected" : "disconnected",
      accountEmail: api.accountEmail ?? undefined,
      connectedAt: api.calendarConnected ? new Date().toISOString() : undefined,
    });
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleConnect() {
    setStatus("saving");
    setMessage("Redirecting to Google…");
    await connectGoogleCalendarViaOAuth("/settings#calendar");
  }

  function handleDisconnect() {
    disconnectGoogleCalendarPlaceholder();
    void refresh();
    setMessage("Calendar disconnected locally — sign in again to restore access.");
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 3000);
  }

  const connected = connection.status === "connected";

  return (
    <section
      id="calendar"
      className={embedded ? "space-y-4" : "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"}
    >
      {!embedded ? (
        <>
          <h2 className="text-lg font-semibold text-gray-900">Google Calendar</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Handled only suggests meeting times from your real Google Calendar — never guessed slots.
            You always approve before sending.
          </p>
        </>
      ) : (
        <p className="text-sm text-secondary">
          Calendar uses your Gmail connection — scheduling works inline in email.
        </p>
      )}

      {!embedded && !connected && !checking ? (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
          <p className="text-sm text-gray-700">
            Connect Google Calendar to schedule directly from email. Handled never shows placeholder availability.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            connected
              ? "bg-emerald-100 text-emerald-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {checking ? "Checking…" : connected ? "Connected" : "Not connected"}
        </span>
        {connection.accountEmail ? (
          <span className="text-xs text-gray-500">{connection.accountEmail}</span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={connected || checking}
          onClick={() => void handleConnect()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Connect Google Calendar
        </button>
        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Disconnect
          </button>
        ) : null}
      </div>

      <SaveStatus status={status} className="mt-3 block" />
      {message ? <p className="mt-2 text-xs text-gray-600">{message}</p> : null}

      {!embedded ? (
        <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50/80 p-4">
          <p className="text-sm font-semibold text-amber-900">Safety</p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-amber-950/90">
            {CALENDAR_SAFETY_RULES}
          </p>
        </div>
      ) : null}
    </section>
  );
}
