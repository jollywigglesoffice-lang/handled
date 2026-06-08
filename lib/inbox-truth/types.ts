/** Gmail label totals returned alongside inbox fetch. */
export type GmailTruthStats = {
  inboxTotal: number;
  unreadTotal: number;
};

/** Client-side reconciliation snapshot shown in the inbox truth panel. */
export type InboxTruthSnapshot = {
  gmailInboxTotal: number | null;
  gmailUnreadTotal: number | null;
  loadedCount: number;
  visibleCount: number;
  completedCount: number;
  waitingOnCount: number;
};
