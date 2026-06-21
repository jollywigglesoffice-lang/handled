/**
 * Memory Engine V1 — collect user behavior and sync to server + local cache.
 */

import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { CategoryApplyScope } from "@/lib/category-correction";
import type { CompletionActionId } from "@/lib/completion-actions/types";
import { handledDebugLog } from "@/lib/handled-debug";
import { recordClientMemoryCorrection } from "@/lib/memory-engine/client-cache";
import type { BehaviorContext, MemoryCollectPayload } from "@/lib/memory-engine/types";

type CollectCategoryCorrectionInput = {
  userId?: string;
  emailId: string;
  accountId?: string;
  sender: string;
  subject?: string;
  guessedCategory: InboxAiCategory;
  chosenCategory: InboxAiCategory;
  scope: CategoryApplyScope;
  context?: BehaviorContext;
};

type CollectOverrideLogInput = {
  userId?: string;
  emailId: string;
  accountId?: string;
  previousCategory?: InboxAiCategory | null;
  newCategory: InboxAiCategory;
  scope: CategoryApplyScope;
  sender?: string;
  subject?: string;
  context?: BehaviorContext;
};

type CollectActionMemoryInput = {
  emailId: string;
  accountId?: string;
  sender: string;
  subject?: string;
  category: InboxAiCategory;
  aiCategory?: InboxAiCategory;
  actionId: CompletionActionId;
  actionLabel?: string;
  context?: BehaviorContext;
};

function inferBehaviorContext(): BehaviorContext {
  if (typeof window === "undefined") return "inbox";
  const path = window.location.pathname;
  if (path.match(/\/emails\/[^/]+$/)) return "detail";
  try {
    const mode = sessionStorage.getItem("handled_inbox_interaction_mode");
    if (mode === "inbox_zero") return "inbox_zero";
  } catch {
    /* ignore */
  }
  return "inbox";
}

async function postMemoryCollect(payload: MemoryCollectPayload): Promise<void> {
  try {
    const res = await fetch("/api/memory/collect", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      handledDebugLog("memory-collect", { status: res.status, action: payload.action });
    }
  } catch (e) {
    handledDebugLog("memory-collect", { error: String(e), action: payload.action });
  }
}

/** Record category correction — strengthens sender trust + correction history. */
export async function collectCategoryCorrection(
  input: CollectCategoryCorrectionInput,
): Promise<void> {
  if (input.guessedCategory === input.chosenCategory) return;

  recordClientMemoryCorrection({
    sender: input.sender,
    subject: input.subject,
    chosenCategory: input.chosenCategory,
    guessedCategory: input.guessedCategory,
  });
  handledDebugLog("category-correction", input);

  void postMemoryCollect({
    action: "category_correction",
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    subject: input.subject,
    guessedCategory: input.guessedCategory,
    chosenCategory: input.chosenCategory,
    scope: input.scope,
    context: input.context ?? inferBehaviorContext(),
  });
}

/** Record per-email override event. */
export async function collectUserOverrideLog(
  input: CollectOverrideLogInput,
): Promise<void> {
  if (!input.sender) return;

  recordClientMemoryCorrection({
    sender: input.sender,
    subject: input.subject,
    chosenCategory: input.newCategory,
    guessedCategory: input.previousCategory ?? undefined,
  });

  handledDebugLog("user-override", input);

  void postMemoryCollect({
    action: "user_override",
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    subject: input.subject,
    previousCategory: input.previousCategory ?? null,
    chosenCategory: input.newCategory,
    scope: input.scope,
    context: input.context ?? inferBehaviorContext(),
  });
}

/** Record completion action — reply / ignore / defer patterns. */
export async function collectActionMemory(input: CollectActionMemoryInput): Promise<void> {
  handledDebugLog("action-memory", {
    sender: input.sender,
    actionId: input.actionId,
    category: input.category,
  });

  void postMemoryCollect({
    action: "completion_action",
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    subject: input.subject,
    category: input.category,
    guessedCategory: input.aiCategory ?? input.category,
    chosenCategory: input.category,
    actionId: input.actionId,
    actionLabel: input.actionLabel,
    context: input.context ?? inferBehaviorContext(),
  });
}

type CollectEmailOpenInput = {
  emailId: string;
  accountId?: string;
  sender: string;
  subject?: string;
  aiCategory?: InboxAiCategory;
};

/** Record email open — passive engagement signal. */
export async function collectEmailOpened(input: CollectEmailOpenInput): Promise<void> {
  void postMemoryCollect({
    action: "email_opened",
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    subject: input.subject,
    guessedCategory: input.aiCategory,
    context: "detail",
  });
}

/** Record detail view closed without Handled / category change / reply. */
export async function collectEmailViewedWithoutAction(
  input: CollectEmailOpenInput,
): Promise<void> {
  void postMemoryCollect({
    action: "email_viewed_no_action",
    emailId: input.emailId,
    accountId: input.accountId,
    sender: input.sender,
    subject: input.subject,
    guessedCategory: input.aiCategory,
    context: "detail",
  });
}
