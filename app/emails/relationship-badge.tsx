"use client";

import { relationshipLabelTone } from "@/lib/relationship-intelligence/labels";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

const TONE_CLASS: Record<ReturnType<typeof relationshipLabelTone>, string> = {
  warm: "border-rose-200 bg-rose-50 text-rose-900",
  professional: "border-indigo-200 bg-indigo-50 text-indigo-900",
  calm: "border-teal-200 bg-teal-50 text-teal-900",
  muted: "border-slate-200 bg-slate-50 text-slate-600",
};

type RelationshipBadgeProps = {
  relationship: SenderRelationshipProfile;
};

export function RelationshipBadge({ relationship }: RelationshipBadgeProps) {
  const tone = relationshipLabelTone(relationship.kind, relationship.importance);
  const cls = TONE_CLASS[tone];

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${cls}`}
      title={`Handled knows this sender as ${relationship.label}`}
    >
      {relationship.label}
      {relationship.importance === "vip" ? " · VIP" : null}
    </span>
  );
}
