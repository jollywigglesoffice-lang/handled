"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { SaveStatus, type SaveStatusState } from "@/app/components/save-status";
import {
  CALENDAR_SAFETY_RULES,
  connectGoogleCalendarPlaceholder,
  disconnectGoogleCalendarPlaceholder,
  readCalendarConnectionState,
  type CalendarConnectionState,
} from "@/lib/calendar-awareness";

export function CalendarSettings() {
  const [connection, setConnection] = useState<CalendarConnectionState>(() =>
    readCalendarConnectionState(),
  );
  const [status, setStatus] = useState<SaveStatusState>("idle");
  const [message, setMessage] = useState("");

  const refresh = useCallback(() => {
    setConnection(readCalendarConnectionState());
  }, []);

  async function handleConnect() {
    setStatus("saving");
    setMessage("Checking Google Calendar…");
    const result = await connectGoogleCalendarPlaceholder();
    refresh();
    if (result.ok) {
      setStatus("synced");
      setMessage("Google Calendar connected.");
    } else {
      setStatus("idle");
      setMessage(result.message);
    }
    window.setTimeout(() => setStatus("idle"), 3000);
  }

  function handleDisconnect() {
    disconnectGoogleCalendarPlaceholder();
    refresh();
    setMessage("Calendar disconnected.");
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 2000);
  }

  const connected = connection.status === "connected";

  return (
    <section
      id="calendar"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">Google Calendar</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        Handled will use your calendar to draft replies when someone asks about availability —
        never to book or confirm meetings without your approval.
      </p>

      <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
        <p className="text-sm font-semibold text-sky-900">Coming soon</p>
        <p className="mt-1 text-xs leading-relaxed text-sky-800">
          OAuth connection to Google Calendar is in development. Scheduling intent detection and
          safe draft wording already work in your inbox and replies.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            connected
              ? "bg-emerald-100 text-emerald-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
        {connection.accountEmail ? (
          <span className="text-xs text-gray-500">{connection.accountEmail}</span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={connected}
          onClick={() => void handleConnect()}
          className="rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
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
        <Link
          href="/settings"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Handled Brain
        </Link>
      </div>

      <SaveStatus status={status} className="mt-3 block" />
      {message ? <p className="mt-2 text-xs text-gray-600">{message}</p> : null}

      <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50/80 p-4">
        <p className="text-sm font-semibold text-amber-900">Safety</p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-amber-950/90">
          {CALENDAR_SAFETY_RULES}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600">
        <p className="font-medium text-gray-800">Future behavior</p>
        <p className="mt-1 leading-relaxed">
          When someone asks &ldquo;Are you available?&rdquo;, Handled will read your Google
          Calendar (with permission), suggest draft times in a reply, and wait for you to edit and
          send. No automatic invites or confirmations.
        </p>
      </div>
    </section>
  );
}
