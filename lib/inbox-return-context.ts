import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { inboxCategoryTitle, type InboxCategoryCatalog } from "@/lib/inbox-category-catalog";

export type InboxReturnView = "inbox";

export type InboxReturnContext = {
  view: InboxReturnView;
  /** Active inbox category tab (`all` or a category id). */
  categoryTab: string;
  scrollY: number;
  anchorEmailId: string;
};

const RETURN_KEY = "handled_inbox_return_v1";
const SCROLL_RESTORE_KEY = "handled_inbox_scroll_restore_v1";

export type InboxReturnCapture = Pick<InboxReturnContext, "view" | "categoryTab">;

export function captureInboxReturnFromOpen(
  capture: InboxReturnCapture,
  emailId: string,
): void {
  saveInboxReturnContext({
    view: capture.view ?? "inbox",
    categoryTab: capture.categoryTab,
    scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    anchorEmailId: emailId,
  });
}

export function saveInboxReturnContext(ctx: InboxReturnContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function loadInboxReturnContext(): InboxReturnContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InboxReturnContext;
    if (!parsed?.anchorEmailId || !parsed.categoryTab) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** One-time scroll/tab restore after completing from the detail page. */
export function queueInboxScrollRestore(ctx: InboxReturnContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_RESTORE_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function consumeInboxScrollRestore(): InboxReturnContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SCROLL_RESTORE_KEY);
    const parsed = JSON.parse(raw) as InboxReturnContext;
    if (!parsed?.anchorEmailId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function inboxReturnPath(_ctx: InboxReturnContext | null): string {
  return "/emails";
}

export function inboxReturnDestinationLabel(
  ctx: InboxReturnContext | null,
  emailCategory: InboxAiCategory,
  locale: "en" | "it",
  catalog: InboxCategoryCatalog,
): string {
  if (!ctx) return locale === "it" ? "Inbox" : "Inbox";
  if (ctx.categoryTab === "all") {
    return inboxCategoryTitle(emailCategory, locale, catalog);
  }
  return inboxCategoryTitle(ctx.categoryTab as InboxAiCategory, locale, catalog);
}

export function inboxEmailAnchorId(emailId: string): string {
  return `inbox-email-${emailId}`;
}

export function scrollToInboxEmail(emailId: string, scrollY: number): boolean {
  const el = document.getElementById(inboxEmailAnchorId(emailId));
  if (el) {
    el.scrollIntoView({ block: "center", behavior: "auto" });
    return true;
  }
  if (scrollY > 0) {
    window.scrollTo({ top: scrollY, behavior: "auto" });
    return true;
  }
  return false;
}
