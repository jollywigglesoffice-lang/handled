import type { ReplyContextAnalysis } from "@/lib/reply-context-analysis";
import type { SignOffStyle, UserIdentity } from "@/lib/user-identity/types";

export function buildSignOffLine(identity: UserIdentity): string | null {
  if (!identity.includeSignOffInReplies) return null;

  const custom = identity.customSignOff?.trim();
  if (custom) return custom;

  if (identity.defaultSignOff === "none") return null;

  const name = identity.displayName.trim();
  if (!name) return null;

  switch (identity.defaultSignOff) {
    case "thanks":
      return `Thanks,\n${name}`;
    case "regards":
      return `Regards,\n${name}`;
    case "warm_regards":
      return `Warm regards,\n${name}`;
    case "best":
    default:
      return `Best,\n${name}`;
  }
}

export function buildFullSignatureBlock(identity: UserIdentity): string | null {
  const custom = identity.signatureBlock?.trim();
  if (custom) return custom;

  const lines: string[] = [];
  const full = identity.fullName?.trim() || identity.displayName.trim();
  if (full) lines.push(full);
  if (identity.businessTitle?.trim() && identity.companyName?.trim()) {
    lines.push(`${identity.businessTitle.trim()}, ${identity.companyName.trim()}`);
  } else if (identity.businessTitle?.trim()) {
    lines.push(identity.businessTitle.trim());
  } else if (identity.companyName?.trim()) {
    lines.push(identity.companyName.trim());
  }

  if (lines.length === 0) return null;
  return lines.join("\n");
}

/** Pick sign-off depth based on email context (relationship / type). */
export function pickSignOffForContext(
  identity: UserIdentity,
  ctx?: ReplyContextAnalysis | null,
): string | null {
  if (!identity.includeSignOffInReplies) return null;

  const useFull =
    ctx &&
    (ctx.emailType === "inbound_sales" ||
      ctx.primaryIntent === "pricing_inquiry" ||
      ctx.primaryIntent === "sales_lead" ||
      ctx.primaryIntent === "partnership");

  if (useFull) {
    const block = buildFullSignatureBlock(identity);
    if (block) return block;
  }

  if (ctx?.emailType === "personal") {
    const line = buildSignOffLine({
      ...identity,
      defaultSignOff: identity.communicationStyle === "professional" ? "regards" : "thanks",
    });
    return line;
  }

  return buildSignOffLine(identity);
}

export const SIGN_OFF_LABELS: Record<SignOffStyle, string> = {
  best: "Best, [name]",
  thanks: "Thanks, [name]",
  regards: "Regards, [name]",
  warm_regards: "Warm regards, [name]",
  none: "No sign-off",
};
