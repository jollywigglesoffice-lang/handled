import type { DailyWorkspaceIntegrationDescriptor } from "@/lib/daily-workspace/types";

export function listDailyWorkspaceIntegrations(): DailyWorkspaceIntegrationDescriptor[] {
  return [
    {
      id: "daily_planning",
      status: "planned",
      description: "Morning planning flow tied to Today's Focus — opt-in only.",
    },
    {
      id: "ai_scheduling",
      status: "planned",
      description: "Draft scheduling from workspace items — approval-first.",
    },
    {
      id: "task_intelligence",
      status: "planned",
      description: "Cross-email task detection and calm task board.",
    },
    {
      id: "smart_routines",
      status: "planned",
      description: "Repeatable calm routines (school, billing, VIP clients).",
    },
    {
      id: "operational_memory",
      status: "planned",
      description: "Workspace memory across days — not notification spam.",
    },
  ];
}
