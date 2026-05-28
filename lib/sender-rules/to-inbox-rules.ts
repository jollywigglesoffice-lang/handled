import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import type { SenderRule } from "@/lib/sender-rules/types";
import { resolveSenderIdentity } from "@/lib/sender-identity";

const SENDER_RULE_PRIORITY_BASE = 500;

/** Convert learned sender rules to pre-phase inbox rules (highest priority tier). */
export function senderRulesToInboxRules(rules: SenderRule[]): InboxUserRule[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule, index) => {
      const identity = resolveSenderIdentity(
        rule.senderEmail.includes("@")
          ? rule.senderEmail
          : rule.senderDomain
            ? `placeholder <x@${rule.senderDomain}>`
            : rule.senderEmail,
      );
      const match =
        identity.email && identity.email.includes("@")
          ? ({ type: "sender_email" as const, value: identity.email })
          : rule.senderDomain
            ? ({ type: "sender_domain" as const, value: rule.senderDomain })
            : ({ type: "sender_contains" as const, value: rule.senderEmail || identity.ruleKey });

      return {
        id: `sender-learned-${rule.id}`,
        enabled: true,
        priority: SENDER_RULE_PRIORITY_BASE - index,
        phase: "pre",
        label: rule.label ?? `Learned: ${rule.senderEmail || rule.senderDomain}`,
        match,
        action: { type: "force_category", category: rule.targetCategory },
      };
    });
}

export function isLearnedSenderInboxRule(rule: InboxUserRule): boolean {
  return rule.id.startsWith("sender-learned-") || rule.id.startsWith("sender-pref-");
}
