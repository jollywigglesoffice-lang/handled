import type { ActionLabelId, ImpliedActionKind } from "@/lib/action-intelligence/types";

const KIND_TO_LABEL: Partial<Record<ImpliedActionKind, ActionLabelId>> = {
  urgent: "urgent",
  deadline: "deadline",
  payment: "payment",
  approval: "review",
  review: "review",
  reply_needed: "reply_needed",
  meeting: "meeting",
  scheduling: "meeting",
  send_file: "review",
  follow_up: "follow_up",
  reminder: "follow_up",
  waiting_on_them: "waiting",
  waiting_on_you: "reply_needed",
};

/** Priority for primary label (higher wins). */
const LABEL_PRIORITY: Record<ActionLabelId, number> = {
  urgent: 100,
  deadline: 90,
  payment: 85,
  meeting: 80,
  reply_needed: 75,
  review: 70,
  follow_up: 60,
  waiting: 50,
};

const LABELS_EN: Record<ActionLabelId, string> = {
  reply_needed: "Reply needed",
  follow_up: "Follow up",
  waiting: "Waiting",
  deadline: "Deadline",
  payment: "Payment",
  review: "Review",
  meeting: "Meeting",
  urgent: "Urgent",
};

const LABELS_IT: Record<ActionLabelId, string> = {
  reply_needed: "Risposta richiesta",
  follow_up: "Follow-up",
  waiting: "In attesa",
  deadline: "Scadenza",
  payment: "Pagamento",
  review: "Revisione",
  meeting: "Riunione",
  urgent: "Urgente",
};

export function impliedActionsToLabels(implied: ImpliedActionKind[]): ActionLabelId[] {
  const labels = new Set<ActionLabelId>();
  for (const kind of implied) {
    const label = KIND_TO_LABEL[kind];
    if (label) labels.add(label);
  }
  return [...labels].sort((a, b) => LABEL_PRIORITY[b] - LABEL_PRIORITY[a]);
}

export function pickPrimaryLabel(labels: ActionLabelId[]): ActionLabelId | null {
  if (!labels.length) return null;
  return [...labels].sort((a, b) => LABEL_PRIORITY[b] - LABEL_PRIORITY[a])[0]!;
}

export function actionLabelTitle(id: ActionLabelId, locale: "en" | "it" = "en"): string {
  return locale === "it" ? LABELS_IT[id] : LABELS_EN[id];
}

export function actionLabelTone(id: ActionLabelId): string {
  switch (id) {
    case "urgent":
    case "deadline":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "payment":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "meeting":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "waiting":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "follow_up":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "reply_needed":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "review":
      return "border-teal-200 bg-teal-50 text-teal-900";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}
