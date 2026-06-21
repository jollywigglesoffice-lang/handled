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
      match: {
        type: "keywords_contains",
        value: "doctor, dr., clinic, hospital, ospedale, medico",
      },
      action: {
        type: "boost",
        toCategory: "worth_your_attention",
        whenCategories: ["promotions", "newsletters", "good_to_know"],
      },
    },
    {
      id: "preset-boost-school",
      enabled: true,
      priority: 210,
      phase: "post",
      label: "School → needs attention",
      match: {
        type: "keywords_contains",
        value: "school, scuola, teacher, professore, class",
      },
      action: {
        type: "boost",
        toCategory: "worth_your_attention",
        whenCategories: ["promotions", "newsletters", "good_to_know"],
      },
    },
    {
      id: "preset-demote-instagram",
      enabled: true,
      priority: 200,
      phase: "pre",
      label: "Instagram updates → promotion",
      match: { type: "keywords_contains", value: "instagram, mail.instagram" },
      action: { type: "force_category", category: "promotions" },
    },
    {
      id: "preset-demote-tiktok",
      enabled: true,
      priority: 190,
      phase: "pre",
      label: "TikTok → promotion",
      match: { type: "keywords_contains", value: "tiktok" },
      action: { type: "force_category", category: "promotions" },
    },
    {
      id: "preset-fyi-shopify-billing",
      enabled: true,
      priority: 180,
      phase: "pre",
      label: "Shopify billing → good to know",
      match: {
        type: "keywords_contains",
        value: "shopify, billing@shopify, shopify billing",
      },
      action: { type: "force_category", category: "good_to_know" },
    },
    {
      id: "preset-post-demote-needs-to-promo",
      enabled: true,
      priority: 100,
      phase: "post",
      label: "Demote misfiled social from worth_your_attention",
      match: { type: "sender_contains", value: "facebook" },
      action: {
        type: "demote",
        toCategory: "promotions",
        whenCategories: ["worth_your_attention"],
      },
    },
  ];
}
