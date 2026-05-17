import type { HandledBrain } from "@/lib/handled-brain/types";
import { EMPTY_BRAIN } from "@/lib/handled-brain/types";

export const LOCAL_HANDLED_BRAIN_KEY = "handled_brain_v1";
export const HANDLED_BRAIN_HEADER = "x-handled-brain";

export function loadClientHandledBrain(): HandledBrain {
  if (typeof window === "undefined") return EMPTY_BRAIN;
  try {
    const raw = localStorage.getItem(LOCAL_HANDLED_BRAIN_KEY);
    if (!raw) return EMPTY_BRAIN;
    return JSON.parse(raw) as HandledBrain;
  } catch {
    return EMPTY_BRAIN;
  }
}

export function saveClientHandledBrain(brain: HandledBrain): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_HANDLED_BRAIN_KEY, JSON.stringify(brain));
    window.dispatchEvent(new Event("handled-brain-changed"));
  } catch {
    // quota
  }
}

export function handledBrainHeaders(): HeadersInit {
  try {
    const brain = loadClientHandledBrain();
    if (!brain.entries.length && !brain.writingStyle) return {};
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(brain))));
    return { [HANDLED_BRAIN_HEADER]: encoded };
  } catch {
    return {};
  }
}

export function parseHandledBrainHeader(header: string | null): HandledBrain | null {
  if (!header?.trim()) return null;
  try {
    const json = decodeURIComponent(escape(atob(header.trim())));
    return JSON.parse(json) as HandledBrain;
  } catch {
    return null;
  }
}
