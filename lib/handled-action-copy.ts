/** Calm, intention-first labels for inbox actions — single source of truth. */
export type HandledActionLocale = "en" | "it";

export type HandledActionCopy = {
  handled: string;
  moveTo: string;
  unreadAgain: string;
  putAway: string;
  markRead: string;
  reply: string;
  undo: string;
  cancel: string;
  setRelationship: string;
  completedAs: (label: string) => string;
  undone: string;
  /** Done / handled picker prompt */
  handledPrompt: string;
  /** Quick intent actions (email detail) */
  replyLater: string;
  waitingOnSomeone: string;
  noActionNeeded: string;
  forward: string;
};

const EN: HandledActionCopy = {
  handled: "Handled",
  moveTo: "Move to…",
  unreadAgain: "Unread again",
  putAway: "Put away",
  markRead: "Mark read",
  reply: "Reply",
  undo: "Undo",
  cancel: "Cancel",
  setRelationship: "Set relationship",
  completedAs: (label) => `Handled · ${label}`,
  undone: "Back in your inbox",
  handledPrompt: "How would you like to handle this?",
  replyLater: "I'll reply later",
  waitingOnSomeone: "I'm waiting on someone",
  noActionNeeded: "No action needed",
  forward: "Forward",
};

const IT: HandledActionCopy = {
  handled: "Gestita",
  moveTo: "Sposta in…",
  unreadAgain: "Da leggere di nuovo",
  putAway: "Metti da parte",
  markRead: "Segna letta",
  reply: "Rispondi",
  undo: "Annulla",
  cancel: "Annulla",
  setRelationship: "Assegna relazione",
  completedAs: (label) => `Gestita · ${label}`,
  undone: "Di nuovo in inbox",
  handledPrompt: "Come vuoi gestirla?",
  replyLater: "Rispondo più tardi",
  waitingOnSomeone: "Aspetto qualcuno",
  noActionNeeded: "Nessuna azione necessaria",
  forward: "Inoltra",
};

export function handledActionCopy(locale: HandledActionLocale): HandledActionCopy {
  return locale === "it" ? IT : EN;
}

/** @deprecated Use handledActionCopy — kept for EMAIL_STATUS_COPY shape */
export function emailStatusCopy(locale: HandledActionLocale) {
  const c = handledActionCopy(locale);
  return {
    markRead: c.markRead,
    markUnread: c.unreadAgain,
    doneWith: c.handled,
    undo: c.undo,
    changeCategory: c.moveTo,
    setRelationship: c.setRelationship,
    completedAs: c.completedAs,
    undone: c.undone,
  };
}
