"use client";

import { followUpMilestoneLabel } from "@/lib/waiting-on/helpers";
import { FOLLOW_UP_PRESETS } from "@/lib/waiting-on/types";
import type { WaitingUrgencyStyle } from "@/lib/waiting-on/urgency";

type WaitingFollowUpTimerProps = {
  daysWaiting: number;
  locale: "en" | "it";
  urgencyStyle: WaitingUrgencyStyle;
  selectedFollowUpDays?: number;
};

const COPY = {
  en: { title: "Follow-up timer" },
  it: { title: "Timer follow-up" },
} as const;

export function WaitingFollowUpTimer({
  daysWaiting,
  locale,
  urgencyStyle,
  selectedFollowUpDays,
}: WaitingFollowUpTimerProps) {
  const t = COPY[locale];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.title}</p>
      <ul className="flex flex-wrap gap-2">
        {FOLLOW_UP_PRESETS.map((milestone) => {
          const reached = daysWaiting >= milestone;
          const isSelected = selectedFollowUpDays === milestone;
          const active = reached || isSelected;
          return (
            <li key={milestone}>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? `${urgencyStyle.statusClass} border-current/20`
                    : "border-[#E2E8F0] bg-white text-gray-400"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    active ? "bg-current" : "bg-gray-300"
                  }`}
                />
                {followUpMilestoneLabel(milestone, locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
