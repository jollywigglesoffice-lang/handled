import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { upsertClientEmailOverride } from "@/lib/email-overrides/client-storage";
import { loadClientInboxRules, saveClientInboxRules } from "@/lib/inbox-rules-client-storage";
import {
  loadClientSenderPreferences,
  mergeSenderPreferences,
  preferenceFromSender,
  saveClientSenderPreferences,
} from "@/lib/inbox-sender-preferences";
import { applySenderRuleToMessages } from "@/lib/sender-rules/apply-to-messages";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export type CategoryFeedbackInput = {
  emailId: string;
  sender: string;
  subject: string;
  snippet?: string;
  guessedCategory: InboxAiCategory;
  chosenCategory: InboxAiCategory;
  scope: CategoryApplyScope;
};

export type CategoryFeedbackResult = {
  message: string;
  rules?: InboxUserRule[];
  affectedCount?: number;
  learnedSender?: boolean;
};

export async function submitCategoryFeedback(
  input: CategoryFeedbackInput,
): Promise<CategoryFeedbackResult> {
  if (input.scope === "this_email") {
    const now = new Date().toISOString();
    upsertClientEmailOverride({
      emailId: input.emailId,
      originalCategory: input.guessedCategory,
      overriddenCategory: input.chosenCategory,
      createdAt: now,
      updatedAt: now,
    });
  }

  const clientPrefs = loadClientSenderPreferences();
  const mergedPrefs =
    input.scope === "sender"
      ? mergeSenderPreferences(
          clientPrefs,
          preferenceFromSender(
            input.sender,
            input.chosenCategory,
            `Always: ${input.chosenCategory.replace(/_/g, " ")}`,
          ),
        )
      : clientPrefs;

  if (input.scope === "sender") {
    saveClientSenderPreferences(mergedPrefs);
  }

  const res = await fetch("/api/inbox-feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "correct_category",
      emailId: input.emailId,
      sender: input.sender,
      subject: input.subject,
      snippet: input.snippet,
      guessedCategory: input.guessedCategory,
      category: input.chosenCategory,
      scope: input.scope,
      clientPreferences: input.scope === "sender" ? mergedPrefs : undefined,
      clientRules: loadClientInboxRules(),
    }),
  });

  const data = (await res.json()) as {
    message?: string;
    rules?: InboxUserRule[];
    error?: string;
    learnedSender?: boolean;
  };

  if (data.rules?.length) {
    saveClientInboxRules(data.rules);
  }

  if (!res.ok) {
    if (input.scope === "this_email") {
      return {
        message: "Saved on this device — will sync when online.",
        affectedCount: 1,
      };
    }
    throw new Error(data.error ?? "Could not save preference");
  }

  const scopeMessages: Record<CategoryApplyScope, string> = {
    this_email: data.message ?? "Saved",
    sender: "Learned sender rule saved — matching emails updated.",
    similar: "Handled will match similar subject lines going forward.",
  };

  return {
    message: data.message ?? scopeMessages[input.scope],
    rules: data.rules,
    learnedSender: data.learnedSender ?? input.scope === "sender",
    affectedCount: input.scope === "this_email" ? 1 : undefined,
  };
}

export { applySenderRuleToMessages };
