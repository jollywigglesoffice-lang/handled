import type { GmailInboxRow } from "@/lib/gmail-api";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { parseSenderDomain, parseSenderEmail } from "@/lib/inbox-user-rules/match";
import { kindToDisplayLabel } from "@/lib/relationship-intelligence/labels";
import type {
  RelationshipKind,
  RelationshipSource,
  SenderRelationshipProfile,
} from "@/lib/relationship-intelligence/types";

function haystack(row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">): string {
  return `${row.sender} ${row.subject} ${row.snippet ?? ""}`.toLowerCase();
}

const SCHOOL =
  /\.edu\b|@.*\.k12\.|school|academy|university|college|teacher|principal|pta|parent.?teacher|scuola|scuole|insegnante|insegnanti|maestra|maestro|colloquio|materna|asilo|nido|elementare|segreteria|genitori|classe|compiti/i;
const HEALTHCARE =
  /hospital|clinic|healthcare|physician|doctor|dental|pediatric|pharmacy|medical|therapy|nurse|ospedale|pediatra|pediatria|appuntamento\s+medico/i;
const BILLING = /invoice|receipt|billing|payment due|stripe|paypal|quickbooks|account statement/i;
const NEWSLETTER =
  /newsletter|substack|digest|unsubscribe|view in browser|mailchimp|beehiiv|constant contact/i;
const MARKETING = /marketing@|promo@|offers@|deals@|sale@|campaign@|ads@/i;
const TEAM = /@.*\.(io|co|com)$/i; // weak — paired with display name

function detectFromDomain(domain: string): RelationshipKind | null {
  const d = domain.toLowerCase();
  if (!d) return null;
  if (SCHOOL.test(d) || d.endsWith(".edu")) return "school";
  if (HEALTHCARE.test(d)) return "healthcare";
  if (/noreply|no-reply|newsletter|mail\.|email\./i.test(d)) return "newsletter";
  if (MARKETING.test(`x@${d}`)) return "marketing";
  return null;
}

function detectFromContent(hay: string, category: InboxAiCategory): RelationshipKind | null {
  if (category === "promotion") return "promotion";
  if (category === "newsletter") return "newsletter";
  if (SCHOOL.test(hay)) return "school";
  if (HEALTHCARE.test(hay)) return "healthcare";
  if (BILLING.test(hay) && !/\?|can you|please confirm/i.test(hay)) return "billing";
  if (NEWSLETTER.test(hay)) return "newsletter";
  if (MARKETING.test(hay)) return "marketing";
  if (/enterprise|corporate|partnership|pricing for \d+/i.test(hay)) return "vip_client";
  if (/support@|help@|care@/i.test(hay)) return "client";
  return null;
}

function detectFromSenderDisplay(sender: string): RelationshipKind | null {
  const personal =
    /^["']?([a-z][a-z'-]{1,20})["']?\s*</i.exec(sender) ||
    /^([A-Z][a-z]{1,20})\s+[A-Z][a-z]+</.exec(sender);
  if (personal && !/noreply|no-reply|support|team|hello@|info@/i.test(sender)) {
    if (/inc\.|llc|corp|ltd/i.test(sender)) return "client";
    return "friends";
  }
  return null;
}

/**
 * Heuristic relationship detection for a single message.
 * Manual store entries should be merged before calling this.
 */
export function detectRelationshipFromMessage(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  category: InboxAiCategory,
): SenderRelationshipProfile | null {
  const hay = haystack(row);
  const domain = parseSenderDomain(row.sender);
  const email = parseSenderEmail(row.sender);

  const fromDomain = domain ? detectFromDomain(domain) : null;
  const fromContent = detectFromContent(hay, category);
  const fromDisplay = detectFromSenderDisplay(row.sender);

  const kind =
    fromDomain ??
    fromContent ??
    fromDisplay ??
    (category === "needs_attention" && email && !email.includes("noreply")
      ? "client"
      : null);

  if (!kind || kind === "unknown") return null;

  const importance =
    kind === "vip_client"
      ? "vip"
      : kind === "family" || kind === "school" || kind === "healthcare"
        ? "important"
        : kind === "newsletter" || kind === "promotion" || kind === "marketing"
          ? "ignore"
          : "normal";

  const source: RelationshipSource = fromDomain
    ? "domain"
    : fromContent
      ? "detected"
      : "detected";

  return {
    kind,
    label: kindToDisplayLabel(kind),
    importance,
    source,
    confidence: fromDomain ? 0.88 : fromContent ? 0.75 : 0.55,
  };
}
