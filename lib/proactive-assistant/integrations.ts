import type { ProactiveIntegrationDescriptor } from "@/lib/proactive-assistant/types";

export function listProactiveIntegrations(): ProactiveIntegrationDescriptor[] {
  return [
    {
      id: "smart_reminders",
      status: "planned",
      description: "Opt-in reminders tied to commitments — never auto-fired.",
    },
    {
      id: "predictive_assistance",
      status: "planned",
      description: "Predict useful next steps from patterns across threads.",
    },
    {
      id: "daily_briefing",
      status: "available",
      description: "Calm daily summary of what may need attention.",
    },
    {
      id: "morning_digest",
      status: "planned",
      description: "Gentle morning digest — approval-first, no notification spam.",
    },
    {
      id: "operational_summary",
      status: "planned",
      description: "Weekly operational view for business inboxes.",
    },
  ];
}
