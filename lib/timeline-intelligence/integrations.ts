import type { TimelineIntegrationDescriptor } from "@/lib/timeline-intelligence/types";

/** Future-ready registry for long-term conversation memory. */
export function listTimelineIntegrations(): TimelineIntegrationDescriptor[] {
  return [
    {
      id: "relationship_history",
      status: "available",
      description: "Sender relationships inform urgency and tone (existing).",
    },
    {
      id: "crm_memory",
      status: "planned",
      description: "Long-term client history across threads and accounts.",
    },
    {
      id: "recurring_patterns",
      status: "planned",
      description: "Recurring conversation rhythms (weekly check-ins, school updates).",
    },
    {
      id: "client_history",
      status: "planned",
      description: "Deal stage and prior commitments from CRM sync.",
    },
  ];
}
