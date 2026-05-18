import {
  INBOX_AI_CATEGORY_VALUES,
  normalizeInboxAiCategory,
  type InboxAiCategory,
} from "@/lib/inbox-ai-categories";
import {
  GMAIL_CATEGORY_ORDER_BY_MODE,
  shouldShowMessageInWorkflow,
} from "@/lib/workflow-mode-inbox";
import type { WorkflowMode } from "@/lib/workflow-mode";

export type InboxBucketMessage = {
  id: string;
  category: InboxAiCategory;
};

export type InboxBuckets<T extends InboxBucketMessage> = {
  /** Visible messages after workflow filter, in stable category order */
  allVisible: T[];
  byCategory: Record<InboxAiCategory, T[]>;
  counts: Record<InboxAiCategory, number>;
  categoryOrder: InboxAiCategory[];
  needsAttentionEmails: T[];
  quickReplyEmails: T[];
  handledEmails: T[];
  newsletterEmails: T[];
  promotionEmails: T[];
  /** Same as `counts.needs_attention` — use for Today card copy */
  todayAttentionCount: number;
  /** needs_attention + quick_reply (if you need a broader priority metric) */
  priorityCount: number;
  totalVisible: number;
};

function emptyBuckets<T extends InboxBucketMessage>(): InboxBuckets<T> {
  const byCategory = Object.fromEntries(
    INBOX_AI_CATEGORY_VALUES.map((c) => [c, [] as T[]]),
  ) as Record<InboxAiCategory, T[]>;
  const counts = Object.fromEntries(
    INBOX_AI_CATEGORY_VALUES.map((c) => [c, 0]),
  ) as Record<InboxAiCategory, number>;

  return {
    allVisible: [],
    byCategory,
    counts,
    categoryOrder: [],
    needsAttentionEmails: [],
    quickReplyEmails: [],
    handledEmails: [],
    newsletterEmails: [],
    promotionEmails: [],
    todayAttentionCount: 0,
    priorityCount: 0,
    totalVisible: 0,
  };
}

/**
 * Single source of truth for inbox lists and counts.
 * Apply category overrides before calling.
 */
export function buildInboxBuckets<T extends InboxBucketMessage>(
  messages: T[],
  workflowMode: WorkflowMode,
): InboxBuckets<T> {
  if (messages.length === 0) {
    return emptyBuckets();
  }

  const visible = messages.filter((m) =>
    shouldShowMessageInWorkflow(
      { category: normalizeInboxAiCategory(m.category) },
      workflowMode,
    ),
  );

  const byCategory = Object.fromEntries(
    INBOX_AI_CATEGORY_VALUES.map((c) => [c, [] as T[]]),
  ) as Record<InboxAiCategory, T[]>;

  for (const raw of visible) {
    const category = normalizeInboxAiCategory(raw.category);
    const row = { ...raw, category };
    byCategory[category].push(row);
  }

  const counts = Object.fromEntries(
    INBOX_AI_CATEGORY_VALUES.map((c) => [c, byCategory[c].length]),
  ) as Record<InboxAiCategory, number>;

  const categoryOrder = GMAIL_CATEGORY_ORDER_BY_MODE[workflowMode].filter(
    (c) => byCategory[c].length > 0,
  );

  const needsAttentionEmails = byCategory.needs_attention;
  const quickReplyEmails = byCategory.quick_reply;

  return {
    allVisible: categoryOrder.flatMap((c) => byCategory[c]),
    byCategory,
    counts,
    categoryOrder,
    needsAttentionEmails,
    quickReplyEmails,
    handledEmails: byCategory.handled,
    newsletterEmails: byCategory.newsletter,
    promotionEmails: byCategory.promotion,
    todayAttentionCount: needsAttentionEmails.length,
    priorityCount: needsAttentionEmails.length + quickReplyEmails.length,
    totalVisible: visible.length,
  };
}

export function applyCategoryOverrides<T extends InboxBucketMessage>(
  messages: T[],
  overrides: Record<string, InboxAiCategory>,
): T[] {
  if (Object.keys(overrides).length === 0) return messages;
  return messages.map((m) => ({
    ...m,
    category: overrides[m.id] ?? m.category,
  }));
}
