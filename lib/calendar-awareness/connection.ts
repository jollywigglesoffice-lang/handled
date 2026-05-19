import type { CalendarConnectionStatus, FutureCalendarAvailability } from "@/lib/calendar-awareness/types";

const STORAGE_KEY = "handled_calendar_connection_v1";

export type CalendarConnectionState = {
  status: CalendarConnectionStatus;
  /** ISO timestamp when user connected (future) */
  connectedAt?: string;
  /** Google account email hint (future) */
  accountEmail?: string;
  lastError?: string;
};

const DEFAULT_STATE: CalendarConnectionState = {
  status: "disconnected",
};

/**
 * Placeholder connection state — persisted locally until Google Calendar OAuth ships.
 * Server sync can replace this later without changing call sites.
 */
export function readCalendarConnectionState(): CalendarConnectionState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as CalendarConnectionState;
    return {
      status: parsed.status ?? "disconnected",
      connectedAt: parsed.connectedAt,
      accountEmail: parsed.accountEmail,
      lastError: parsed.lastError,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeCalendarConnectionState(state: CalendarConnectionState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isCalendarConnected(): boolean {
  return readCalendarConnectionState().status === "connected";
}

/** Future: fetch free/busy from Google Calendar API */
export async function fetchFutureCalendarAvailability(
  _rangeStart: Date,
  _rangeEnd: Date,
): Promise<FutureCalendarAvailability | null> {
  if (!isCalendarConnected()) return null;
  // Placeholder — implement with Google Calendar API + user consent
  return null;
}

export type ConnectCalendarResult =
  | { ok: true; status: "connected" }
  | { ok: false; reason: "not_implemented" | "denied" | "error"; message: string };

/**
 * Placeholder connect — returns not_implemented until OAuth is built.
 */
export async function connectGoogleCalendarPlaceholder(): Promise<ConnectCalendarResult> {
  return {
    ok: false,
    reason: "not_implemented",
    message: "Google Calendar connection is coming soon. Scheduling detection works today.",
  };
}

export function disconnectGoogleCalendarPlaceholder(): void {
  writeCalendarConnectionState({ status: "disconnected" });
}
