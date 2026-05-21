import type { DailyBriefingIntegrationDescriptor } from "@/lib/daily-briefing/types";

export function listDailyBriefingIntegrations(): DailyBriefingIntegrationDescriptor[] {
  return [
    {
      id: "morning_email_digest",
      status: "planned",
      description: "Optional morning email digest — opt-in only, calm tone.",
    },
    {
      id: "push_summary",
      status: "planned",
      description: "Gentle push summaries — never alarm-style notifications.",
    },
    {
      id: "ai_daily_planning",
      status: "planned",
      description: "AI-assisted daily planning with explicit user approval.",
    },
    {
      id: "productivity_summary",
      status: "planned",
      description: "Operational productivity view without guilt or scorekeeping.",
    },
    {
      id: "weekly_review",
      status: "planned",
      description: "Weekly calm review of threads, follow-ups, and wins.",
    },
  ];
}
