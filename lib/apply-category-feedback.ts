import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { loadClientInboxRules, saveClientInboxRules } from "@/lib/inbox-rules-client-storage";
import {
  loadClientSenderPreferences,
  preferenceFromSender,
  saveClientSenderPreferences,
} from "@/lib/inbox-sender-preferences";
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

export async function submitCategoryFeedback(
  input: CategoryFeedbackInput,
): Promise<{ message: string; rules?: InboxUserRule[] }> {
  const clientPrefs = loadClientSenderPreferences();
  const mergedPrefs =
    input.scope === "sender"
      ? [
          preferenceFromSender(
            input.sender,
            input.chosenCategory,
            `Always: ${input.chosenCategory.replace(/_/g, " ")}`,
          ),
          ...clientPrefs,
        ]
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
  };

  if (data.rules?.length) {
    saveClientInboxRules(data.rules);
  }

  if (!res.ok && input.scope !== "this_email") {
    throw new Error(data.error ?? "Could not save preference");
  }

  return {
    message:
      data.message ??
      (input.scope === "this_email"
        ? "Updated for this email."
        : input.scope === "sender"
          ? "Handled will remember this sender."
          : "Handled will match similar subjects."),
    rules: data.rules,
  };
}
