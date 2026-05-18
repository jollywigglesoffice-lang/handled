/** How Handled can help the user leave a mailing list. */
export type UnsubscribeMethodKind =
  | "one_click"
  | "http_link"
  | "mailto"
  | "reply"
  | "gmail_native";

export type UnsubscribeMethod = {
  kind: UnsubscribeMethodKind;
  /** User-facing explanation, e.g. "One-click unsubscribe available" */
  explanation: string;
  safe: boolean;
  requiresConfirmation: boolean;
  httpUrl?: string;
  mailto?: { email: string; subject?: string; body?: string };
  replyText?: string;
};

export type UnsubscribeAnalysis = {
  /** Show badge on card/detail */
  showBadge: boolean;
  badgeLabel: string;
  isNewsletterLike: boolean;
  primaryMethod: UnsubscribeMethod | null;
  methods: UnsubscribeMethod[];
  /** Suggested reply when reply-based unsub is detected */
  suggestedReplyText: string | null;
};

/** Future: bulk cleanup, engagement scoring, AI suggestions */
export type UnsubscribeCleanupSuggestion = {
  senderEmail: string;
  senderLabel: string;
  reason: "no_opens_6_months" | "never_opened" | "high_volume_unread";
  message: string;
  suggestedAction: "unsubscribe" | "move_to_promotions" | "ignore";
};

export type UnsubscribeBulkJob = {
  id: string;
  status: "pending" | "running" | "completed";
  suggestionIds: string[];
  createdAt: number;
};
