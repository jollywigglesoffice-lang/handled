import type { InboxUserRule } from "@/lib/inbox-user-rules/types";
import type { SenderRule } from "@/lib/sender-rules/types";

const SENDER_RULE_PRIORITY_BASE = 500;

/** Convert learned sender rules to pre-phase inbox rules (highest priority tier). */
export function senderRulesToInboxRules(rules: SenderRule[]): InboxUserRule[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule, index) => {
      const match =
        rule.senderEmail && rule.senderEmail.includes("@")
          ? ({ type: "sender_email" as const, value: rule.senderEmail })
          : rule.senderDomain
            ? ({ type: "sender_domain" as const, value: rule.senderDomain })
            : ({ type: "sender_contains" as const, value: rule.senderEmail });

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
