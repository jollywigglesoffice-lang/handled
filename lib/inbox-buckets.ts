import {
  resolveCategoryWithCatalog,
  type InboxCategoryCatalog,
} from "@/lib/inbox-category-catalog";
import { EMPTY_CATEGORY_CATALOG, initCategoryBuckets, initCategoryCounts } from "@/lib/inbox-category-catalog";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  gmailCategoryOrderForMode,
  isClutterCategory,
  primaryCategoryOrderForMode,
  shouldCollapseClutter,
  shouldShowMessageInWorkflow,
} from "@/lib/workflow-mode-inbox";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";
import type { WorkflowMode } from "@/lib/workflow-mode";

export type InboxBucketMessage = {
  id: string;
  category: InboxAiCategory;
  relationship?: SenderRelationshipProfile;
};

export type InboxBuckets<T extends InboxBucketMessage> = {
  catalog: InboxCategoryCatalog;
  allVisible: T[];
  byCategory: Record<string, T[]>;
  counts: Record<string, number>;
  categoryOrder: InboxAiCategory[];
  needsAttentionEmails: T[];
  quickReplyEmails: T[];
  handledEmails: T[];
  newsletterEmails: T[];
  promotionEmails: T[];
  todayAttentionCount: number;
  priorityCount: number;
  totalVisible: number;
  clutterEmails: T[];
  clutterCount: number;
  showClutterSection: boolean;
};

function emptyBuckets<T extends InboxBucketMessage>(
  catalog: InboxCategoryCatalog,
): InboxBuckets<T> {
  const byCategory = initCategoryBuckets<T>(catalog);
  const counts = initCategoryCounts(catalog);

  return {
    catalog,
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
    clutterEmails: [],
    clutterCount: 0,
    showClutterSection: false,
  };
}

/**
 * Single source of truth for inbox lists and counts.
 * Apply category overrides before calling.
 */
export function buildInboxBuckets<T extends InboxBucketMessage>(
  messages: T[],
  workflowMode: WorkflowMode,
  catalog: InboxCategoryCatalog = EMPTY_CATEGORY_CATALOG,
): InboxBuckets<T> {
  if (messages.length === 0) {
    return emptyBuckets(catalog);
  }

  const collapseClutter = shouldCollapseClutter(workflowMode);

  const clutterEmails = collapseClutter
    ? messages
        .filter((m) => isClutterCategory(m.category))
        .map((m) => ({
          ...m,
          category: resolveCategoryWithCatalog(m.category, catalog),
        }))
    : [];

  const visible = messages.filter((m) =>
    shouldShowMessageInWorkflow(
      {
        category: resolveCategoryWithCatalog(m.category, catalog),
        relationship: m.relationship,
      },
      workflowMode,
    ),
  );

  const byCategory = initCategoryBuckets<T>(catalog);

  for (const raw of visible) {
    const category = resolveCategoryWithCatalog(raw.category, catalog);
    if (collapseClutter && isClutterCategory(category)) continue;
    const row = { ...raw, category };
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(row);
  }

  const counts = { ...initCategoryCounts(catalog) };
  for (const id of catalog.allIds) {
    counts[id] = byCategory[id]?.length ?? 0;
  }
  for (const id of Object.keys(byCategory)) {
    counts[id] = byCategory[id]?.length ?? 0;
  }

  const orderSource = collapseClutter
    ? primaryCategoryOrderForMode(workflowMode, catalog)
    : gmailCategoryOrderForMode(workflowMode, catalog);

  const categoryOrder = orderSource.filter((c) => (counts[c] ?? 0) > 0);

  const needsAttentionEmails = byCategory.needs_attention ?? [];
  const quickReplyEmails = byCategory.quick_reply ?? [];

  return {
    catalog,
    allVisible: categoryOrder.flatMap((c) => byCategory[c] ?? []),
    byCategory,
    counts,
    categoryOrder,
    needsAttentionEmails,
    quickReplyEmails,
    handledEmails: byCategory.handled ?? [],
    newsletterEmails: byCategory.newsletter ?? [],
    promotionEmails: byCategory.promotion ?? [],
    todayAttentionCount: needsAttentionEmails.length,
    priorityCount: needsAttentionEmails.length + quickReplyEmails.length,
    totalVisible: visible.length,
    clutterEmails,
    clutterCount: clutterEmails.length,
    showClutterSection: collapseClutter && clutterEmails.length > 0,
  };
}

export function applyCategoryOverrides<
  T extends InboxBucketMessage & { categorySource?: string },
>(messages: T[], overrides: Record<string, InboxAiCategory>): T[] {
  if (Object.keys(overrides).length === 0) {
    return messages;
  }
  return messages.map((m) => {
    const override = overrides[m.id];
    if (m.categorySource === "manual_override" && !override) {
      return m;
    }
    if (!override) return m;
    if (m.category === override && m.categorySource === "manual_override") {
      return m;
    }
    return {
      ...m,
      category: override,
      categorySource: "manual_override",
    };
  });
}
