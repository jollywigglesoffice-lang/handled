import {
  persistWorkflowModeToBrowser,
  readWorkflowModeFromStorage,
  WORKFLOW_MODE_DIRTY_AT_KEY,
  type WorkflowMode,
} from "@/lib/workflow-mode";

const DIRTY_WINDOW_MS = 5 * 60 * 1000;

function markWorkflowModeDirty(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKFLOW_MODE_DIRTY_AT_KEY, String(Date.now()));
}

function clearWorkflowModeDirty(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WORKFLOW_MODE_DIRTY_AT_KEY);
}

function isWorkflowModeDirty(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(WORKFLOW_MODE_DIRTY_AT_KEY);
  if (!raw) return false;
  const at = parseInt(raw, 10);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < DIRTY_WINDOW_MS;
}

async function pushWorkflowModeToAccount(mode: WorkflowMode): Promise<boolean> {
  try {
    const res = await fetch("/api/workflow-mode", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      clearWorkflowModeDirty();
      return true;
    }
  } catch {
    // keep dirty flag for retry
  }
  return false;
}

/** Load mode from account when signed in; push local changes if pending. */
export async function syncWorkflowModeFromAccount(): Promise<WorkflowMode> {
  const local = readWorkflowModeFromStorage();
  if (typeof window === "undefined") return local;

  if (isWorkflowModeDirty()) {
    await pushWorkflowModeToAccount(local);
    return local;
  }

  try {
    const res = await fetch("/api/workflow-mode", { credentials: "same-origin" });
    const data = (await res.json()) as { mode?: string };
    if (res.ok && data.mode) {
      const mode = data.mode as WorkflowMode;
      persistWorkflowModeToBrowser(mode);
      return mode;
    }
  } catch {
    // use local
  }
  return local;
}

export async function persistWorkflowModeToAccount(
  mode: WorkflowMode,
): Promise<{ ok: boolean }> {
  persistWorkflowModeToBrowser(mode);
  markWorkflowModeDirty();
  const ok = await pushWorkflowModeToAccount(mode);
  return { ok };
}
