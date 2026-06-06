import type { EmailCompletionMap, EmailCompletionRecord } from "@/lib/email-completions/types";

export const EMAIL_COMPLETIONS_KEY = "handled_email_completions_v1";
export const EMAIL_COMPLETIONS_EVENT = "handled-email-completions-changed";
export const COMPLETION_LEARNING_KEY = "handled_completion_learning_v1";

/** Legacy ids from the old “mark handled” flow */
export const LEGACY_HANDLED_EMAIL_IDS_KEY = "handled_email_ids";

export function parseEmailCompletionsJson(raw: unknown): EmailCompletionMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: EmailCompletionMap = {};
  for (const [emailId, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (typeof row.actionId !== "string" || typeof row.completedAt !== "number") continue;
    out[emailId] = {
      emailId,
      actionId: row.actionId as EmailCompletionRecord["actionId"],
      actionLabel: typeof row.actionLabel === "string" ? row.actionLabel : row.actionId,
      completedAt: row.completedAt,
      sender: typeof row.sender === "string" ? row.sender : "",
      subject: typeof row.subject === "string" ? row.subject : "",
      snippet: typeof row.snippet === "string" ? row.snippet : undefined,
      category: (typeof row.category === "string" ? row.category : "needs_attention") as EmailCompletionRecord["category"],
      senderDomain: typeof row.senderDomain === "string" ? row.senderDomain : undefined,
      waitingOn: typeof row.waitingOn === "string" ? row.waitingOn : undefined,
      followUpAfterDays:
        typeof row.followUpAfterDays === "number" ? row.followUpAfterDays : undefined,
      followUpAt: typeof row.followUpAt === "number" ? row.followUpAt : undefined,
      waitingResolvedAt:
        typeof row.waitingResolvedAt === "number" ? row.waitingResolvedAt : undefined,
      waitingResolutionReason:
        row.waitingResolutionReason === "received_response" ||
        row.waitingResolutionReason === "no_longer_waiting"
          ? row.waitingResolutionReason
          : undefined,
      stillWaitingAt: typeof row.stillWaitingAt === "number" ? row.stillWaitingAt : undefined,
    };
  }
  return out;
}

export function loadEmailCompletions(): EmailCompletionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EMAIL_COMPLETIONS_KEY);
    if (!raw) return migrateLegacyHandledIds();
    return parseEmailCompletionsJson(JSON.parse(raw));
  } catch {
    return {};
  }
}

function migrateLegacyHandledIds(): EmailCompletionMap {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_HANDLED_EMAIL_IDS_KEY);
    if (!legacyRaw) return {};
    const parsed = JSON.parse(legacyRaw) as unknown;
    if (!Array.isArray(parsed)) return {};
    const now = Date.now();
    const map: EmailCompletionMap = {};
    for (const id of parsed) {
      if (typeof id !== "string") continue;
      map[id] = {
        emailId: id,
        actionId: "no_action_needed",
        actionLabel: "No action needed",
        completedAt: now,
        sender: "",
        subject: "",
        category: "needs_attention",
      };
    }
    if (Object.keys(map).length > 0) {
      saveEmailCompletions(map);
      localStorage.removeItem(LEGACY_HANDLED_EMAIL_IDS_KEY);
    }
    return map;
  } catch {
    return {};
  }
}

export function saveEmailCompletions(map: EmailCompletionMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EMAIL_COMPLETIONS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(EMAIL_COMPLETIONS_EVENT));
  } catch {
    /* quota */
  }
}

export function mergeCompletionsIntoMap(
  existing: EmailCompletionMap,
  records: EmailCompletionRecord[],
): EmailCompletionMap {
  const next = { ...existing };
  for (const record of records) {
    next[record.emailId] = record;
  }
  return next;
}
