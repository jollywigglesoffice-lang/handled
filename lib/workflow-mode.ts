export const WORKFLOW_MODE_KEY = "handled_workflow_mode";
export const WORKFLOW_MODE_HEADER = "x-handled-workflow-mode";

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
