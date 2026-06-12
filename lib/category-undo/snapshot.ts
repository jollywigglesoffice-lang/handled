import type { CategoryApplyScope } from "@/lib/category-correction";
import { loadClientEmailOverrides } from "@/lib/email-overrides/client-storage";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  loadClientSenderPreferences,
  preferenceFromSender,
  senderMatchesPreference,
} from "@/lib/inbox-sender-preferences";
import { loadClientInboxRules } from "@/lib/inbox-rules-client-storage";
import type { CategoryUndoMessageState, CategoryUndoSnapshot } from "@/lib/category-undo/types";

type MessageRow = CategoryUndoMessageState & {
  sender: string;
};

export function buildCategoryUndoSnapshot(input: {
  scope: CategoryApplyScope;
  triggerEmailId: string;
  senderLine?: string;
  newCategory: InboxAiCategory;
  messages: MessageRow[];
  categoryOverrides: Record<string, InboxAiCategory>;
  /** Bulk selection — overrides scope-based affected resolution. */
  explicitAffectedIds?: string[];
}): CategoryUndoSnapshot {
  const {
    scope,
    triggerEmailId,
    senderLine,
    newCategory,
    messages,
    categoryOverrides,
    explicitAffectedIds,
  } = input;

  let affectedIds = explicitAffectedIds ?? [triggerEmailId];
  if (!explicitAffectedIds && scope === "sender" && senderLine) {
    const pref = preferenceFromSender(senderLine, newCategory);
    affectedIds = messages
      .filter((m) => senderMatchesPreference({ sender: m.sender }, pref))
      .map((m) => m.id);
    if (!affectedIds.includes(triggerEmailId)) {
      affectedIds = [triggerEmailId, ...affectedIds];
    }
  }

  return {
    scope,
    triggerEmailId,
    senderLine,
    newCategory,
    affectedIds,
    previousMessages: messages.map((m) => ({
      id: m.id,
      accountId: m.accountId,
      category: m.category,
      categorySource: m.categorySource,
    })),
    previousOverrides: { ...categoryOverrides },
    previousEmailOverrides: loadClientEmailOverrides(),
    previousSenderPrefs: loadClientSenderPreferences(),
    previousInboxRules: loadClientInboxRules(),
  };
}
