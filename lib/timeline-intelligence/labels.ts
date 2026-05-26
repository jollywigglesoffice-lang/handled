import type { ConversationStatus, EmotionalTrajectory } from "@/lib/timeline-intelligence/types";

const STATUS_EN: Record<ConversationStatus, string> = {
  open: "Open",
  waiting: "Waiting",
  escalating: "Needs reply",
  resolved: "Resolved",
  stalled: "Stalled",
  needs_follow_up: "Still open",
};

const STATUS_IT: Record<ConversationStatus, string> = {
  open: "Aperta",
  waiting: "In attesa",
  escalating: "Serve risposta",
  resolved: "Risolta",
  stalled: "In stallo",
  needs_follow_up: "Ancora aperta",
};

export function conversationStatusLabel(
  status: ConversationStatus,
  locale: "en" | "it" = "en",
): string {
  return locale === "it" ? STATUS_IT[status] : STATUS_EN[status];
}

export function conversationStatusTone(status: ConversationStatus): string {
  switch (status) {
    case "escalating":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "stalled":
    case "waiting":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "needs_follow_up":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
}

export function trajectoryLabel(
  trajectory: EmotionalTrajectory,
  locale: "en" | "it" = "en",
): string {
  const en: Record<EmotionalTrajectory, string> = {
    calm: "Calm",
    urgent: "Time-sensitive",
    frustrated: "Frustrated",
    actionable: "Actionable",
    informational: "Informational",
    escalating: "Escalating",
  };
  const it: Record<EmotionalTrajectory, string> = {
    calm: "Calmo",
    urgent: "Sensibile al tempo",
    frustrated: "Frustrato",
    actionable: "Richiede azione",
    informational: "Informativo",
    escalating: "In escalatione",
  };
  return locale === "it" ? it[trajectory] : en[trajectory];
}
