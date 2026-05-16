import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

function newRuleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type InboxRuleTemplate = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  rules: Omit<InboxUserRule, "id">[];
};

export const INBOX_RULE_TEMPLATES: InboxRuleTemplate[] = [
  {
    id: "family-priority",
    title: "Family Priority",
    emoji: "👨‍👩‍👧",
    description:
      "Names or words in the email (comma-separated) → Needs your attention. Not case-sensitive.",
    rules: [
      {
        enabled: true,
        priority: 250,
        phase: "pre",
        label: "Family names → Needs attention",
        match: {
          type: "keywords_contains",
          value: "mom, dad, mamma, papà, family",
        },
        action: { type: "force_category", category: "needs_attention" },
      },
    ],
  },
  {
    id: "doctors-health",
    title: "Doctors & Health",
    emoji: "🏥",
    description: "Clinic, hospital, doctor keywords → Needs your attention.",
    rules: [
      {
        enabled: true,
        priority: 240,
        phase: "pre",
        label: "Health & doctors → Needs attention",
        match: {
          type: "keywords_contains",
          value:
            "doctor, dr., clinic, hospital, ospedale, medico, pediatrician, health, appointment",
        },
        action: { type: "force_category", category: "needs_attention" },
      },
    ],
  },
  {
    id: "school-emails",
    title: "School Emails",
    emoji: "🎓",
    description: "School, teacher, class updates → Needs your attention.",
    rules: [
      {
        enabled: true,
        priority: 230,
        phase: "pre",
        label: "School → Needs attention",
        match: {
          type: "keywords_contains",
          value: "school, scuola, teacher, professore, class, bambini, student",
        },
        action: { type: "force_category", category: "needs_attention" },
      },
    ],
  },
  {
    id: "bills-payments",
    title: "Bills & Payments",
    emoji: "💳",
    description: "Invoices and receipts → Handled (no clutter in urgent).",
    rules: [
      {
        enabled: true,
        priority: 220,
        phase: "pre",
        label: "Bills & receipts → Handled",
        match: {
          type: "keywords_contains",
          value: "invoice, receipt, payment received, amount due, fattura, pagamento",
        },
        action: { type: "force_category", category: "handled" },
      },
    ],
  },
  {
    id: "social-promo",
    title: "Social & Ads",
    emoji: "📱",
    description: "Instagram, TikTok, promos → Promotions (not urgent).",
    rules: [
      {
        enabled: true,
        priority: 210,
        phase: "pre",
        label: "Instagram → Promotions",
        match: { type: "keywords_contains", value: "instagram, mail.instagram" },
        action: { type: "force_category", category: "promotion" },
      },
      {
        enabled: true,
        priority: 200,
        phase: "pre",
        label: "Shopify billing → Handled",
        match: { type: "keywords_contains", value: "shopify, billing@shopify" },
        action: { type: "force_category", category: "handled" },
      },
    ],
  },
];

export function templateToRules(templateId: string): InboxUserRule[] {
  const template = INBOX_RULE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return [];
  return template.rules.map((r) => ({
    ...r,
    id: newRuleId(),
  }));
}
