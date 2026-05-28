import type { InboxAiCategory, CategorySource } from "@/lib/inbox-ai-categories";

export type MessageWithCategory = {
  id: string;
  category: InboxAiCategory;
  categorySource?: CategorySource;
  categoryConfidence?: number;
};

/** Force per-email manual overrides onto message rows (server + client). */
export function stampEmailOverridesOnMessages<T extends MessageWithCategory>(
  messages: T[],
  emailOverrides: Record<string, InboxAiCategory>,
): T[] {
  if (!Object.keys(emailOverrides).length) return messages;

  return messages.map((message) => {
    const forced = emailOverrides[message.id];
    if (!forced) return message;
    if (message.category === forced && message.categorySource === "manual_override") {
      return message;
    }
    return {
      ...message,
      category: forced,
      categorySource: "manual_override" as const,
      categoryConfidence: 1,
    };
  });
}
