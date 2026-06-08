/** Days-waiting urgency bands for Waiting On highlighting. */
export type WaitingUrgency = "fresh" | "attention" | "overdue";

export function waitingUrgency(days: number): WaitingUrgency {
  if (days <= 7) return "fresh";
  if (days <= 14) return "attention";
  return "overdue";
}

export type WaitingUrgencyStyle = {
  borderClass: string;
  bgClass: string;
  statusClass: string;
  timerClass: string;
};

export const WAITING_URGENCY_STYLES: Record<WaitingUrgency, WaitingUrgencyStyle> = {
  fresh: {
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-50/25",
    statusClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    timerClass: "text-emerald-800",
  },
  attention: {
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-50/30",
    statusClass: "border-amber-200 bg-amber-50 text-amber-900",
    timerClass: "text-amber-900",
  },
  overdue: {
    borderClass: "border-l-red-500",
    bgClass: "bg-red-50/25",
    statusClass: "border-red-200 bg-red-50 text-red-800",
    timerClass: "text-red-800",
  },
};

export function waitingUrgencyStyle(days: number): WaitingUrgencyStyle {
  return WAITING_URGENCY_STYLES[waitingUrgency(days)];
}

/** 30+ days — urgent indicator on top of overdue styling. */
export function isWaitingUrgent(days: number): boolean {
  return days >= 30;
}
