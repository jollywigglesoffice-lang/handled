export type UnsubscribeLink = {
  type: "link";
  url: string;
  label: string;
};

export type UnsubscribeReply = {
  type: "reply";
  instruction: string;
  suggestedReply: string;
};

export type UnsubscribeMailto = {
  type: "mailto";
  email: string;
  subject?: string;
};

export type UnsubscribeDetection =
  | UnsubscribeLink
  | UnsubscribeReply
  | UnsubscribeMailto;

const LINK_PATTERNS = [
  /href\s*=\s*["']([^"']*(?:unsubscribe|opt[_-]?out|remove|preferences|manage\s*subscription)[^"']*)["']/gi,
  /(https?:\/\/[^\s<>"']+(?:unsubscribe|opt[_-]?out|email-preferences)[^\s<>"']*)/gi,
];

const REPLY_STOP =
  /(?:reply|text|send)\s+(?:with\s+)?["']?(STOP|UNSUBSCRIBE|CANCEL|END)["']?/i;
const EMAIL_UNSUB =
  /(?:email|write|contact)\s+(?:us\s+)?(?:at\s+)?[\w.+-]+@[\w.-]+\.[a-z]{2,}\s+to\s+unsubscribe/i;
const CLICK_UNSUB = /click\s+(?:here\s+)?to\s+unsubscribe/i;

export function detectUnsubscribeOptions(
  plainText: string,
  html?: string,
): UnsubscribeDetection[] {
  const hay = `${plainText}\n${html ?? ""}`.slice(0, 80_000);
  const out: UnsubscribeDetection[] = [];
  const seenUrls = new Set<string>();

  for (const re of LINK_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(hay)) !== null) {
      let url = (m[1] ?? m[0]).trim();
      if (url.startsWith("//")) url = `https:${url}`;
      if (!url.startsWith("http")) continue;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      out.push({
        type: "link",
        url,
        label: "Unsubscribe instantly",
      });
      if (out.filter((x) => x.type === "link").length >= 2) break;
    }
  }

  const hasLink = out.some((x) => x.type === "link");
  if (CLICK_UNSUB.test(hay) && !hasLink) {
    const hint: UnsubscribeLink = {
      type: "link",
      url: "",
      label: "Unsubscribe link in email — open full message to use it",
    };
    out.push(hint);
  }

  if (REPLY_STOP.test(hay)) {
    const match = REPLY_STOP.exec(hay);
    const word = match?.[1] ?? "STOP";
    out.push({
      type: "reply",
      instruction: `Reply with ${word} to unsubscribe`,
      suggestedReply: word.toUpperCase() === "STOP" ? "STOP" : "Please unsubscribe me from future emails.",
    });
  } else if (/unsubscribe\s+by\s+replying/i.test(hay) || /reply\s+to\s+unsubscribe/i.test(hay)) {
    out.push({
      type: "reply",
      instruction: "Reply to unsubscribe",
      suggestedReply: "Please unsubscribe me from future emails.",
    });
  }

  const mailto = hay.match(/mailto:([^\s"'<>]+)/i);
  if (mailto?.[1] && /unsub|opt-?out|remove/i.test(hay)) {
    out.push({
      type: "mailto",
      email: mailto[1],
      subject: "Unsubscribe",
    });
  }

  if (EMAIL_UNSUB.test(hay)) {
    const em = hay.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
    if (em) {
      out.push({
        type: "mailto",
        email: em[0],
        subject: "Unsubscribe request",
      });
    }
  }

  return out;
}

export function hasUnsubscribeSignal(text: string, html?: string): boolean {
  return detectUnsubscribeOptions(text, html).length > 0;
}
