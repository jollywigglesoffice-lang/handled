import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

export const LOCAL_INBOX_RULES_KEY = "handled_inbox_rules_v1";
export const INBOX_RULES_HEADER = "x-handled-inbox-rules";

export function loadClientInboxRules(): InboxUserRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      localStorage.getItem(LOCAL_INBOX_RULES_KEY) ??
      localStorage.getItem("handled_inbox_rules_draft");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InboxUserRule[]) : [];
  } catch {
    return [];
  }
}

export function saveClientInboxRules(rules: InboxUserRule[]): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(rules);
    localStorage.setItem(LOCAL_INBOX_RULES_KEY, json);
    localStorage.setItem("handled_inbox_rules_draft", json);
    window.dispatchEvent(new Event("handled-inbox-rules-changed"));
  } catch {
    // quota
  }
}

export function inboxRulesHeaders(): HeadersInit {
  const rules = loadClientInboxRules();
  if (!rules.length) return {};
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(rules))));
    return { [INBOX_RULES_HEADER]: encoded };
  } catch {
    return {};
  }
}

export function parseInboxRulesHeader(header: string | null): InboxUserRule[] {
  if (!header?.trim()) return [];
  try {
    const json = decodeURIComponent(escape(atob(header.trim())));
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as InboxUserRule[]) : [];
  } catch {
    return [];
  }
}
