import {
  persistWorkflowModeToBrowser,
  readWorkflowModeFromStorage,
  type WorkflowMode,
} from "@/lib/workflow-mode";

/** Load mode from account when signed in; fall back to browser. */
export async function syncWorkflowModeFromAccount(): Promise<WorkflowMode> {
  const local = readWorkflowModeFromStorage();
  if (typeof window === "undefined") return local;

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

export async function persistWorkflowModeToAccount(mode: WorkflowMode): Promise<void> {
  persistWorkflowModeToBrowser(mode);
  try {
    await fetch("/api/workflow-mode", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  } catch {
    // local still saved
  }
}
