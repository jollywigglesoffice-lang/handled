import { pickSignOffForContext } from "@/lib/user-identity/sign-off";
import type { UserIdentity } from "@/lib/user-identity/types";
import type { ReplyContextAnalysis } from "@/lib/reply-context-analysis";

function replyAlreadySigned(reply: string, identity: UserIdentity): boolean {
  const trimmed = reply.trim();
  const name = identity.displayName.trim().toLowerCase();
  const full = identity.fullName?.trim().toLowerCase();
  const lower = trimmed.toLowerCase();

  if (name && lower.endsWith(name)) return true;
  if (full && lower.includes(full)) return true;

  const tail = trimmed.slice(-120);
  return /(?:^|\n)(?:best|thanks|regards|cheers|warm regards),?\s*\n?\s*[A-Z]/im.test(tail);
}

export function applySignOffToReplies(
  replies: string[],
  identity: UserIdentity,
  ctx?: ReplyContextAnalysis | null,
): string[] {
  const signOff = pickSignOffForContext(identity, ctx);
  if (!signOff) return replies;

  return replies.map((reply) => {
    const body = reply.trim();
    if (!body || replyAlreadySigned(body, identity)) {
      return body;
    }
    return `${body}\n\n${signOff}`;
  });
}
