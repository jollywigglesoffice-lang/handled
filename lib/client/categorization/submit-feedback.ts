import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";
import {
  logSenderRuleDebug,
  resolveSenderIdentity,
  senderIdentityForTeachHandled,
} from "@/lib/sender-identity";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategoryApplyScope } from "@/lib/category-correction";
import { persistEmailOverrideToAccount } from "@/lib/email-overrides/client-sync";
import { loadClientEmailOverrideMap } from "@/lib/email-overrides/client-storage";
import { lookupScopedValue, scopedEmailKey } from "@/lib/gmail/account-types";
import { loadClientInboxRules, saveClientInboxRules } from "@/lib/inbox-rules-client-storage";
import {
  loadClientSenderPreferences,
  mergeSenderPreferences,
  preferenceFromSender,
  saveClientSenderPreferences,
} from "@/lib/inbox-sender-preferences";
import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import {
  getSenderLearningSuggestion,
  recordSenderCategoryCorrection,
  shouldAutoLearnSenderRule,
} from "@/lib/sender-correction-learning";
import { collectCategoryCorrection } from "@/lib/memory-engine/collect";

export type CategoryFeedbackInput = {
  emailId: string;
  sender: string;
  subject: string;
  snippet?: string;
  guessedCategory: InboxAiCategory;
  chosenCategory: InboxAiCategory;
  scope: CategoryApplyScope;
  accountId?: string;
};

export type CategoryFeedbackResult = {
  message: string;
  rules?: InboxUserRule[];
  affectedCount?: number;
  learnedSender?: boolean;
  senderLearningSuggestion?: string;
};

async function persistSenderRule(input: {
  sender: string;
  chosenCategory: InboxAiCategory;
  emailId?: string;
  subject?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const identity = resolveSenderIdentity(input.sender);
  if (!identity.ruleKey) {
    logSenderRuleDebug("persistSenderRule blocked — no sender identity", {
      sender: input.sender,
    });
    return { ok: false, error: "Could not identify sender — try correcting this email only." };
  }

  const mergedPrefs = mergeSenderPreferences(
    loadClientSenderPreferences(),
    preferenceFromSender(
      input.sender,
      input.chosenCategory,
      `Always: ${input.chosenCategory.replace(/_/g, " ")}`,
    ),
  );
  saveClientSenderPreferences(mergedPrefs);

  const payload = {
    action: "correct_category",
    emailId: input.emailId ?? "",
    sender: input.sender,
    subject: input.subject ?? "",
    guessedCategory: input.chosenCategory,
    category: input.chosenCategory,
    scope: "sender" as const,
    clientPreferences: mergedPrefs,
    clientRules: loadClientInboxRules(),
  };

  logSenderRuleDebug("teachHandled payload (client → /api/inbox-feedback)", {
    ...senderIdentityForTeachHandled({
      emailId: input.emailId,
      sender: input.sender,
      subject: input.subject,
      scope: "sender",
      category: input.chosenCategory,
    }),
    preferenceCount: mergedPrefs.length,
  });

  const res = await fetch("/api/inbox-feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...(await protectedApiHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string; learnedSender?: boolean };

  if (res.ok) {
    logSenderRuleDebug("sender-rule save result", {
      ok: true,
      status: res.status,
      learnedSender: data.learnedSender,
      preferenceCount: mergedPrefs.length,
    });
    return { ok: true };
  }

  logSenderRuleDebug("sender-rule save failure", {
    ok: false,
    status: res.status,
    error: data.error,
  });
  return { ok: false, error: data.error ?? `HTTP ${res.status}` };
}

export async function submitCategoryFeedback(
  input: CategoryFeedbackInput,
): Promise<CategoryFeedbackResult> {
  const learningRecord = recordSenderCategoryCorrection({
    sender: input.sender,
    guessedCategory: input.guessedCategory,
    chosenCategory: input.chosenCategory,
    accountId: input.accountId,
  });

  const autoLearnSender =
    input.scope === "this_email" &&
    shouldAutoLearnSenderRule(learningRecord, input.chosenCategory);

  if (input.scope === "this_email" || autoLearnSender) {
    await persistEmailOverrideToAccount({
      emailId: input.emailId,
      overriddenCategory: input.chosenCategory,
      originalCategory: input.guessedCategory,
      accountId: input.accountId,
    });
  } else if (input.scope === "sender") {
    // Manual overrides outrank sender rules. If the trigger email already has
    // a persisted manual override, refresh it to the user's latest choice so
    // a stale override can't snap this email back after the rule applies.
    const overrideMap = loadClientEmailOverrideMap();
    const existing = lookupScopedValue(overrideMap, input.emailId, input.accountId);
    if (existing && existing !== input.chosenCategory) {
      await persistEmailOverrideToAccount({
        emailId: input.emailId,
        overriddenCategory: input.chosenCategory,
        originalCategory: input.guessedCategory,
        accountId: input.accountId,
      });
    }
  }

  if (input.scope === "sender" || autoLearnSender) {
    const senderSave = await persistSenderRule({
      sender: input.sender,
      chosenCategory: input.chosenCategory,
      emailId: input.emailId,
      subject: input.subject,
    });
    if (senderSave.ok) {
      return {
        message: autoLearnSender
          ? "Saved — future mail from this sender will follow your choice."
          : "Learned sender rule saved — matching emails updated.",
        learnedSender: true,
        affectedCount: input.scope === "this_email" ? 1 : undefined,
      };
    }
    if (input.scope === "sender") {
      throw new Error(senderSave.error ?? "Could not save sender preference");
    }
  }

  const res = await fetch("/api/inbox-feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...(await protectedApiHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "correct_category",
      // Account-scoped storage key — Gmail ids are only unique per mailbox.
      emailId: scopedEmailKey(input.emailId, input.accountId),
      sender: input.sender,
      subject: input.subject,
      snippet: input.snippet,
      guessedCategory: input.guessedCategory,
      category: input.chosenCategory,
      scope: input.scope,
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
    similar: "Similar subjects will follow this category going forward.",
  };

  const senderLearningSuggestion =
    learningRecord && learningRecord.correctionsToNeedsAttention >= 2
      ? getSenderLearningSuggestion(input.sender)?.message
      : undefined;

  void collectCategoryCorrection({
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    subject: input.subject,
    guessedCategory: input.guessedCategory,
    chosenCategory: input.chosenCategory,
    scope: input.scope,
  });

  return {
    message: data.message ?? scopeMessages[input.scope],
    rules: data.rules,
    learnedSender: data.learnedSender ?? autoLearnSender,
    affectedCount: input.scope === "this_email" ? 1 : undefined,
    senderLearningSuggestion,
  };
}
