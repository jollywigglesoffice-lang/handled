import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { persistEmailOverrideToAccount } from "@/lib/email-overrides/client-sync";
import { loadClientInboxRules, saveClientInboxRules } from "@/lib/inbox-rules-client-storage";
import {
  loadClientSenderPreferences,
  mergeSenderPreferences,
  preferenceFromSender,
  saveClientSenderPreferences,
} from "@/lib/inbox-sender-preferences";
import { applySenderRuleToMessages } from "@/lib/sender-rules/apply-to-messages";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import {
  getSenderLearningSuggestion,
  recordSenderCategoryCorrection,
  shouldAutoLearnSenderRule,
} from "@/lib/sender-correction-learning";

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
  /** Shown when the user repeatedly corrects the same sender (e.g. school → needs attention). */
  senderLearningSuggestion?: string;
};

async function persistSenderRule(input: {
  sender: string;
  chosenCategory: InboxAiCategory;
  clientPreferences?: ReturnType<typeof loadClientSenderPreferences>;
}): Promise<{ ok: boolean; learnedSender: boolean }> {
  const mergedPrefs = mergeSenderPreferences(
    input.clientPreferences ?? loadClientSenderPreferences(),
    preferenceFromSender(
      input.sender,
      input.chosenCategory,
      `Always: ${input.chosenCategory.replace(/_/g, " ")}`,
    ),
  );
  saveClientSenderPreferences(mergedPrefs);

  const res = await fetch("/api/inbox-feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "correct_category",
      emailId: "",
      sender: input.sender,
      subject: "",
      guessedCategory: input.chosenCategory,
      category: input.chosenCategory,
      scope: "sender",
      clientPreferences: mergedPrefs,
      clientRules: loadClientInboxRules(),
    }),
  });

  return { ok: res.ok, learnedSender: res.ok };
}

export async function submitCategoryFeedback(
  input: CategoryFeedbackInput,
): Promise<CategoryFeedbackResult> {
  const learningRecord = recordSenderCategoryCorrection({
    sender: input.sender,
    guessedCategory: input.guessedCategory,
    chosenCategory: input.chosenCategory,
  });

  let effectiveScope: CategoryApplyScope = input.scope;

  if (
    input.scope === "this_email" &&
    shouldAutoLearnSenderRule(learningRecord, input.chosenCategory)
  ) {
    effectiveScope = "sender";
  }

  if (effectiveScope === "this_email") {
    await persistEmailOverrideToAccount({
      emailId: input.emailId,
      overriddenCategory: input.chosenCategory,
      originalCategory: input.guessedCategory,
    });
  }

  if (effectiveScope === "sender") {
    const senderResult = await persistSenderRule({
      sender: input.sender,
      chosenCategory: input.chosenCategory,
    });
    if (senderResult.ok) {
      return {
        message:
          input.scope === "this_email"
            ? "Saved — future mail from this sender will follow your choice."
            : "Learned sender rule saved — matching emails updated.",
        learnedSender: true,
        affectedCount: input.scope === "this_email" ? 1 : undefined,
      };
    }
    if (input.scope === "sender") {
      throw new Error("Could not save sender preference");
    }
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
    override?: { emailId: string };
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
    similar: "Similar subjects will follow this category going forward.",
  };

  const senderLearningSuggestion =
    learningRecord && learningRecord.correctionsToNeedsAttention >= 2
      ? getSenderLearningSuggestion(input.sender)?.message
      : undefined;

  return {
    message: data.message ?? scopeMessages[input.scope],
    rules: data.rules,
    learnedSender: data.learnedSender ?? input.scope === "sender",
    affectedCount: input.scope === "this_email" ? 1 : undefined,
    senderLearningSuggestion,
  };
}

export { applySenderRuleToMessages };
