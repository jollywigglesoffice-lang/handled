"use client";

import type { ConversationStatus } from "@/lib/timeline-intelligence";
import {
  conversationStatusLabel,
  conversationStatusTone,
} from "@/lib/timeline-intelligence/labels";

type ConversationStatusChipProps = {
  status: ConversationStatus;
  locale?: "en" | "it";
  compact?: boolean;
};

export function ConversationStatusChip({
  status,
  locale = "en",
  compact,
}: ConversationStatusChipProps) {
  return (
    <span
      className={`inline-flex rounded-full border font-medium ${conversationStatusTone(status)} ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {conversationStatusLabel(status, locale)}
    </span>
  );
}
