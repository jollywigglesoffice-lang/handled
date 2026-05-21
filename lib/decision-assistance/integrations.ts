import type { DecisionAssistanceIntegrationDescriptor } from "@/lib/decision-assistance/types";

export function listDecisionAssistanceIntegrations(): DecisionAssistanceIntegrationDescriptor[] {
  return [
    {
      id: "decision_memory",
      status: "planned",
      description: "Remember past decisions and outcomes per thread — calm recall only.",
    },
    {
      id: "strategic_insights",
      status: "planned",
      description: "Weekly strategic patterns without scorekeeping or guilt.",
    },
    {
      id: "operational_coaching",
      status: "planned",
      description: "Gentle coaching on workflows — approval-first.",
    },
    {
      id: "personal_assistant",
      status: "planned",
      description: "Personal context for family, school, and health threads.",
    },
    {
      id: "executive_assistant",
      status: "planned",
      description: "Executive-style prioritization — never autonomous sends.",
    },
  ];
}
