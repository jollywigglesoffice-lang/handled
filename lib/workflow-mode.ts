export const WORKFLOW_MODE_KEY = "handled_workflow_mode";
export const WORKFLOW_MODE_HEADER = "x-handled-workflow-mode";
export const WORKFLOW_MODE_COOKIE = "handled_workflow_mode";

export function parseWorkflowMode(value: string | null | undefined): WorkflowMode {
  const v = value?.trim().toLowerCase();
  if (v === "clean" || v === "handle") return v;
  return "assist";
}

export function persistWorkflowModeToBrowser(mode: WorkflowMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKFLOW_MODE_KEY, mode);
  document.cookie = `${WORKFLOW_MODE_COOKIE}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
}

export type WorkflowMode = "assist" | "clean" | "handle";

export const WORKFLOW_MODES: WorkflowMode[] = ["assist", "clean", "handle"];

export function readWorkflowModeFromStorage(): WorkflowMode {
  if (typeof window === "undefined") return "assist";
  const raw = localStorage.getItem(WORKFLOW_MODE_KEY);
  if (raw === "clean" || raw === "handle") return raw;
  return "assist";
}

export function workflowModeHeaders(): HeadersInit {
  return { [WORKFLOW_MODE_HEADER]: readWorkflowModeFromStorage() };
}
