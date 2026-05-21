import type { ContextualSearchIntegrationDescriptor } from "@/lib/contextual-search/types";

export function listContextualSearchIntegrations(): ContextualSearchIntegrationDescriptor[] {
  return [
    {
      id: "google_drive",
      status: "planned",
      description: "Search Drive files linked to email threads and commitments.",
    },
    {
      id: "google_calendar",
      status: "planned",
      description: "Calendar-aware search for meetings and scheduling context.",
    },
    {
      id: "google_contacts",
      status: "planned",
      description: "Contact memory — people, roles, and relationship history.",
    },
    {
      id: "cross_platform_memory",
      status: "planned",
      description: "Unified memory across email, docs, and calendar.",
    },
    {
      id: "universal_assistant",
      status: "planned",
      description: "Single conversational search across all Handled sources.",
    },
  ];
}
