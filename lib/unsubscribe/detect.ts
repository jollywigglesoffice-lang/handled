import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { parseListUnsubscribeHeader, supportsOneClickPost } from "@/lib/unsubscribe/parse-headers";
import { assessUnsubscribeUrlSafety } from "@/lib/unsubscribe/safety";
import type { UnsubscribeAnalysis, UnsubscribeMethod } from "@/lib/unsubscribe/types";

const BODY_PHRASES =
  /\b(unsubscribe|opt\s*out|opt-out|manage\s+(your\s+)?preferences|stop\s+receiving|email\s+preferences|remove\s+me\s+from|update\s+(your\s+)?subscription)\b/i;

const LINK_PATTERNS = [
  /href\s*=\s*["']([^"']*(?:unsubscribe|opt[_-]?out|remove|preferences|manage\s*subscription|email-preferences)[^"']*)["']/gi,
  /(https?:\/\/[^\s<>"']+(?:unsubscribe|opt[_-]?out|email-preferences|list-manage)[^\s<>"']*)/gi,
];

const REPLY_STOP =
  /(?:reply|text|send)\s+(?:with\s+)?["']?(STOP|UNSUBSCRIBE|CANCEL|END)["']?\s+to\s+unsubscribe/i;
const REPLY_GENERIC =
  /(?:reply\s+to\s+unsubscribe|unsubscribe\s+by\s+replying|reply\s+with\s+["']?(?:stop|unsubscribe))/i;

const DEFAULT_UNSUB_REPLY = "Please unsubscribe me from this mailing list.";

export type UnsubscribeDetectInput = {
  bodyPlain?: string;
  bodyHtml?: string;
  snippet?: string;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
  inboxCategory?: InboxAiCategory;
};

function methodExplanation(kind: UnsubscribeMethod["kind"]): string {
  switch (kind) {
    case "one_click":
      return "One-click unsubscribe available";
    case "mailto":
      return "Reply-based unsubscribe (email to list provider)";
    case "reply":
      return "Reply-based unsubscribe";
    case "http_link":
      return "External unsubscribe page";
    case "gmail_native":
      return "Gmail-supported unsubscribe";
    default:
      return "Unsubscribe option detected";
  }
}

function detectBodyMethods(hay: string, methods: UnsubscribeMethod[]): void {
  const seenUrls = new Set<string>();

  for (const re of LINK_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(hay)) !== null) {
      let url = (m[1] ?? m[0]).trim();
      if (url.startsWith("//")) url = `https:${url}`;
      if (!/^https?:\/\//i.test(url) || seenUrls.has(url)) continue;
      seenUrls.add(url);
      const safety = assessUnsubscribeUrlSafety(url);
      if (!safety.safe && !safety.caution) continue;
      methods.push({
        kind: "http_link",
        explanation: methodExplanation("http_link"),
        safe: safety.safe,
        requiresConfirmation: true,
        httpUrl: url,
      });
      if (methods.filter((x) => x.kind === "http_link").length >= 2) break;
    }
  }

  const mailtoInBody = hay.match(/mailto:([^\s"'<>?]+)/gi);
  if (mailtoInBody && BODY_PHRASES.test(hay)) {
    for (const raw of mailtoInBody.slice(0, 2)) {
      const email = raw.replace(/^mailto:/i, "").trim();
      if (!email.includes("@")) continue;
      methods.push({
        kind: "mailto",
        explanation: "Unsubscribe via email to the sender",
        safe: true,
        requiresConfirmation: true,
        mailto: {
          email,
          subject: "Unsubscribe",
          body: DEFAULT_UNSUB_REPLY,
        },
      });
    }
  }

  if (REPLY_STOP.test(hay)) {
    const match = REPLY_STOP.exec(hay);
    const word = match?.[1] ?? "STOP";
    const replyText =
      word.toUpperCase() === "STOP" ? "STOP" : DEFAULT_UNSUB_REPLY;
    methods.push({
      kind: "reply",
      explanation: methodExplanation("reply"),
      safe: true,
      requiresConfirmation: true,
      replyText,
    });
  } else if (REPLY_GENERIC.test(hay)) {
    methods.push({
      kind: "reply",
      explanation: methodExplanation("reply"),
      safe: true,
      requiresConfirmation: true,
      replyText: DEFAULT_UNSUB_REPLY,
    });
  }
}

function detectHeaderMethods(
  listUnsubscribe: string | undefined,
  listUnsubscribePost: string | undefined,
  methods: UnsubscribeMethod[],
): void {
  if (!listUnsubscribe?.trim()) return;

  const parsed = parseListUnsubscribeHeader(listUnsubscribe);
  const oneClick = supportsOneClickPost(listUnsubscribePost);

  for (const url of parsed.https) {
    const safety = assessUnsubscribeUrlSafety(url);
    if (!safety.safe && !safety.caution) continue;

    if (oneClick && safety.safe) {
      methods.unshift({
        kind: "one_click",
        explanation: methodExplanation("one_click"),
        safe: true,
        requiresConfirmation: true,
        httpUrl: url,
      });
    } else {
      methods.push({
        kind: oneClick ? "one_click" : "http_link",
        explanation: oneClick
          ? methodExplanation("one_click")
          : methodExplanation("http_link"),
        safe: safety.safe,
        requiresConfirmation: true,
        httpUrl: url,
      });
    }
  }

  if (parsed.https.length > 0 || parsed.mailto.length > 0) {
    methods.push({
      kind: "gmail_native",
      explanation: methodExplanation("gmail_native"),
      safe: true,
      requiresConfirmation: false,
    });
  }

  for (const email of parsed.mailto) {
    if (!email.includes("@")) continue;
    methods.push({
      kind: "mailto",
      explanation: "List-Unsubscribe mailto header",
      safe: true,
      requiresConfirmation: true,
      mailto: {
        email,
        subject: "Unsubscribe",
        body: DEFAULT_UNSUB_REPLY,
      },
    });
  }
}

function dedupeMethods(methods: UnsubscribeMethod[]): UnsubscribeMethod[] {
  const seen = new Set<string>();
  const out: UnsubscribeMethod[] = [];
  for (const m of methods) {
    const key =
      m.kind === "http_link" || m.kind === "one_click"
        ? `url:${m.httpUrl}`
        : m.kind === "mailto"
          ? `mailto:${m.mailto?.email}`
          : m.kind === "reply"
            ? `reply:${m.replyText}`
            : m.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export function analyzeUnsubscribe(input: UnsubscribeDetectInput): UnsubscribeAnalysis {
  const hay = `${input.bodyPlain ?? ""}\n${input.bodyHtml ?? ""}\n${input.snippet ?? ""}`.slice(
    0,
    120_000,
  );

  const methods: UnsubscribeMethod[] = [];
  detectHeaderMethods(input.listUnsubscribe, input.listUnsubscribePost, methods);
  detectBodyMethods(hay, methods);

  const deduped = dedupeMethods(methods);
  const priority: UnsubscribeMethod["kind"][] = [
    "one_click",
    "gmail_native",
    "http_link",
    "mailto",
    "reply",
  ];
  const primary =
    priority
      .map((k) => deduped.find((m) => m.kind === k))
      .find(Boolean) ?? deduped[0] ?? null;

  const category = input.inboxCategory;
  const isNewsletterLike =
    category === "newsletter" ||
    category === "promotion" ||
    BODY_PHRASES.test(hay) ||
    Boolean(input.listUnsubscribe?.trim());

  const showBadge =
    isNewsletterLike &&
    (deduped.length > 0 || category === "newsletter" || category === "promotion");

  const badgeLabel =
    category === "promotion"
      ? "Promotion detected"
      : category === "newsletter"
        ? "Newsletter detected"
        : "Mailing list detected";

  const replyMethod = deduped.find((m) => m.kind === "reply");
  const suggestedReplyText =
    replyMethod?.replyText ??
    (primary?.kind === "mailto" ? DEFAULT_UNSUB_REPLY : null);

  return {
    showBadge,
    badgeLabel,
    isNewsletterLike,
    primaryMethod: primary,
    methods: deduped,
    suggestedReplyText,
  };
}

/** Lightweight check for inbox list rows (snippet + optional header). */
export function hasUnsubscribeSignal(
  snippet: string,
  listUnsubscribe?: string,
): boolean {
  if (listUnsubscribe?.trim()) return true;
  return BODY_PHRASES.test(snippet);
}
