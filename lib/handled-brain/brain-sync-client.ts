import type { HandledBrain } from "@/lib/handled-brain/types";
import type { BrainSyncStatus } from "@/lib/handled-brain/types";
import {
  LOCAL_HANDLED_BRAIN_KEY,
  HANDLED_BRAIN_PENDING_SYNC_KEY,
  loadClientHandledBrain,
  saveClientHandledBrain,
} from "@/lib/handled-brain/client-storage";

export type ClientBrainSyncState = {
  status: BrainSyncStatus;
  message: string;
  lastSyncedAt: string | null;
};

export function loadPendingBrainSync(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(HANDLED_BRAIN_PENDING_SYNC_KEY) === "1";
}

export function markBrainPendingSync(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HANDLED_BRAIN_PENDING_SYNC_KEY, "1");
}

export function clearBrainPendingSync(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HANDLED_BRAIN_PENDING_SYNC_KEY);
}

export function cacheBrainLocally(brain: HandledBrain): void {
  saveClientHandledBrain(brain);
}

export async function syncBrainToCloud(
  brain: HandledBrain,
): Promise<ClientBrainSyncState> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    cacheBrainLocally(brain);
    markBrainPendingSync();
    return {
      status: "offline_cached",
      message: "Offline — saved on this device until you're back online.",
      lastSyncedAt: null,
    };
  }

  try {
    const res = await fetch("/api/handled-brain", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brain }),
    });
    const data = (await res.json()) as {
      message?: string;
      error?: string;
      lastSyncedAt?: string;
      storageMode?: string;
    };

    if (res.ok) {
      clearBrainPendingSync();
      cacheBrainLocally(brain);
      return {
        status: "saved",
        message: data.message ?? "Synced to your Handled account",
        lastSyncedAt: data.lastSyncedAt ?? new Date().toISOString(),
      };
    }

    cacheBrainLocally(brain);
    markBrainPendingSync();
    return {
      status: data.storageMode === "client_local" ? "offline_cached" : "error",
      message:
        data.error ??
        data.message ??
        "Could not sync — cached on this device. Try again soon.",
      lastSyncedAt: null,
    };
  } catch {
    cacheBrainLocally(brain);
    markBrainPendingSync();
    return {
      status: "offline_cached",
      message: "Network error — cached locally until sync succeeds.",
      lastSyncedAt: null,
    };
  }
}

export async function loadBrainFromAccount(): Promise<{
  brain: HandledBrain;
  fromCache: boolean;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { brain: loadClientHandledBrain(), fromCache: true };
  }

  try {
    const res = await fetch("/api/handled-brain", { credentials: "same-origin" });
    const data = (await res.json()) as { brain?: HandledBrain };
    if (res.ok && data.brain) {
      cacheBrainLocally(data.brain);
      return { brain: data.brain, fromCache: false };
    }
  } catch {
    // fall through
  }

  return { brain: loadClientHandledBrain(), fromCache: true };
}

export async function flushPendingBrainSync(): Promise<ClientBrainSyncState | null> {
  if (!loadPendingBrainSync()) return null;
  const brain = loadClientHandledBrain();
  if (!brain.entries.length && !brain.writingStyle?.trim()) {
    clearBrainPendingSync();
    return null;
  }
  return syncBrainToCloud(brain);
}

export function registerBrainOnlineSync(
  onState: (state: ClientBrainSyncState) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => {
    void flushPendingBrainSync().then((state) => {
      if (state) onState(state);
    });
  };

  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

export { LOCAL_HANDLED_BRAIN_KEY };
