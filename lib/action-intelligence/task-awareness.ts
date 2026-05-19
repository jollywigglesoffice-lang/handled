import type { GmailInboxRow } from "@/lib/gmail-api";
import type { TaskAwarenessItem } from "@/lib/action-intelligence/types";

function haystack(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): string {
  return `${row.sender} ${row.subject} ${row.snippet ?? ""} ${extraBody ?? ""}`;
}

const DATE_PATTERNS: Array<{ pattern: RegExp; label: (m: RegExpMatchArray) => string }> = [
  {
    pattern: /\bby (?:eod|cob|end of day)\b/i,
    label: () => "end of day",
  },
  {
    pattern: /\bby (tomorrow|today|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/i,
    label: (m) => m[1]!,
  },
  {
    pattern: /\b(entro (?:domani|venerdì|lunedì|martedì|mercoledì|giovedì))\b/i,
    label: (m) => m[1]!,
  },
  {
    pattern: /\b(send|reply|get back|let me know).{0,40}before (friday|monday|tomorrow|eod)\b/i,
    label: (m) => `before ${m[2]}`,
  },
  {
    pattern: /\b(let me know|fammi sapere).{0,20}(tomorrow|domani)\b/i,
    label: (m) => m[2]!,
  },
  {
    pattern: /\b(due (?:on|by)|scadenza|deadline).{0,30}(\d{1,2}[/.-]\d{1,2}|\w+day)\b/i,
    label: (m) => m[0]!.slice(0, 60),
  },
];

const PROMISE =
  /\b(i(?:'ll| will)|we(?:'ll| will)|ti (?:mando|invio)|vi (?:mando|invio)).{0,50}(send|share|follow up|get back|confirm|reply|inviare|rispondere)\b/i;

const COMMITMENT =
  /\b(waiting for (?:your )?approval|pending approval|you (?:said|promised|agreed)|in attesa di approvazione|promesso di)\b/i;

const REQUESTED =
  /\b(please (?:send|share|attach|confirm|let me know)|can you (?:send|share|attach)|could you (?:send|share)|per favore (?:invia|allega|conferma))\b/i;

export function extractTaskAwareness(
  row: Pick<GmailInboxRow, "sender" | "subject" | "snippet">,
  extraBody?: string,
): TaskAwarenessItem[] {
  const hay = haystack(row, extraBody);
  const items: TaskAwarenessItem[] = [];
  const seen = new Set<string>();

  function add(item: TaskAwarenessItem) {
    const key = `${item.kind}:${item.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  }

  for (const { pattern, label } of DATE_PATTERNS) {
    const m = hay.match(pattern);
    if (m) {
      add({
        kind: "date",
        text: m[0]!.trim().slice(0, 80),
        when: label(m),
      });
    }
  }

  const promiseM = hay.match(PROMISE);
  if (promiseM) {
    add({
      kind: "promise",
      text: promiseM[0]!.trim().slice(0, 80),
    });
  }

  const commitM = hay.match(COMMITMENT);
  if (commitM) {
    add({
      kind: "commitment",
      text: commitM[0]!.trim().slice(0, 80),
    });
  }

  const reqM = hay.match(REQUESTED);
  if (reqM) {
    add({
      kind: "requested_action",
      text: reqM[0]!.trim().slice(0, 80),
    });
  }

  return items.slice(0, 4);
}
