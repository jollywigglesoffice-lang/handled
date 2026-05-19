"use client";

import {
  actionLabelTitle,
  actionLabelTone,
  type ActionLabelId,
} from "@/lib/action-intelligence";

type ActionLabelChipProps = {
  label: ActionLabelId;
  locale?: "en" | "it";
  compact?: boolean;
};

export function ActionLabelChip({
  label,
  locale = "en",
  compact,
}: ActionLabelChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${actionLabelTone(label)} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {actionLabelTitle(label, locale)}
    </span>
  );
}
