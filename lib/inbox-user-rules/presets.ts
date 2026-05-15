import type { InboxUserRule } from "@/lib/inbox-user-rules/types";

/** Starter rules — merge with DB / localStorage; customize per user later. */
export function defaultInboxUserRules(): InboxUserRule[] {
  return [
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
