import { startGoogleOAuth } from "@/lib/auth/start-google-oauth";
import type { CalendarConnectionStatus, FutureCalendarAvailability } from "@/lib/calendar-awareness/types";

const STORAGE_KEY = "handled_calendar_connection_v1";

export type CalendarConnectionState = {
  status: CalendarConnectionStatus;
  connectedAt?: string;
  accountEmail?: string;
  lastError?: string;
};

const DEFAULT_STATE: CalendarConnectionState = {
  status: "disconnected",
};

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

/** Server-verified connection — prefer over localStorage. */
export async function fetchCalendarConnectionStatus(accountId?: string): Promise<{
  calendarConnected: boolean;
  accountEmail?: string | null;
}> {
  try {
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    const qs = params.toString();
    const res = await fetch(`/api/calendar/status${qs ? `?${qs}` : ""}`, {
      credentials: "include",
    });
    if (!res.ok) return { calendarConnected: false };
    return (await res.json()) as { calendarConnected: boolean; accountEmail?: string | null };
  } catch {
    return { calendarConnected: false };
  }
}

export function isCalendarConnected(): boolean {
  return readCalendarConnectionState().status === "connected";
}

export function syncCalendarConnectionFromApi(connected: boolean, accountEmail?: string): void {
  if (!connected) {
    writeCalendarConnectionState({ status: "disconnected" });
    return;
  }
  writeCalendarConnectionState({
    status: "connected",
    connectedAt: new Date().toISOString(),
    accountEmail,
  });
}

/** Re-authorize Google with calendar scopes — same flow as sign-in. */
export async function connectGoogleCalendarViaOAuth(next?: string): Promise<ConnectCalendarResult> {
  const redirectNext =
    next ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/emails");

  writeCalendarConnectionState({ status: "connecting" });
  const result = await startGoogleOAuth(redirectNext);
  if (result.error) {
    writeCalendarConnectionState({ status: "error", lastError: result.error });
    return { ok: false, reason: "error", message: result.error };
  }
  return { ok: true, status: "connecting" };
}

export async function fetchFutureCalendarAvailability(
  _rangeStart: Date,
  _rangeEnd: Date,
): Promise<FutureCalendarAvailability | null> {
  const status = await fetchCalendarConnectionStatus();
  if (!status.calendarConnected) return null;
  return null;
}

export type ConnectCalendarResult =
  | { ok: true; status: "connected" | "connecting" }
  | { ok: false; reason: "not_implemented" | "denied" | "error"; message: string };

export async function connectGoogleCalendarPlaceholder(): Promise<ConnectCalendarResult> {
  return connectGoogleCalendarViaOAuth("/settings#calendar");
}

export function disconnectGoogleCalendarPlaceholder(): void {
  writeCalendarConnectionState({ status: "disconnected" });
}
