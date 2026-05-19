import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategorySectionTitle } from "@/lib/inbox-ai-categories";

/**
 * Future-ready copy when Handled detects repeated manual moves for one sender.
 * Wire up once correction history is persisted server-side.
 */
export function suggestSenderAutoRuleMessage(
  senderLabel: string,
  category: InboxAiCategory,
  locale: "en" | "it" = "en",
): string {
  const dest = inboxCategorySectionTitle(category, locale);
  if (category === "needs_attention") {
    return locale === "it"
      ? `Prioritizzare sempre le email da ${senderLabel}? Le metterò in ${dest}.`
      : `Always prioritize emails from ${senderLabel}? I'll put them in ${dest}.`;
  }
  return locale === "it"
    ? `Ho notato che sposti spesso le email da ${senderLabel} in ${dest}. Vuoi che lo faccia automaticamente?`
    : `I noticed you consistently move emails from ${senderLabel} into ${dest}. Want me to do that automatically?`;
}
