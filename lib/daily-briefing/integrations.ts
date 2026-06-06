import type {
  BriefingScheduleDescriptor,
  DailyBriefingIntegrationDescriptor,
} from "@/lib/daily-briefing/types";

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

/** Future briefing delivery — only on_open is active in the inbox card today. */
export function listBriefingSchedules(): BriefingScheduleDescriptor[] {
  return [
    {
      kind: "on_open",
      status: "active",
      description: "Calm inbox card when you open Handled.",
    },
    {
      kind: "morning",
      status: "planned",
      description: "Morning briefing at a chosen time.",
    },
    {
      kind: "weekly",
      status: "planned",
      description: "Weekly wrap-up of what moved and what can wait.",
    },
    {
      kind: "digest_email",
      status: "planned",
      description: "Optional email digest — opt-in only.",
    },
  ];
}
