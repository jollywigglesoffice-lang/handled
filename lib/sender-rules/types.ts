import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

/** Learned sender categorization rule (cloud + local cache). */
export type SenderRule = {
  id: string;
  senderEmail: string;
  senderDomain: string;
  targetCategory: InboxAiCategory;
  label?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SenderRuleRowDb = {
  id: string;
  user_id: string;
  sender_email: string;
  sender_domain: string;
  target_category: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};
