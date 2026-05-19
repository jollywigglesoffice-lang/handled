import type { ActionIntegrationDescriptor } from "@/lib/action-intelligence/types";
import { isCalendarConnected } from "@/lib/calendar-awareness/connection";

/**
 * Future-ready integration registry for Action Intelligence.
 * Extend when Calendar OAuth, Tasks, or CRM memory ship.
 */
export function listActionIntegrations(): ActionIntegrationDescriptor[] {
  const calendarConnected = isCalendarConnected();

  return [
    {
      id: "google_calendar",
      status: calendarConnected ? "connected" : "planned",
      description: calendarConnected
        ? "Calendar connected — availability drafts with your approval."
        : "Read availability for scheduling replies (user-approved drafts only).",
    },
    {
      id: "follow_up_tracking",
      status: "available",
      description: "Follow-up intelligence on open threads (existing).",
    },
    {
      id: "smart_reminders",
      status: "planned",
      description: "Opt-in reminders — never auto-send or auto-complete.",
    },
    {
      id: "tasks",
      status: "planned",
      description: "Lightweight tasks linked to emails (optional, calm).",
    },
    {
      id: "crm_memory",
      status: "planned",
      description: "Relationship and sender memory across threads.",
    },
  ];
}
