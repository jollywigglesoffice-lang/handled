import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

/** Starter rules users can seed into their account from Settings. */
export function defaultInboxUserRules(): InboxUserRule[] {
  return [
    {
      id: "preset-boost-doctor",
      enabled: true,
      priority: 220,
      phase: "post",
      label: "Doctor / clinic → needs attention",
      match: { type: "sender_contains", value: "doctor" },
      action: {
        type: "boost",
        toCategory: "needs_attention",
        whenCategories: ["promotion", "newsletter", "handled"],
      },
    },
    {
      id: "preset-boost-school",
      enabled: true,
      priority: 210,
      phase: "post",
      label: "School → needs attention",
      match: { type: "sender_contains", value: "school" },
      action: {
        type: "boost",
        toCategory: "needs_attention",
        whenCategories: ["promotion", "newsletter", "handled"],
      },
    },
    {
      id: "preset-demote-instagram",
      enabled: true,
      priority: 200,
      phase: "pre",
      label: "Instagram updates → promotion",
      match: { type: "sender_contains", value: "instagram" },
      action: { type: "force_category", category: "promotion" },
    },
    {
      id: "preset-demote-tiktok",
      enabled: true,
      priority: 190,
      phase: "pre",
      label: "TikTok → promotion",
      match: { type: "sender_contains", value: "tiktok" },
      action: { type: "force_category", category: "promotion" },
    },
    {
      id: "preset-handled-shopify-billing",
      enabled: true,
      priority: 180,
      phase: "pre",
      label: "Shopify billing → handled",
      match: { type: "sender_domain", value: "shopify.com" },
      action: { type: "force_category", category: "handled" },
    },
    {
      id: "preset-post-demote-needs-to-promo",
      enabled: true,
      priority: 100,
      phase: "post",
      label: "Demote misfiled social from needs_attention",
      match: { type: "sender_contains", value: "facebook" },
      action: {
        type: "demote",
        toCategory: "promotion",
        whenCategories: ["needs_attention"],
      },
    },
  ];
}
