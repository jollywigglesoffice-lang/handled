import type { HandledLogEntry, HandledLogStats } from "@/lib/autopilot/types";

const STORAGE_KEY = "handled_log_v2";
const PROCESSED_KEY = "handled_autopilot_processed_v1";
export const HANDLED_LOG_EVENT = "handled-autopilot-log-changed";

function readEntries(): HandledLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HandledLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: HandledLogEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 500)));
  window.dispatchEvent(new Event(HANDLED_LOG_EVENT));
}

export function appendHandledLogEntry(
  entry: Omit<HandledLogEntry, "id" | "at" | "reversible">,
): HandledLogEntry {
  const row: HandledLogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    reversible: true,
  };
  writeEntries([row, ...readEntries()]);
  return row;
}

export function readHandledLogStats(): HandledLogStats {
  const entries = readEntries();
  let handledForYou = 0;
  let suggestedConfirmed = 0;

  for (const e of entries) {
    if (e.mode === "auto") handledForYou += 1;
    else suggestedConfirmed += 1;
  }

  return {
    totalHandled: entries.length,
    handledForYou,
    suggestedConfirmed,
    entries,
  };
}

export function removeHandledLogEntry(entryId: string): void {
  writeEntries(readEntries().filter((e) => e.id !== entryId));
}

export function findLogEntryByEmail(emailId: string, accountId?: string): HandledLogEntry | undefined {
  return readEntries().find(
    (e) => e.emailId === emailId && (accountId ? e.accountId === accountId : true),
  );
}

export function readAutopilotProcessedKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PROCESSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markAutopilotProcessed(keys: string[]): void {
  if (typeof window === "undefined") return;
  const set = readAutopilotProcessedKeys();
  for (const k of keys) set.add(k);
  localStorage.setItem(PROCESSED_KEY, JSON.stringify([...set].slice(-2000)));
}

export function isAutopilotProcessed(key: string): boolean {
  return readAutopilotProcessedKeys().has(key);
}

export function unmarkAutopilotProcessed(key: string): void {
  if (typeof window === "undefined") return;
  const set = readAutopilotProcessedKeys();
  set.delete(key);
  localStorage.setItem(PROCESSED_KEY, JSON.stringify([...set]));
}
