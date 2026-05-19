import type { ConversationState } from "@/lib/follow-up/types";

export function senderFirstNameFromRow(sender: string): string {
  const name = sender.replace(/<[^>]+>/, "").trim();
  const first = name.split(/\s+/)[0]?.replace(/["']/g, "");
  if (!first || first.includes("@")) return "there";
  return first;
}

export function conversationStateLabel(state: ConversationState, locale: "en" | "it"): string {
  const en: Record<ConversationState, string> = {
    awaiting_your_reply: "Awaiting your reply",
    waiting_for_response: "Waiting for response",
    follow_up_recommended: "Follow-up recommended",
    pending_scheduling: "Pending scheduling",
    user_commitment_pending: "Your commitment pending",
    conversation_unresolved: "Conversation unresolved",
  };
  const it: Record<ConversationState, string> = {
    awaiting_your_reply: "In attesa della tua risposta",
    waiting_for_response: "In attesa di risposta",
    follow_up_recommended: "Follow-up consigliato",
    pending_scheduling: "Da programmare",
    user_commitment_pending: "Impegno da completare",
    conversation_unresolved: "Conversazione aperta",
  };
  return locale === "it" ? it[state] : en[state];
}
